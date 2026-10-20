-- ROLLBACK of migration 20261013110000_mail_failures_panel.sql.
-- Removes the panel's e-mail counters and list, and puts admin_summary back
-- as it was in 20261011130000 (without mail_failed_24h / mail_sent_24h).
-- Run BEFORE rollback-20261013100000. Runs as ONE transaction.
begin;
drop function if exists public.admin_mail_failures_24h();
drop function if exists public.admin_list_mail_events(integer);
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
commit;
