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
  if v_email !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' or char_length(v_email) > 254 then raise exception 'bad_email'; end if;
  if exists (select 1 from public.blocked_email_domains b
             where split_part(v_email, '@', 2) = b.domain or split_part(v_email, '@', 2) like '%.' || b.domain) then
    raise exception 'blocked_domain';
  end if;
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

-- ---------------------------------------------------------------- admin views
-- Users, one user's file, summary and CSV export, for the admin panel.
-- Admins with MFA (aal2) or the SQL Editor only. Account and access data
-- ONLY: never Bitácora entries, photos, posts or comments (only the person
-- sees those). Opening one user's file and every CSV export are written to
-- admin_audit_log (never the exported data itself); loading a list is not.

insert into public.app_config (key, value, note) values
  ('csv_export_max_rows', 5000, 'Maximum rows in one CSV export from the admin panel.')
on conflict (key) do nothing;

-- Access state shown in the panel (Spanish codes, translated in the panel).
create or replace function public.admin_access_state(p public.profiles)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p.subscription_status = 'revoked' then 'bloqueado'
    when p.subscription_status = 'supporter' then 'acceso_completo'
    when p.access_until is not null and p.access_until > now() then 'regalo'
    when p.subscription_status = 'trialing' and p.trial_ends_at > now() then 'prueba_activa'
    when public.is_premium(p.id) then 'acceso_completo'
    when p.trial_started_at is not null then 'prueba_vencida'
    else 'sin_prueba' end;
$$;

-- Internal: one row per account with what the panel may show.
create or replace function public.svc_users_view()
returns table (user_id uuid, email text, display_name text, country text, lang text, state text,
               created_at timestamptz, trial_ends_at timestamptz, access_until timestamptz,
               contact_name text, contact_phone text)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, coalesce(m.display_name, p.display_name), m.country, p.preferred_lang,
         public.admin_access_state(p), u.created_at, p.trial_ends_at, p.access_until,
         ct.contact_name, ct.contact_phone
    from auth.users u
    join public.profiles p on p.id = u.id
    left join public.community_members m on m.user_id = u.id
    left join lateral (
      select c.contact_name, c.contact_phone from public.support_claims c
       where c.user_id = u.id and (c.contact_name is not null or c.contact_phone is not null)
       order by c.created_at desc limit 1) ct on true;
$$;

create or replace function public.admin_list_users(p_search text default null, p_state text default null,
                                                   p_limit integer default 50, p_offset integer default 0)
returns table (user_id uuid, email text, display_name text, country text, lang text, state text,
               created_at timestamptz, trial_ends_at timestamptz, access_until timestamptz,
               contact_name text, contact_phone text, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  if nullif(p_state, '') is not null and p_state not in ('prueba_activa', 'prueba_vencida', 'acceso_completo', 'regalo', 'bloqueado', 'sin_prueba') then
    raise exception 'bad_state';
  end if;
  if v_q is not null then v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
    select v.*, count(*) over ()
      from public.svc_users_view() v
     where (v_q is null or v.email ilike v_q or v.display_name ilike v_q)
       and (nullif(p_state, '') is null or v.state = p_state)
     order by v.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- One user's file: account data + contribution claims + redeemed gift codes.
-- Every call is logged ('user_viewed').
create or replace function public.admin_get_user(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  v_email text;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  select to_jsonb(x), x.email into v, v_email from public.svc_users_view() x where x.user_id = p_user_id;
  if v is null then raise exception 'not_found'; end if;
  v := v || jsonb_build_object(
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'status', c.status, 'flowers', c.flowers,
                          'amount_usdc', public.usdc_text(c.amount_units), 'created_at', c.created_at,
                          'submitted_at', c.submitted_at, 'tx_hash', c.tx_hash, 'review_reason', c.review_reason,
                          'reviewed_at', c.reviewed_at) order by c.created_at desc)
                         from public.support_claims c where c.user_id = p_user_id), '[]'::jsonb),
    'gift_codes', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'days', g.days, 'used_at', g.used_at) order by g.used_at desc)
                             from public.gift_codes g where g.used_by = p_user_id), '[]'::jsonb));
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email)
  values (auth.uid(), public.admin_actor_label(), 'user_viewed', p_user_id, v_email);
  return v;
end;
$$;

create or replace function public.admin_summary()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  select jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'states', coalesce((select jsonb_object_agg(st, n) from (select public.admin_access_state(p) st, count(*) n from public.profiles p group by 1) s), '{}'::jsonb),
    'claims', coalesce((select jsonb_object_agg(k, n) from (
                 select case when status in ('awaiting_payment', 'submitted') then 'pendiente'
                             when status = 'manual_review' then 'en_revision'
                             when status = 'rejected' then 'rechazado'
                             when status = 'approved' then 'activado'
                             else 'vencido_o_cancelado' end k, count(*) n
                   from public.support_claims group by 1) s), '{}'::jsonb),
    'usdc_activated', coalesce((select public.usdc_text(sum(amount_units)::bigint) from public.support_claims where status = 'approved'), '0.0000'))
  into v;
  return v;
end;
$$;

