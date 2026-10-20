-- ROLLBACK of migration 20261014120000_late_payment_conflicts.sql.
-- Puts back the late-payment functions of 20261014110000 (late TXID straight
-- from the browser), the earlier check / approve functions and panel list.
-- LOST: the conflict list (support_claim_conflicts) and the reason history
-- (review_history). Claims stay as they are; a claim that was in a conflict
-- without a TXID stays in manual review. Export the conflicts first:
--   select * from public.admin_list_claim_conflicts(true);
-- Runs as ONE transaction.
begin;
drop function if exists public.admin_list_claim_conflicts(boolean);
drop function if exists public.admin_resolve_claim_conflict(bigint, bigint, text);
drop function if exists public.svc_submit_late_claim(bigint, uuid, text, jsonb);
create or replace function public.submit_support_claim_tx(p_claim_id bigint, p_tx_hash text,
                                                          p_contact_name text default null, p_contact_phone text default null)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx text := lower(trim(coalesce(p_tx_hash, '')));
  v_name text := nullif(regexp_replace(trim(coalesce(p_contact_name, '')), '\s+', ' ', 'g'), '');
  v_phone text := nullif(regexp_replace(trim(coalesce(p_contact_phone, '')), '\s+', ' ', 'g'), '');
  c public.support_claims;
  v_other public.support_claims;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_tx !~ '^0x[0-9a-f]{64}$' then raise exception 'bad_tx_format'; end if;
  if v_name is not null and (char_length(v_name) > 80 or v_name ~ '[[:cntrl:]<>]') then raise exception 'bad_contact_name'; end if;
  if v_phone is not null and v_phone !~ '^[+]?[0-9][0-9 ().-]{5,23}$' then raise exception 'bad_contact_phone'; end if;
  select * into c from public.support_claims where id = p_claim_id and user_id = auth.uid() for update;
  if c.id is null then raise exception 'not_found'; end if;
  if exists (select 1 from public.support_claims where tx_hash = v_tx) then raise exception 'tx_already_used'; end if;

  -- On time: as before.
  if c.status = 'awaiting_payment' and c.expires_at >= now() then
    update public.support_claims set status = 'submitted', tx_hash = v_tx, submitted_at = now(),
           contact_name = v_name, contact_phone = v_phone
     where id = c.id returning * into c;
    return c;
  end if;

  -- Late: the reservation expired (marked or not yet marked) and has no TXID.
  if c.tx_hash is null and (c.status = 'expired' or (c.status = 'awaiting_payment' and c.expires_at < now())) then
    -- One open claim per person: a newer unpaid reservation is canceled; a
    -- claim already in review stops this one.
    select * into v_other from public.support_claims
     where user_id = auth.uid() and id <> c.id and status in ('awaiting_payment', 'submitted', 'manual_review');
    if v_other.id is not null then
      if v_other.status <> 'awaiting_payment' then raise exception 'claim_in_review'; end if;
      update public.support_claims set status = 'canceled' where id = v_other.id;
    end if;
    update public.support_claims
       set status = 'manual_review', late = true, review_reason = 'reserva_vencida',
           tx_hash = v_tx, submitted_at = now(), contact_name = v_name, contact_phone = v_phone
     where id = c.id returning * into c;
    return c;
  end if;

  raise exception 'not_awaiting_payment';
end;
$$;
revoke execute on function public.submit_support_claim_tx(bigint, text, text, text) from public, anon;
grant execute on function public.submit_support_claim_tx(bigint, text, text, text) to authenticated;
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
  if c.user_id is not null then
    update public.profiles set subscription_status = 'supporter' where id = c.user_id;
  end if;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
  values (p_actor, p_actor_label, 'claim_approved', c.user_id,
          (select email from auth.users where id = c.user_id), p_reason,
          jsonb_build_object('claim_id', c.id, 'amount_units', c.amount_units, 'tx_hash', c.tx_hash,
                             'all_checks_passed', coalesce((c.verification ->> 'all_pass')::boolean, false),
                             'account_deleted', c.user_id is null));
  return c;
end;
$$;
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
drop function if exists public.admin_list_claims(text[]);
create function public.admin_list_claims(p_statuses text[] default array['submitted', 'manual_review'])
returns table (id bigint, user_id uuid, account_email text, flowers integer, amount_usdc text,
               tx_hash text, status text, created_at timestamptz, submitted_at timestamptz,
               expires_at timestamptz, review_reason text, verification jsonb, explorer_url text,
               contact_name text, contact_phone text, account_deleted boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  return query
    select c.id, c.user_id, u.email::text, c.flowers, public.usdc_text(c.amount_units), c.tx_hash, c.status,
           c.created_at, c.submitted_at, c.expires_at, c.review_reason, c.verification,
           case when c.tx_hash is null then null else 'https://basescan.org/tx/' || c.tx_hash end,
           c.contact_name, c.contact_phone, c.user_id is null
      from public.support_claims c left join auth.users u on u.id = c.user_id
     where c.status = any(p_statuses)
     order by coalesce(c.submitted_at, c.created_at);
end;
$$;
revoke execute on function public.admin_list_claims(text[]) from public, anon;
grant execute on function public.admin_list_claims(text[]) to authenticated;
drop function if exists public.claim_flag_conflict(bigint, text);
drop function if exists public.claim_conflict_open(bigint);
drop function if exists public.claim_add_note(bigint, text, text);
drop function if exists public.claim_add_reason(bigint, text, text);
drop table if exists public.support_claim_conflicts;
alter table public.support_claims drop column if exists review_history;
commit;
