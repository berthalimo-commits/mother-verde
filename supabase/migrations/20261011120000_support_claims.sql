-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- One-time support contribution with a UNIQUE AMOUNT per request, verified
-- automatically on the Base network (when switched on) and/or by hand.
-- Requires 20261010120000 (statuses), 20261010130000 (app_config) and
-- 20261011100000 (admins + audit log).
--
-- Flow
--   1. The person picks N flowers -> create_support_claim(N) reserves an
--      amount nobody else has open: N x 10 USDC + 0.0001 … 0.0099 (4 decimals,
--      because some wallets round). Valid for claim_expiry_hours (72 h).
--   2. They send exactly that amount and give the transaction code ->
--      submit_support_claim_tx(id, code)  -> status 'submitted'.
--   3. Verification (Edge Function support-claims):
--        automatic, only if app_config claim_auto_verify_enabled = 1 and the
--        amount is <= claim_auto_max_usdc: activates when EVERY check passes,
--        otherwise -> 'manual_review' with the reason written;
--        manual: an admin (with MFA) or the owner in the SQL Editor approves
--        or rejects, with a reason when the checks didn't all pass.
--   Approving turns the account into 'supporter'. Every decision is logged
--   in admin_audit_log.
--
-- Amounts are stored in USDC base units (6 decimals): 10 USDC = 10,000,000.
--
-- Browser rules (enforced here): it can only read its own claims and act
-- through the three functions below; it can never write status, amount or
-- review fields. One open claim per person. A transaction code can be used
-- only once, by anyone. Stored: account, flowers, amount, status, dates,
-- transaction code, verification result, review reason. No IP or device data.

insert into public.app_config (key, value, note) values
  ('claim_expiry_hours', 72, 'Hours a reserved amount stays valid.'),
  ('claim_min_confirmations', 30, 'Base blocks after the transfer before it counts (~1 minute).'),
  ('claim_auto_max_usdc', 100, 'Above this many USDC a claim is never activated automatically.'),
  ('claim_auto_verify_enabled', 0, '1 = automatic activation on (needs the owner''s written approval).')
on conflict (key) do nothing;

create table if not exists public.support_claims (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  flowers        integer not null check (flowers between 1 and 10),
  amount_units   bigint not null check (amount_units > 0),
  status         text not null default 'awaiting_payment'
                 check (status in ('awaiting_payment', 'submitted', 'manual_review',
                                   'approved', 'rejected', 'expired', 'canceled')),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  tx_hash        text check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  submitted_at   timestamptz,
  verification   jsonb,
  review_reason  text check (review_reason is null or char_length(review_reason) <= 500),
  reviewed_at    timestamptz,
  reviewed_by    uuid,
  reviewed_label text
);

-- One open claim per person; an open amount belongs to one claim only;
-- a transaction code is used once, ever.
create unique index if not exists support_claims_one_open
  on public.support_claims (user_id) where status in ('awaiting_payment', 'submitted', 'manual_review');
create unique index if not exists support_claims_amount_open
  on public.support_claims (amount_units) where status in ('awaiting_payment', 'submitted', 'manual_review');
create unique index if not exists support_claims_tx_once
  on public.support_claims (tx_hash) where tx_hash is not null;

alter table public.support_claims enable row level security;
revoke all on public.support_claims from anon, authenticated;
grant select on public.support_claims to authenticated;
drop policy if exists "support_claims_select_own" on public.support_claims;
create policy "support_claims_select_own" on public.support_claims
  for select to authenticated using (user_id = auth.uid());

create or replace function public.app_config_value(p_key text, p_default integer)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.app_config where key = p_key), p_default);
$$;

-- Mark reserved amounts whose time ran out (frees the amount for others).
create or replace function public.expire_support_claims()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.support_claims set status = 'expired'
   where status = 'awaiting_payment' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 1. Reserve a unique amount for N flowers (or return the open one).