-- One CSV cell: neutralises formula injection (=, +, -, @, tab, CR at the
-- start get a leading apostrophe) and quotes the value.
create or replace function public.csv_cell(p text)
returns text language sql immutable set search_path = public as $$
  select case when p is null then ''
              else '"' || replace(case when p ~ '^[-=+@\t\r]' then '''' || p else p end, '"', '""') || '"' end;
$$;

-- CSV export (UTF-8 with BOM, comma separated, CRLF). Tabs: users, claims,
-- gifts, audit. At most app_config csv_export_max_rows rows (5000). Logged
-- with tab, filters, rows and whether it was cut — never the data.
create or replace function public.admin_export_csv(p_tab text, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_max integer := public.app_config_value('csv_export_max_rows', 5000);
  v_head text;
  v_lines text[];
  v_q text := nullif(trim(coalesce(p_filters ->> 'search', '')), '');
  v_state text := nullif(p_filters ->> 'state', '');
  v_statuses text[];
  v_truncated boolean := false;
  ts constant text := 'YYYY-MM-DD HH24:MI';
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  if v_q is not null then v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  if p_tab = 'users' then
    v_head := 'email,display_name,country,language,access_state,created_utc,trial_ends_utc,access_until_utc,contact_name,contact_phone';
    select array_agg(line) into v_lines from (
      select concat_ws(',', csv_cell(v.email), csv_cell(v.display_name), csv_cell(v.country), csv_cell(v.lang), csv_cell(v.state),
                       csv_cell(to_char(v.created_at at time zone 'UTC', ts)), csv_cell(to_char(v.trial_ends_at at time zone 'UTC', ts)),
                       csv_cell(to_char(v.access_until at time zone 'UTC', ts)), csv_cell(v.contact_name), csv_cell(v.contact_phone)) line
        from public.svc_users_view() v
       where (v_q is null or v.email ilike v_q or v.display_name ilike v_q) and (v_state is null or v.state = v_state)
       order by v.created_at desc limit v_max + 1) s;
  elsif p_tab = 'claims' then
    v_head := 'id,email,flowers,amount_usdc,status,created_utc,submitted_utc,expires_utc,tx_hash,review_reason,reviewed_utc,reviewed_by';
    select coalesce(array_agg(x), null) into v_statuses from jsonb_array_elements_text(coalesce(p_filters -> 'statuses', '[]'::jsonb)) x;
    select array_agg(line) into v_lines from (
      select concat_ws(',', c.id::text, csv_cell(u.email::text), c.flowers::text, public.usdc_text(c.amount_units), csv_cell(c.status),
                       csv_cell(to_char(c.created_at at time zone 'UTC', ts)), csv_cell(to_char(c.submitted_at at time zone 'UTC', ts)),
                       csv_cell(to_char(c.expires_at at time zone 'UTC', ts)), csv_cell(c.tx_hash), csv_cell(c.review_reason),
                       csv_cell(to_char(c.reviewed_at at time zone 'UTC', ts)), csv_cell(c.reviewed_label)) line
        from public.support_claims c join auth.users u on u.id = c.user_id
       where v_statuses is null or c.status = any(v_statuses)
       order by c.created_at desc limit v_max + 1) s;
  elsif p_tab = 'gifts' then
    v_head := 'id,created_utc,created_by,sent_to,days,expires_utc,state,used_by,used_utc,void_reason';
    select array_agg(line) into v_lines from (
      select concat_ws(',', g.id::text, csv_cell(to_char(g.created_at at time zone 'UTC', ts)), csv_cell(g.created_label), csv_cell(g.sent_to_email),
                       g.days::text, csv_cell(to_char(g.expires_at at time zone 'UTC', ts)),
                       csv_cell(case when g.status = 'revoked' then 'anulado' when g.status = 'used' then 'usado'
                                     when g.expires_at <= now() then 'vencido' when g.send_status = 'sent' then 'enviado' else 'creado' end),
                       csv_cell(u.email::text), csv_cell(to_char(g.used_at at time zone 'UTC', ts)), csv_cell(g.revoked_reason)) line
        from public.gift_codes g left join auth.users u on u.id = g.used_by
       order by g.created_at desc limit v_max + 1) s;
  elsif p_tab = 'audit' then
    v_head := 'when_utc,who,action,account,reason';
    select array_agg(line) into v_lines from (
      select concat_ws(',', csv_cell(to_char(a.at at time zone 'UTC', ts)), csv_cell(a.actor_label), csv_cell(a.action),
                       csv_cell(a.target_email), csv_cell(a.reason)) line
        from public.admin_audit_log a order by a.at desc limit v_max + 1) s;
  else
    raise exception 'bad_tab';
  end if;
  v_lines := coalesce(v_lines, '{}');
  if array_length(v_lines, 1) > v_max then v_truncated := true; v_lines := v_lines[1:v_max]; end if;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, reason, details)
  values (auth.uid(), public.admin_actor_label(), 'csv_export', p_tab,
          jsonb_build_object('tab', p_tab, 'filters', coalesce(p_filters, '{}'::jsonb), 'rows', coalesce(array_length(v_lines, 1), 0), 'truncated', v_truncated));
  return jsonb_build_object(
    'csv', chr(65279) || v_head || E'\r\n' || array_to_string(v_lines, E'\r\n') || case when array_length(v_lines, 1) > 0 then E'\r\n' else '' end,
    'rows', coalesce(array_length(v_lines, 1), 0), 'truncated', v_truncated,
    'filename', 'mother-verde-' || p_tab || '-' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD') || '.csv');
end;
$$;

revoke execute on function public.admin_access_state(public.profiles) from public, anon, authenticated;
revoke execute on function public.svc_users_view() from public, anon, authenticated;
revoke execute on function public.csv_cell(text) from public, anon, authenticated;
revoke execute on function public.admin_list_users(text, text, integer, integer) from public, anon;
revoke execute on function public.admin_get_user(uuid) from public, anon;
revoke execute on function public.admin_summary() from public, anon;
revoke execute on function public.admin_export_csv(text, jsonb) from public, anon;
grant execute on function public.admin_list_users(text, text, integer, integer) to authenticated;
grant execute on function public.admin_get_user(uuid) to authenticated;
grant execute on function public.admin_summary() to authenticated;
grant execute on function public.admin_export_csv(text, jsonb) to authenticated;

commit;
