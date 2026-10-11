-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- Gift codes, "give N days" and "revoke access (fraud)".
-- Requires 20261010120000 (profiles.access_until, status 'revoked') and
-- 20261011100000 (admins, audit log).
--
-- Gift codes
--   * Only the SHA-256 of the code is stored, never the code. The code is
--     shown in full once, when it is created (or e-mailed once by
--     admin-send-gift-code).
--   * 12 characters from an alphabet without look-alikes (no I, O, 0, 1),
--     about 60 bits of randomness, shown as XXXX-XXXX-XXXX.
--   * One use. Days of access (default 7). Must be redeemed before expires_at.
--   * Redeeming adds days to profiles.access_until, starting from whichever is
--     later: now, the end of a running trial, or access already granted. The
--     trial columns are never touched, so "one trial per account" holds.
--   * A 'supporter' account doesn't use up the code (it already has access).
--   * 5 failed attempts in 24 h lock redeeming for that account; every
--     failure answers the same generic error, never saying whether a code
--     existed.
--   * Limits for creating/sending: 20 codes per day in total, 3 per e-mail
--     address ever.

create table if not exists public.gift_codes (
  id             bigint generated always as identity primary key,
  code_hash      text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  days           integer not null default 7 check (days between 1 and 365),
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  created_label  text not null,
  sent_to_email  text,
  send_status    text not null default 'not_sent' check (send_status in ('not_sent', 'sending', 'sent', 'failed')),
  status         text not null default 'active' check (status in ('active', 'used', 'revoked')),
  used_by        uuid references auth.users(id) on delete set null,
  used_at        timestamptz,
  revoked_at     timestamptz,
  revoked_reason text
);
create index if not exists gift_codes_created_idx on public.gift_codes (created_at desc);
create index if not exists gift_codes_email_idx on public.gift_codes (lower(sent_to_email));
alter table public.gift_codes enable row level security;
revoke all on public.gift_codes from anon, authenticated;

create table if not exists public.gift_redeem_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  at      timestamptz not null default now(),
  ok      boolean not null
);
create index if not exists gift_redeem_attempts_user_idx on public.gift_redeem_attempts (user_id, at desc);
alter table public.gift_redeem_attempts enable row level security;
revoke all on public.gift_redeem_attempts from anon, authenticated;

-- Same normalization as the Edge Function: upper case, letters and digits only.
create or replace function public.gift_code_hash(p_code text)
returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'), 'UTF8')), 'hex');
$$;

-- 12 random characters from 32 symbols (byte % 32 is uniform). Uses the
-- random bytes of gen_random_uuid(), skipping the version/variant bytes.
create or replace function public.gift_code_generate()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex');
  positions constant integer[] := array[0,1,2,3,4,5,7,9,10,11,12,13];
  code text := '';
  i integer;
begin
  foreach i in array positions loop
    code := code || substr(alphabet, 1 + (get_byte(b, i) % 32), 1);
  end loop;
  return substr(code, 1, 4) || '-' || substr(code, 5, 4) || '-' || substr(code, 9, 4);
end;
$$;

create or replace function public.gift_codes_created_today()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.gift_codes where created_at >= date_trunc('day', now());
$$;

-- ---------------------------------------------------------------- redeem
create or replace function public.redeem_gift_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_failures integer;
  g public.gift_codes;
  p public.profiles;
  v_from timestamptz;
  v_until timestamptz;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'email_not_confirmed';
  end if;
  select count(*) into v_failures from public.gift_redeem_attempts
   where user_id = v_uid and not ok and at > now() - interval '24 hours';
  if v_failures >= 5 then raise exception 'too_many_attempts'; end if;

  select * into p from public.profiles where id = v_uid;
  select * into g from public.gift_codes
   where code_hash = public.gift_code_hash(p_code) and status = 'active' and expires_at > now()
   for update;
  if g.id is null or p.subscription_status = 'revoked' then
    insert into public.gift_redeem_attempts (user_id, ok) values (v_uid, false);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if p.subscription_status = 'supporter' then
    -- Valid code, but the account already has full access: don't use it up.
    return jsonb_build_object('ok', false, 'error', 'already_full_access');
  end if;

  v_from := greatest(now(),
                     coalesce(p.access_until, now()),
                     case when p.subscription_status = 'trialing' then coalesce(p.trial_ends_at, now()) else now() end);
  v_until := v_from + make_interval(days => g.days);
  update public.gift_codes set status = 'used', used_by = v_uid, used_at = now() where id = g.id;
  update public.profiles set access_until = v_until where id = v_uid;
  insert into public.gift_redeem_attempts (user_id, ok) values (v_uid, true);
  return jsonb_build_object('ok', true, 'days', g.days, 'access_until', v_until);