create or replace function public.create_support_claim(p_flowers integer)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_open public.support_claims;
  v_status text;
  v_base bigint;
  v_try integer;
  v_suffix integer;
  v_amount bigint;
  c public.support_claims;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'email_not_confirmed';
  end if;
  if p_flowers is null or p_flowers < 1 or p_flowers > 10 then raise exception 'bad_flowers'; end if;
  select subscription_status into v_status from public.profiles where id = v_uid;
  if v_status = 'supporter' then raise exception 'already_supporter'; end if;
  if v_status = 'revoked' then raise exception 'not_allowed'; end if;

  perform public.expire_support_claims();

  select * into v_open from public.support_claims
   where user_id = v_uid and status in ('awaiting_payment', 'submitted', 'manual_review');
  if v_open.id is not null then
    if v_open.status <> 'awaiting_payment' then raise exception 'claim_in_review'; end if;
    if v_open.flowers = p_flowers then return v_open; end if;
    update public.support_claims set status = 'canceled' where id = v_open.id;
  end if;

  v_base := p_flowers::bigint * 10 * 1000000;
  -- Random suffix 0.0001 … 0.0099 USDC (= 100 … 9,900 base units), not used
  -- by any other open claim.
  for v_try in 1..60 loop
    v_suffix := 1 + floor(random() * 99)::integer;
    v_amount := v_base + v_suffix * 100;
    exit when not exists (select 1 from public.support_claims
                           where amount_units = v_amount
                             and status in ('awaiting_payment', 'submitted', 'manual_review'));
    v_amount := null;
  end loop;
  if v_amount is null then
    select v_base + s * 100 into v_amount
      from generate_series(1, 99) s
     where not exists (select 1 from public.support_claims
                        where amount_units = v_base + s * 100
                          and status in ('awaiting_payment', 'submitted', 'manual_review'))
     limit 1;
  end if;
  if v_amount is null then raise exception 'busy_try_later'; end if;

  insert into public.support_claims (user_id, flowers, amount_units, expires_at)
  values (v_uid, p_flowers, v_amount,
          now() + make_interval(hours => public.app_config_value('claim_expiry_hours', 72)))
  returning * into c;
  return c;
end;
$$;

-- 2. Give the transaction code of the payment.
create or replace function public.submit_support_claim_tx(p_claim_id bigint, p_tx_hash text)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx text := lower(trim(coalesce(p_tx_hash, '')));
  c public.support_claims;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_tx !~ '^0x[0-9a-f]{64}$' then raise exception 'bad_tx_format'; end if;
  select * into c from public.support_claims where id = p_claim_id and user_id = auth.uid();
  if c.id is null then raise exception 'not_found'; end if;
  if c.status <> 'awaiting_payment' then raise exception 'not_awaiting_payment'; end if;
  if c.expires_at < now() then
    update public.support_claims set status = 'expired' where id = c.id;
    raise exception 'expired';
  end if;
  if exists (select 1 from public.support_claims where tx_hash = v_tx) then raise exception 'tx_already_used'; end if;
  update public.support_claims set status = 'submitted', tx_hash = v_tx, submitted_at = now()
   where id = c.id returning * into c;
  return c;
end;
$$;

