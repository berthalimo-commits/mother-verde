-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- Panel: "Correos fallidos en las últimas 24 h" and the list of e-mail
-- sends in Registro. Requires 20261013100000 (mail_events) and
-- 20261011130000 (admin_summary).
-- Admins with MFA (and the SQL Editor) only, like every admin view.

-- Number of e-mails our functions could not send (after every retry and
-- provider) in the last 24 hours. Shown at the top of every panel tab.
create or replace function public.admin_mail_failures_24h()
returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  return (select count(*)::integer from public.mail_events where not ok and at > now() - interval '24 hours');
end;
$$;

-- Last sends (Registro). The account e-mail is shown to the admin by joining
-- auth.users; mail_events itself never stores it.
create or replace function public.admin_list_mail_events(p_limit integer default 100)
returns table (at timestamptz, kind text, ok boolean, provider text, attempts integer, error text, account_email text, ref text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  return query
    select e.at, e.kind, e.ok, e.provider, e.attempts, e.error, u.email::text, e.ref
      from public.mail_events e left join auth.users u on u.id = e.user_id
     order by e.at desc limit least(greatest(p_limit, 1), 500);
end;
$$;

-- Same as 20261011130000 plus mail_failed_24h.
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
    'usdc_activated', coalesce((select public.usdc_text(sum(amount_units)::bigint) from public.support_claims where status = 'approved'), '0.0000'),
    'mail_failed_24h', (select count(*) from public.mail_events where not ok and at > now() - interval '24 hours'),
    'mail_sent_24h', (select count(*) from public.mail_events where ok and at > now() - interval '24 hours'))
  into v;
  return v;
end;
$$;

revoke execute on function public.admin_mail_failures_24h() from public, anon;
revoke execute on function public.admin_list_mail_events(integer) from public, anon;
grant execute on function public.admin_mail_failures_24h() to authenticated;
grant execute on function public.admin_list_mail_events(integer) to authenticated;

commit;
