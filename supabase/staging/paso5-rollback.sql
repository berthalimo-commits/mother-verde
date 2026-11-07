-- STAGING · paso 5 · REVERSIÓN de los aportes manuales. Copia exacta de supabase/admin/rollback-20261103100000.sql.
-- Se niega si ya hay aportes manuales guardados (exporta antes el CSV «manual»).
-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- ROLLBACK of 20261103100000_manual_contributions.sql.
-- Puts back svc_approve_claim() as 20261014120000 left it and
-- admin_export_csv() as 20261014100000 left it, and removes the manual
-- contributions (table + functions).
-- SAFETY: it REFUSES to run if any manual contribution was recorded (nothing
-- is ever deleted by accident): export the «manual» CSV from the panel first,
-- then decide. Access already given stays as it is (subscription_status is
-- not touched).

do $$
begin
  if to_regclass('public.manual_contributions') is not null
     and exists (select 1 from public.manual_contributions) then
    raise exception 'manual_contributions_not_empty: export the CSV «manual» first';
  end if;
end $$;

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
    update public.profiles set subscription_status = 'supporter' where id = c.user_id;
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

drop function if exists public.admin_list_manual_contributions(uuid, integer);
drop function if exists public.admin_void_manual_contribution(bigint, text);
drop function if exists public.admin_record_manual_contribution(text, text, numeric, text, numeric, text, date, integer, boolean, text);
drop function if exists public.svc_grant_full_access(uuid);
drop table if exists public.manual_contributions;
drop function if exists public.manual_contributions_guard();

commit;