end;
$$;

-- ---------------------------------------------------------------- admins
create or replace function public.admin_actor_label()
returns text language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then 'sql-editor'
              else coalesce((select email from auth.users where id = auth.uid()), auth.uid()::text) end;
$$;

-- Create codes to hand out yourself. Returns each code ONCE.
create or replace function public.admin_create_gift_codes(p_count integer default 1, p_days integer default 7, p_valid_days integer default 30)
returns table (code text, days integer, redeem_before timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  i integer;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  if p_count is null or p_count < 1 or p_count > 20 then raise exception 'bad_count'; end if;
  if public.gift_codes_created_today() + p_count > 20 then raise exception 'daily_limit_20'; end if;
  for i in 1..p_count loop
    v_code := public.gift_code_generate();
    insert into public.gift_codes (code_hash, days, expires_at, created_by, created_label)
    values (public.gift_code_hash(v_code), p_days, now() + make_interval(days => p_valid_days), auth.uid(), public.admin_actor_label());
    code := v_code; days := p_days; redeem_before := now() + make_interval(days => p_valid_days);
    return next;
  end loop;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, reason, details)
  values (auth.uid(), public.admin_actor_label(), 'gift_codes_created', null,
          jsonb_build_object('count', p_count, 'days', p_days, 'valid_days', p_valid_days));
end;
$$;