-- 3. Cancel an unpaid reservation (e.g. to pick a different number of flowers).
create or replace function public.cancel_my_support_claim(p_claim_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.support_claims set status = 'canceled'
   where id = p_claim_id and user_id = auth.uid() and status = 'awaiting_payment';
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- ---------------------------------------------------------------- server side
-- Store the result of an on-chain check (Edge Function, service role).
-- p_to_manual = true moves the claim to 'manual_review' with the reason.
create or replace function public.svc_record_claim_check(p_claim_id bigint, p_verification jsonb, p_to_manual boolean, p_reason text)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare c public.support_claims;
begin
  update public.support_claims
     set verification = p_verification,
         status = case when p_to_manual and status = 'submitted' then 'manual_review' else status end,
         review_reason = case when p_to_manual then left(p_reason, 500) else review_reason end
   where id = p_claim_id and status in ('submitted', 'manual_review')
   returning * into c;
  if c.id is null then raise exception 'not_found_or_closed'; end if;
  return c;
end;
$$;

-- Approve: claim -> 'approved', account -> 'supporter', audit log.
-- Internal; called by the functions below and by the Edge Function.
create or replace function public.svc_approve_claim(p_claim_id bigint, p_actor uuid, p_actor_label text, p_reason text)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare c public.support_claims;
begin
  update public.support_claims
     set status = 'approved', reviewed_at = now(), reviewed_by = p_actor,
         reviewed_label = p_actor_label, review_reason = left(p_reason, 500)
   where id = p_claim_id and status in ('submitted', 'manual_review')
   returning * into c;
  if c.id is null then raise exception 'not_found_or_closed'; end if;
  update public.profiles set subscription_status = 'supporter' where id = c.user_id;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
  values (p_actor, p_actor_label, 'claim_approved', c.user_id,
          (select email from auth.users where id = c.user_id), p_reason,
          jsonb_build_object('claim_id', c.id, 'amount_units', c.amount_units, 'tx_hash', c.tx_hash,
                             'all_checks_passed', coalesce((c.verification ->> 'all_pass')::boolean, false)));
  return c;
end;
$$;

-- ---------------------------------------------------------------- admins
-- List claims (admins with MFA, or the SQL Editor).
create or replace function public.admin_list_claims(p_statuses text[] default array['submitted', 'manual_review'])
returns table (id bigint, user_id uuid, account_email text, flowers integer, amount_usdc numeric,
               tx_hash text, status text, created_at timestamptz, submitted_at timestamptz,
               expires_at timestamptz, review_reason text, verification jsonb, explorer_url text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  return query
    select c.id, c.user_id, u.email::text, c.flowers, round(c.amount_units / 1000000.0, 4), c.tx_hash, c.status,
           c.created_at, c.submitted_at, c.expires_at, c.review_reason, c.verification,
           case when c.tx_hash is null then null else 'https://basescan.org/tx/' || c.tx_hash end
      from public.support_claims c join auth.users u on u.id = c.user_id
     where c.status = any(p_statuses)
     order by coalesce(c.submitted_at, c.created_at);
end;
$$;

-- Approve by hand. If the stored on-chain check didn't pass every point, a
-- written reason is mandatory.
create or replace function public.admin_approve_claim(p_claim_id bigint, p_reason text default null)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.support_claims;
  v_label text;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  select * into c from public.support_claims where id = p_claim_id;
  if c.id is null then raise exception 'not_found'; end if;
  if not coalesce((c.verification ->> 'all_pass')::boolean, false)
     and char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'reason_required';
  end if;
  v_label := case when auth.uid() is null then 'sql-editor'
                  else coalesce((select email from auth.users where id = auth.uid()), auth.uid()::text) end;
  return public.svc_approve_claim(p_claim_id, auth.uid(), v_label, p_reason);
end;
$$;

create or replace function public.admin_reject_claim(p_claim_id bigint, p_reason text)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.support_claims;
  v_label text;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  v_label := case when auth.uid() is null then 'sql-editor'
                  else coalesce((select email from auth.users where id = auth.uid()), auth.uid()::text) end;
  update public.support_claims
     set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), reviewed_label = v_label,
         review_reason = left(p_reason, 500)
   where id = p_claim_id and status in ('submitted', 'manual_review', 'awaiting_payment')
   returning * into c;
  if c.id is null then raise exception 'not_found_or_closed'; end if;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
  values (auth.uid(), v_label, 'claim_rejected', c.user_id, (select email from auth.users where id = c.user_id),
          p_reason, jsonb_build_object('claim_id', c.id, 'tx_hash', c.tx_hash));
  return c;
end;
$$;

-- Privileges: the browser gets the three own-claim functions and the two
-- admin functions (which check admin + MFA inside); the rest is server-only.
revoke execute on function public.app_config_value(text, integer) from public, anon, authenticated;
revoke execute on function public.expire_support_claims() from public, anon, authenticated;
revoke execute on function public.svc_record_claim_check(bigint, jsonb, boolean, text) from public, anon, authenticated;
revoke execute on function public.svc_approve_claim(bigint, uuid, text, text) from public, anon, authenticated;
grant execute on function public.app_config_value(text, integer) to service_role;
grant execute on function public.expire_support_claims() to service_role;
grant execute on function public.svc_record_claim_check(bigint, jsonb, boolean, text) to service_role;
grant execute on function public.svc_approve_claim(bigint, uuid, text, text) to service_role;
revoke execute on function public.create_support_claim(integer) from public, anon;
revoke execute on function public.submit_support_claim_tx(bigint, text) from public, anon;
revoke execute on function public.cancel_my_support_claim(bigint) from public, anon;
revoke execute on function public.admin_list_claims(text[]) from public, anon;
revoke execute on function public.admin_approve_claim(bigint, text) from public, anon;
revoke execute on function public.admin_reject_claim(bigint, text) from public, anon;
grant execute on function public.create_support_claim(integer) to authenticated;
grant execute on function public.submit_support_claim_tx(bigint, text) to authenticated;
grant execute on function public.cancel_my_support_claim(bigint) to authenticated;
grant execute on function public.admin_list_claims(text[]) to authenticated;
grant execute on function public.admin_approve_claim(bigint, text) to authenticated;
grant execute on function public.admin_reject_claim(bigint, text) to authenticated;

commit;
