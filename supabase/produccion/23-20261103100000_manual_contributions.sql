-- PRODUCCIÓN · archivo 23 de 32 · Aportes manuales (PayPal, Cash App…).
-- Pegar ENTERO y ejecutar una vez. Es una sola transacción: si falla, no se aplica nada de este archivo.
-- Copia exacta de supabase/migrations/20261103100000_manual_contributions.sql (generado por tools/build-produccion.mjs; no editar a mano).

-- Manual contributions (Bertha's decision, 2026-11-03): an admin with the
-- second security step (AAL2) records a contribution paid outside USDC
-- (PayPal, CashApp, bank transfer, cash or another means agreed by e-mail or
-- phone). Saving it gives full access through the SAME function an approved
-- USDC claim uses (svc_grant_full_access), so there is one access rule.
--
-- - amount = what the person PAID; the optional fee is what the payment
--   means kept (bookkeeping only). The 10-per-flower rule applies to the
--   amount paid, and can only be checked for USD / USDC; in another currency
--   the note must explain the equivalence.
-- - Nothing is ever deleted: voiding fills «voided by, when, why». If the
--   person has no other valid contribution left, access goes back to what it
--   was before the first manual contribution.
-- - Duplicate guard: if the person already has an approved USDC claim or an
--   active manual contribution, saving needs «register anyway» + a reason.
-- - Every step goes to the Registro (admin_audit_log).
-- - No e-mail is sent (they are already talking); the flowers are only
--   recorded in the user's file.
-- Runs as ONE transaction. Rollback: supabase/admin/rollback-20261103100000.sql.
begin;

create table if not exists public.manual_contributions (
  id               bigint generated always as identity primary key,
  user_id          uuid references auth.users(id) on delete set null,
  email            text not null check (char_length(email) between 3 and 320),
  method           text not null check (method in ('paypal', 'cashapp', 'transferencia', 'efectivo', 'otro')),
  amount           numeric(12, 2) not null check (amount > 0 and amount <= 1000000),
  currency         text not null check (currency ~ '^[A-Z]{3,4}$'),
  fee              numeric(12, 2) check (fee is null or (fee >= 0 and fee <= amount)),
  reference        text not null check (char_length(reference) between 3 and 500 and reference !~ '[[:cntrl:]<>]'),
  paid_on          date not null,
  flowers          integer not null check (flowers between 1 and 20),
  previous_status  text,
  duplicate_reason text check (duplicate_reason is null or char_length(duplicate_reason) <= 500),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  created_label    text not null,
  voided_at        timestamptz,
  voided_by        uuid,
  voided_label     text,
  void_reason      text check (void_reason is null or char_length(void_reason) <= 500)
);
create index if not exists manual_contributions_user_idx on public.manual_contributions (user_id);
create index if not exists manual_contributions_created_idx on public.manual_contributions (created_at desc);

alter table public.manual_contributions enable row level security;
revoke all on public.manual_contributions from anon, authenticated;

-- Nothing is deleted and a saved contribution never changes, except being
-- voided once (and user_id becoming null when the account is deleted).
create or replace function public.manual_contributions_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'manual_contributions_no_delete'; end if;
  if (new.id, new.email, new.method, new.amount, new.currency, new.fee, new.reference, new.paid_on, new.flowers,
      new.previous_status, new.duplicate_reason, new.created_at, new.created_by, new.created_label)
     is distinct from
     (old.id, old.email, old.method, old.amount, old.currency, old.fee, old.reference, old.paid_on, old.flowers,
      old.previous_status, old.duplicate_reason, old.created_at, old.created_by, old.created_label)
     or (old.voided_at is not null and (new.voided_at, new.voided_by, new.voided_label, new.void_reason)
                                        is distinct from (old.voided_at, old.voided_by, old.voided_label, old.void_reason))
     or (new.user_id is distinct from old.user_id and new.user_id is not null) then
    raise exception 'manual_contributions_read_only';
  end if;
  return new;
end;
$$;
drop trigger if exists manual_contributions_guard on public.manual_contributions;
create trigger manual_contributions_guard before update or delete on public.manual_contributions
  for each row execute function public.manual_contributions_guard();

-- ---------------------------------------------------------------------------
-- The one access rule: full access = subscription_status 'supporter'.
-- Returns the status the account had before.
-- ---------------------------------------------------------------------------
create or replace function public.svc_grant_full_access(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_prev text;
begin
  if p_user_id is null then return null; end if;
  select subscription_status into v_prev from public.profiles where id = p_user_id;
  update public.profiles set subscription_status = 'supporter' where id = p_user_id;
  return v_prev;
end;
$$;

-- An approved USDC claim now goes through the common function. Same
-- behaviour as 20261014120000 (only the access line changed).
create or replace function public.svc_approve_claim(p_claim_id bigint, p_actor uuid, p_actor_label text, p_reason text)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare c public.support_claims;
begin
  if public.claim_conflict_open(p_claim_id) then raise exception 'conflict_open'; end if;
  update public.support_claims
     set status = 'approved', reviewed_at = now(), reviewed_by = p_actor,
         reviewed_label = p_actor_label, review_reason = left(p_reason, 500),
         review_history = review_history || jsonb_build_array(jsonb_build_object('at', now(), 'by', coalesce(p_actor_label, 'admin'), 'codes', 'aprobado: ' || left(coalesce(p_reason, ''), 200)))
   where id = p_claim_id and status in ('submitted', 'manual_review')
   returning * into c;
  if c.id is null then raise exception 'not_found_or_closed'; end if;
  if c.user_id is not null then
    perform public.svc_grant_full_access(c.user_id);
  end if;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
  values (p_actor, p_actor_label, 'claim_approved', c.user_id,
          (select email from auth.users where id = c.user_id), p_reason,
          jsonb_build_object('claim_id', c.id, 'amount_units', c.amount_units, 'tx_hash', c.tx_hash,
                             'all_checks_passed', coalesce((c.verification ->> 'all_pass')::boolean, false),
                             'account_deleted', c.user_id is null, 'late', c.late));
  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- Register a manual contribution (admin + AAL2, or the SQL Editor).
-- ---------------------------------------------------------------------------
create or replace function public.admin_record_manual_contribution(
  p_email text, p_method text, p_amount numeric, p_currency text, p_fee numeric,
  p_reference text, p_paid_on date, p_flowers integer,
  p_force boolean default false, p_duplicate_reason text default null)
returns public.manual_contributions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_cur text := upper(trim(coalesce(p_currency, '')));
  v_ref text := trim(coalesce(p_reference, ''));
  v_has_claim boolean;
  v_has_manual boolean;
  v_prev text;
  m public.manual_contributions;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is null then raise exception 'account_not_found'; end if;
  if p_method is null or p_method not in ('paypal', 'cashapp', 'transferencia', 'efectivo', 'otro') then raise exception 'bad_method'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then raise exception 'bad_amount'; end if;
  if v_cur !~ '^[A-Z]{3,4}$' then raise exception 'bad_currency'; end if;
  if p_fee is not null and (p_fee < 0 or p_fee > p_amount) then raise exception 'bad_fee'; end if;
  if char_length(v_ref) < 3 then raise exception 'reference_required'; end if;
  if p_paid_on is null or p_paid_on > current_date or p_paid_on < date '2026-01-01' then raise exception 'bad_date'; end if;
  if p_flowers is null or p_flowers < 1 or p_flowers > 20 then raise exception 'bad_flowers'; end if;
  -- 10 per flower, on what was PAID; only checkable in USD / USDC
  if v_cur in ('USD', 'USDC') and p_amount < p_flowers * 10 then raise exception 'amount_below_flowers'; end if;
  -- another currency: the note has to explain the equivalence
  if v_cur not in ('USD', 'USDC') and char_length(v_ref) < 10 then raise exception 'equivalence_note_required'; end if;

  v_has_claim := exists (select 1 from public.support_claims where user_id = v_uid and status = 'approved');
  v_has_manual := exists (select 1 from public.manual_contributions where user_id = v_uid and voided_at is null);
  if (v_has_claim or v_has_manual) and not coalesce(p_force, false) then
    raise exception 'duplicate:%', case when v_has_claim and v_has_manual then 'usdc_y_manual' when v_has_claim then 'usdc' else 'manual' end;
  end if;
  if (v_has_claim or v_has_manual) and char_length(trim(coalesce(p_duplicate_reason, ''))) < 5 then raise exception 'reason_required'; end if;

  v_prev := public.svc_grant_full_access(v_uid);
  insert into public.manual_contributions (user_id, email, method, amount, currency, fee, reference, paid_on, flowers,
                                           previous_status, duplicate_reason, created_by, created_label)
  values (v_uid, v_email, p_method, p_amount, v_cur, p_fee, v_ref, p_paid_on, p_flowers,
          v_prev, case when v_has_claim or v_has_manual then left(trim(p_duplicate_reason), 500) end,
          auth.uid(), public.admin_actor_label())
  returning * into m;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
  values (auth.uid(), public.admin_actor_label(), 'manual_contribution_recorded', v_uid, v_email, v_ref,
          jsonb_build_object('manual_id', m.id, 'method', m.method, 'amount', m.amount, 'currency', m.currency, 'fee', m.fee,
                             'paid_on', m.paid_on, 'flowers', m.flowers, 'previous_status', v_prev,
                             'duplicate', v_has_claim or v_has_manual, 'duplicate_reason', m.duplicate_reason));
  return m;
end;
$$;

-- ---------------------------------------------------------------------------
-- Void a manual contribution: another entry, nothing deleted. Without any
-- other valid contribution, access goes back to what it was before the first
-- manual contribution (the oldest stored status that was not 'supporter').
-- ---------------------------------------------------------------------------
create or replace function public.admin_void_manual_contribution(p_id bigint, p_reason text)
returns public.manual_contributions
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.manual_contributions;
  v_restore text;
  v_now text;
  v_kept boolean := false;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select * into m from public.manual_contributions where id = p_id for update;
  if m.id is null then raise exception 'not_found'; end if;
  if m.voided_at is not null then raise exception 'already_voided'; end if;
  update public.manual_contributions
     set voided_at = now(), voided_by = auth.uid(), voided_label = public.admin_actor_label(), void_reason = left(trim(p_reason), 500)
   where id = m.id returning * into m;
  if m.user_id is not null then
    v_kept := exists (select 1 from public.support_claims where user_id = m.user_id and status = 'approved')
           or exists (select 1 from public.manual_contributions where user_id = m.user_id and voided_at is null);
    select subscription_status into v_now from public.profiles where id = m.user_id;
    if not v_kept and v_now = 'supporter' then
      select previous_status into v_restore from public.manual_contributions
       where user_id = m.user_id and coalesce(previous_status, '') <> 'supporter'
       order by created_at, id limit 1;
      if v_restore is not null then
        update public.profiles set subscription_status = v_restore where id = m.user_id;
      end if;
    end if;
  end if;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
  values (auth.uid(), public.admin_actor_label(), 'manual_contribution_voided', m.user_id, m.email, p_reason,
          jsonb_build_object('manual_id', m.id, 'access_kept', v_kept, 'status_before', v_now,
                             'status_after', (select subscription_status from public.profiles where id = m.user_id)));
  return m;
end;
$$;

-- List (all, or one account's) for the panel.
create or replace function public.admin_list_manual_contributions(p_user_id uuid default null, p_limit integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc) from (
    select m.id, m.user_id, m.email, m.user_id is null as account_deleted, m.method, m.amount, m.currency, m.fee, m.reference,
           m.paid_on, m.flowers, m.duplicate_reason, m.created_at, m.created_label, m.voided_at, m.voided_label, m.void_reason
      from public.manual_contributions m
     where p_user_id is null or m.user_id = p_user_id
     order by m.created_at desc, m.id desc
     limit greatest(1, least(coalesce(p_limit, 200), 1000))) x), '[]'::jsonb);
end;
$$;

-- CSV export: same as 20261014100000 plus the tab 'manual'.
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
      select concat_ws(',', c.id::text, csv_cell(case when c.user_id is null then 'cuenta borrada' else u.email::text end), c.flowers::text,
                       public.usdc_text(c.amount_units), csv_cell(c.status),
                       csv_cell(to_char(c.created_at at time zone 'UTC', ts)), csv_cell(to_char(c.submitted_at at time zone 'UTC', ts)),
                       csv_cell(to_char(c.expires_at at time zone 'UTC', ts)), csv_cell(c.tx_hash), csv_cell(c.review_reason),
                       csv_cell(to_char(c.reviewed_at at time zone 'UTC', ts)), csv_cell(c.reviewed_label)) line
        from public.support_claims c left join auth.users u on u.id = c.user_id
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
  elsif p_tab = 'manual' then
    v_head := 'id,email,method,amount_paid,currency,fee,reference,paid_on,flowers,created_utc,created_by,state,voided_utc,voided_by,void_reason';
    select array_agg(line) into v_lines from (
      select concat_ws(',', m.id::text, csv_cell(case when m.user_id is null then 'cuenta borrada' else m.email end), csv_cell(m.method),
                       m.amount::text, csv_cell(m.currency), coalesce(m.fee::text, ''), csv_cell(m.reference), m.paid_on::text, m.flowers::text,
                       csv_cell(to_char(m.created_at at time zone 'UTC', ts)), csv_cell(m.created_label),
                       csv_cell(case when m.voided_at is null then 'activo' else 'anulado' end),
                       csv_cell(to_char(m.voided_at at time zone 'UTC', ts)), csv_cell(m.voided_label), csv_cell(m.void_reason)) line
        from public.manual_contributions m
       order by m.created_at desc limit v_max + 1) s;
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

revoke execute on function public.manual_contributions_guard() from public, anon, authenticated;
revoke execute on function public.svc_grant_full_access(uuid) from public, anon, authenticated;
grant execute on function public.svc_grant_full_access(uuid) to service_role;
revoke execute on function public.admin_record_manual_contribution(text, text, numeric, text, numeric, text, date, integer, boolean, text) from public, anon;
grant execute on function public.admin_record_manual_contribution(text, text, numeric, text, numeric, text, date, integer, boolean, text) to authenticated;
revoke execute on function public.admin_void_manual_contribution(bigint, text) from public, anon;
grant execute on function public.admin_void_manual_contribution(bigint, text) to authenticated;
revoke execute on function public.admin_list_manual_contributions(uuid, integer) from public, anon;
grant execute on function public.admin_list_manual_contributions(uuid, integer) to authenticated;

commit;
