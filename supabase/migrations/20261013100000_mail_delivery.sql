-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- E-mail delivery: nobody should be left out because an e-mail didn't arrive.
-- Requires 20261010120000 (profiles.email_normalized, blocked_email_domains,
-- normalize_email) and 20261011100000 (admins, audit log).
--
--   * mail_events: one row per e-mail our functions try to send (gift code,
--     activation, test) and per self-service correction of a sign-up e-mail.
--     No e-mail addresses and no codes: the kind, whether it went out, which
--     provider, how many attempts, the error with any address blanked out,
--     and the account id when there is one. Read only by admins (panel:
--     "Correos fallidos en las últimas 24 h" and Registro).
--   * profiles.email_normalized follows auth.users.email when the sign-in
--     e-mail changes (Cuenta -> "Cambiar", or a corrected sign-up e-mail), so
--     the "one account per address" check keeps looking at the real address.
--   * svc_signup_email_fix: the checks before an unconfirmed account gets its
--     mistyped e-mail corrected (function signup-fix-email).

create table if not exists public.mail_events (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  kind      text not null,
  ok        boolean not null,
  provider  text,
  attempts  integer not null default 1,
  error     text,
  user_id   uuid,
  ref       text
);
create index if not exists mail_events_at_idx on public.mail_events (at desc);
alter table public.mail_events enable row level security;
revoke all on public.mail_events from anon, authenticated;

-- Any e-mail address in an error message becomes <correo>.
create or replace function public.redact_emails(p text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p, ''), '[^[:space:]<>"''(),;:]+@[^[:space:]<>"''(),;:]+', '<correo>', 'g');
$$;

create or replace function public.svc_mail_event(p_kind text, p_ok boolean, p_provider text, p_attempts integer,
                                                 p_error text, p_user uuid default null, p_ref text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mail_events (kind, ok, provider, attempts, error, user_id, ref)
  values (left(p_kind, 40), p_ok, left(p_provider, 40), greatest(coalesce(p_attempts, 1), 1),
          nullif(left(public.redact_emails(p_error), 300), ''), p_user, left(p_ref, 60));
end;
$$;

-- Keep email_normalized in step with the sign-in e-mail.
create or replace function public.sync_email_normalized()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email_normalized = public.normalize_email(new.email) where id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.sync_email_normalized() from public, anon, authenticated;
drop trigger if exists on_auth_email_changed on auth.users;
create trigger on_auth_email_changed
  after update of email on auth.users
  for each row execute function public.sync_email_normalized();

-- Correcting a mistyped sign-up e-mail: the account must still be
-- unconfirmed and recent (7 days), and the new address must pass the same
-- rules as a new sign-up (hook_before_user_created): not a blocked domain,
-- no other account with it. Returns the account id. The password was already
-- checked by the function. Errors: bad_email, not_found, not_allowed.
create or replace function public.svc_signup_email_fix(p_old text, p_new text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_new text := lower(trim(coalesce(p_new, '')));
  v_dom text;
begin
  if v_new !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'bad_email'; end if;
  select id into v_id from auth.users
   where lower(email) = lower(trim(coalesce(p_old, ''))) and email_confirmed_at is null
     and created_at > now() - interval '7 days';
  if v_id is null then raise exception 'not_found'; end if;
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

revoke execute on function public.svc_mail_event(text, boolean, text, integer, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.svc_signup_email_fix(text, text) from public, anon, authenticated;
grant execute on function public.svc_mail_event(text, boolean, text, integer, text, uuid, text) to service_role;
grant execute on function public.svc_signup_email_fix(text, text) to service_role;

commit;
