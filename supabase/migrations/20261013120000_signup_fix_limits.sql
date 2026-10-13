-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- Limits and clean-up for signup-fix-email (correcting a mistyped sign-up
-- e-mail). Requires 20261013100000 (svc_signup_email_fix).
--
--   * signup_fix_attempts: one row per request that reached the function.
--     Only SHA-256 fingerprints of the addresses (never the addresses), the
--     account id when known, the outcome and the time.
--   * svc_signup_fix_gate: says no (too_many / busy) BEFORE the password is
--     tried, so the function can't be used to guess passwords or to send
--     confirmation e-mails to many addresses:
--       - 5 wrong passwords in 1 hour for the same old address  -> too_many
--       - 10 attempts in 24 hours for the same old address      -> too_many
--       - 3 attempts in 24 hours towards the same new address   -> too_many
--       - 60 attempts in 1 hour in total                       -> busy
--   * svc_signup_email_fix (replaced): also at most 3 successful corrections
--     per account (limit_reached) and a separate answer for accounts older
--     than 7 days (too_old).
--   * svc_signup_fix_finish: after the change, the confirmation link that was
--     sent to the OLD (mistyped) address stops working.

create table if not exists public.signup_fix_attempts (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  old_hash  text not null,
  new_hash  text not null,
  user_id   uuid,
  outcome   text not null
);
create index if not exists signup_fix_attempts_at_idx on public.signup_fix_attempts (at desc);
create index if not exists signup_fix_attempts_old_idx on public.signup_fix_attempts (old_hash, at desc);
create index if not exists signup_fix_attempts_new_idx on public.signup_fix_attempts (new_hash, at desc);
alter table public.signup_fix_attempts enable row level security;
revoke all on public.signup_fix_attempts from anon, authenticated;

create or replace function public.email_fingerprint(p text)
returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to('mv-signup-fix:' || lower(trim(coalesce(p, ''))), 'UTF8')), 'hex');
$$;

-- 'ok', 'too_many' or 'busy'. Read-only.
create or replace function public.svc_signup_fix_gate(p_old text, p_new text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o text := public.email_fingerprint(p_old);
  n text := public.email_fingerprint(p_new);
begin
  if (select count(*) from public.signup_fix_attempts where at > now() - interval '1 hour') >= 60 then return 'busy'; end if;
  if (select count(*) from public.signup_fix_attempts where old_hash = o and outcome = 'wrong_password' and at > now() - interval '1 hour') >= 5 then return 'too_many'; end if;
  if (select count(*) from public.signup_fix_attempts where old_hash = o and at > now() - interval '24 hours') >= 10 then return 'too_many'; end if;
  if (select count(*) from public.signup_fix_attempts where new_hash = n and at > now() - interval '24 hours') >= 3 then return 'too_many'; end if;
  return 'ok';
end;
$$;

create or replace function public.svc_signup_fix_log(p_old text, p_new text, p_user uuid, p_outcome text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.signup_fix_attempts (old_hash, new_hash, user_id, outcome)
  values (public.email_fingerprint(p_old), public.email_fingerprint(p_new), p_user, left(p_outcome, 40));
$$;

-- Same checks as in 20261013100000, plus too_old and limit_reached.
-- Errors: bad_email, not_found, too_old, limit_reached, not_allowed.
create or replace function public.svc_signup_email_fix(p_old text, p_new text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_created timestamptz;
  v_new text := lower(trim(coalesce(p_new, '')));
  v_dom text;
begin
  if v_new !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'bad_email'; end if;
  select id, created_at into v_id, v_created from auth.users
   where lower(email) = lower(trim(coalesce(p_old, ''))) and email_confirmed_at is null;
  if v_id is null then raise exception 'not_found'; end if;
  if v_created <= now() - interval '7 days' then raise exception 'too_old'; end if;
  if (select count(*) from public.signup_fix_attempts where user_id = v_id and outcome = 'fixed') >= 3 then
    raise exception 'limit_reached';
  end if;
  v_dom := split_part(v_new, '@', 2);
  if exists (select 1 from public.blocked_email_domains b where v_dom = b.domain or v_dom like '%.' || b.domain)
     or exists (select 1 from auth.users u where lower(u.email) = v_new and u.id <> v_id)
     or exists (select 1 from public.profiles p where p.email_normalized = public.normalize_email(v_new) and p.id <> v_id)
  then
    raise exception 'not_allowed';
  end if;
  return v_id;
end;
$$;

-- After the e-mail was changed: the link already sent to the old address
-- can't confirm the account any more (Supabase keeps it in
-- auth.users.confirmation_token and, in newer projects, also in
-- auth.one_time_tokens). The person asks for a new one to the new address.
create or replace function public.svc_signup_fix_finish(p_user uuid, p_old text, p_new text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users set confirmation_token = '', confirmation_sent_at = null
   where id = p_user and email_confirmed_at is null;
  if to_regclass('auth.one_time_tokens') is not null then
    execute 'delete from auth.one_time_tokens where user_id = $1 and token_type = ''confirmation_token''' using p_user;
  end if;
  perform public.svc_signup_fix_log(p_old, p_new, p_user, 'fixed');
end;
$$;

revoke execute on function public.email_fingerprint(text) from public, anon, authenticated;
revoke execute on function public.svc_signup_fix_gate(text, text) from public, anon, authenticated;
revoke execute on function public.svc_signup_fix_log(text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.svc_signup_email_fix(text, text) from public, anon, authenticated;
revoke execute on function public.svc_signup_fix_finish(uuid, text, text) from public, anon, authenticated;
grant execute on function public.svc_signup_fix_gate(text, text) to service_role;
grant execute on function public.svc_signup_fix_log(text, text, uuid, text) to service_role;
grant execute on function public.svc_signup_email_fix(text, text) to service_role;
grant execute on function public.svc_signup_fix_finish(uuid, text, text) to service_role;

commit;