-- E-mailed codes (Edge Function admin-send-gift-code, service role). The
-- function generates the code itself and passes only its hash here.
create or replace function public.svc_reserve_sent_gift_code(p_hash text, p_email text, p_days integer, p_valid_days integer, p_actor uuid, p_actor_label text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_email text := lower(trim(p_email));
begin
  perform pg_advisory_xact_lock(hashtext('gift_codes_send'));
  if public.gift_codes_created_today() >= 20 then raise exception 'daily_limit_20'; end if;
  if (select count(*) from public.gift_codes where lower(sent_to_email) = v_email) >= 3 then
    raise exception 'email_limit_3';
  end if;
  insert into public.gift_codes (code_hash, days, expires_at, created_by, created_label, sent_to_email, send_status)
  values (p_hash, p_days, now() + make_interval(days => p_valid_days), p_actor, p_actor_label, v_email, 'sending')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.svc_finish_sent_gift_code(p_id bigint, p_sent boolean, p_error text, p_actor uuid, p_actor_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare g public.gift_codes;
begin
  if p_sent then
    update public.gift_codes set send_status = 'sent' where id = p_id returning * into g;
  else
    -- The e-mail didn't go out: the code is voided, nobody can use it.
    update public.gift_codes set send_status = 'failed', status = 'revoked', revoked_at = now(),
           revoked_reason = left('email_failed: ' || coalesce(p_error, ''), 500)
     where id = p_id returning * into g;
  end if;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_email, reason, details)
  values (p_actor, p_actor_label, case when p_sent then 'gift_code_sent' else 'gift_code_send_failed' end,
          g.sent_to_email, case when p_sent then null else left(p_error, 300) end,
          jsonb_build_object('gift_code_id', g.id, 'days', g.days, 'expires_at', g.expires_at));
end;
$$;

create or replace function public.admin_list_gift_codes(p_limit integer default 200)
returns table (id bigint, created_at timestamptz, created_label text, sent_to_email text, days integer,
               expires_at timestamptz, state text, used_by_email text, used_at timestamptz, revoked_reason text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  return query
    select g.id, g.created_at, g.created_label, g.sent_to_email, g.days, g.expires_at,
           case when g.status = 'revoked' then 'anulado'
                when g.status = 'used' then 'usado'
                when g.expires_at <= now() then 'vencido'
                when g.send_status = 'sent' then 'enviado'
                else 'creado' end,
           u.email::text, g.used_at, g.revoked_reason
      from public.gift_codes g left join auth.users u on u.id = g.used_by
     order by g.created_at desc
     limit least(greatest(p_limit, 1), 1000);
end;
$$;

create or replace function public.admin_revoke_gift_code(p_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  update public.gift_codes set status = 'revoked', revoked_at = now(), revoked_reason = left(p_reason, 500)
   where id = p_id and status = 'active';
  if not found then raise exception 'not_found_or_not_active'; end if;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, reason, details)
  values (auth.uid(), public.admin_actor_label(), 'gift_code_revoked', p_reason, jsonb_build_object('gift_code_id', p_id));
end;
$$;

-- Give N days of full access to an account (by e-mail).
create or replace function public.admin_grant_days(p_email text, p_days integer, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  p public.profiles;
  v_until timestamptz;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  if p_days is null or p_days < 1 or p_days > 365 then raise exception 'bad_days'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'account_not_found'; end if;
  select * into p from public.profiles where id = v_uid;
  v_until := greatest(now(), coalesce(p.access_until, now()),
                      case when p.subscription_status = 'trialing' then coalesce(p.trial_ends_at, now()) else now() end)
             + make_interval(days => p_days);
  update public.profiles set access_until = v_until where id = v_uid;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
  values (auth.uid(), public.admin_actor_label(), 'days_granted', v_uid, lower(trim(p_email)), p_reason,
          jsonb_build_object('days', p_days, 'access_until', v_until));
  return v_until;
end;
$$;

-- Take access away (fraud). Doesn't delete the account; the person keeps
-- their account, Bitácora and the right to delete everything.
create or replace function public.admin_revoke_access(p_email text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_prev text;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'account_not_found'; end if;
  select subscription_status into v_prev from public.profiles where id = v_uid;
  update public.profiles set subscription_status = 'revoked', access_until = null where id = v_uid;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
  values (auth.uid(), public.admin_actor_label(), 'access_revoked', v_uid, lower(trim(p_email)), p_reason,
          jsonb_build_object('previous_status', v_prev));
end;
$$;

revoke execute on function public.gift_code_hash(text) from public, anon, authenticated;
revoke execute on function public.gift_code_generate() from public, anon, authenticated;
revoke execute on function public.gift_codes_created_today() from public, anon, authenticated;
revoke execute on function public.admin_actor_label() from public, anon, authenticated;
revoke execute on function public.svc_reserve_sent_gift_code(text, text, integer, integer, uuid, text) from public, anon, authenticated;
revoke execute on function public.svc_finish_sent_gift_code(bigint, boolean, text, uuid, text) from public, anon, authenticated;
grant execute on function public.svc_reserve_sent_gift_code(text, text, integer, integer, uuid, text) to service_role;
grant execute on function public.svc_finish_sent_gift_code(bigint, boolean, text, uuid, text) to service_role;
revoke execute on function public.redeem_gift_code(text) from public, anon;
grant execute on function public.redeem_gift_code(text) to authenticated;
revoke execute on function public.admin_create_gift_codes(integer, integer, integer) from public, anon;
revoke execute on function public.admin_list_gift_codes(integer) from public, anon;
revoke execute on function public.admin_revoke_gift_code(bigint, text) from public, anon;
revoke execute on function public.admin_grant_days(text, integer, text) from public, anon;
revoke execute on function public.admin_revoke_access(text, text) from public, anon;
grant execute on function public.admin_create_gift_codes(integer, integer, integer) to authenticated;
grant execute on function public.admin_list_gift_codes(integer) to authenticated;
grant execute on function public.admin_revoke_gift_code(bigint, text) to authenticated;
grant execute on function public.admin_grant_days(text, integer, text) to authenticated;
grant execute on function public.admin_revoke_access(text, text) to authenticated;

commit;
