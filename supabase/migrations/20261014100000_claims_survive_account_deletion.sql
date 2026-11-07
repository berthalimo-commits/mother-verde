-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- Deleting an account no longer deletes the proof of a payment.
-- Requires 20261011120000 (support_claims) and 20261011130000 (CSV export).
--
-- When an account is deleted:
--   * its claims WITHOUT a transaction code (only a reserved amount, nothing
--     paid) are deleted, as before;
--   * its claims WITH a transaction code stay, separated from the person:
--     user_id -> null, contact name and phone -> null, account_deleted_at set.
--     What is kept: the TXID, amount, flowers, dates, status and the review.
--     The account e-mail was never stored on the claim, so nothing else
--     points to the person. The panel shows "cuenta borrada".
--   * an open one (submitted / manual_review) can still be closed by the
--     admin: approving records the payment as received, but there is no
--     account to activate and no e-mail to send.
-- [PENDIENTE: revisión de abogada] how long these anonymous payment records
-- are kept (accounting / tax obligations).

alter table public.support_claims add column if not exists account_deleted_at timestamptz;
alter table public.support_claims alter column user_id drop not null;
alter table public.support_claims drop constraint if exists support_claims_user_id_fkey;
alter table public.support_claims add constraint support_claims_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
-- A claim without an account must have been marked as such.
alter table public.support_claims drop constraint if exists support_claims_owner_or_deleted;
alter table public.support_claims add constraint support_claims_owner_or_deleted
  check (user_id is not null or (account_deleted_at is not null and contact_name is null and contact_phone is null));

-- Before the account row goes: drop what has no payment behind it.
create or replace function public.support_claims_before_account_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.support_claims where user_id = old.id and tx_hash is null;
  return old;
end;
$$;
revoke execute on function public.support_claims_before_account_delete() from public, anon, authenticated;
drop trigger if exists on_auth_user_delete_claims on auth.users;
create trigger on_auth_user_delete_claims
  before delete on auth.users
  for each row execute function public.support_claims_before_account_delete();

-- When the account link is cut (on delete set null): remove the person.
create or replace function public.support_claims_detach_person()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.user_id is not null and new.user_id is null then
    new.contact_name := null;
    new.contact_phone := null;
    new.account_deleted_at := coalesce(new.account_deleted_at, now());
  end if;
  return new;
end;
$$;
revoke execute on function public.support_claims_detach_person() from public, anon, authenticated;
drop trigger if exists support_claims_detach_person on public.support_claims;
create trigger support_claims_detach_person
  before update of user_id on public.support_claims
  for each row execute function public.support_claims_detach_person();

-- Approve: as before; for a deleted account it only records the payment.
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

-- The Edge Function's view of a claim: e-mail null when the account is gone.
create or replace function public.svc_claim_context(p_claim_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'claim', to_jsonb(c),
           'email', u.email,
           'lang', coalesce(p.preferred_lang, 'es'),
           'account_deleted', c.user_id is null,
           'min_confirmations', public.app_config_value('claim_min_confirmations', 30),
           'auto_max_usdc', public.app_config_value('claim_auto_max_usdc', 201),
           'auto_enabled', public.app_config_value('claim_auto_verify_enabled', 0) = 1)
    from public.support_claims c
    left join auth.users u on u.id = c.user_id
    left join public.profiles p on p.id = c.user_id
   where c.id = p_claim_id;
$$;

-- Panel list: also claims whose account was deleted (account_deleted = true).
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

-- CSV export: same as 20261011130000, claims tab includes deleted accounts
-- (e-mail column says "cuenta borrada").
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

commit;
