-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- Panel counter "Avisos sin revisar" (submitted + manual_review) and how many
-- have been waiting more than 12 hours since the TXID arrived. Admin + MFA only.
-- Requires 20261011120000 (support_claims).
create or replace function public.admin_pending_claims()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  return (select jsonb_build_object(
            'open', count(*)::integer,
            'older_12h', count(*) filter (where coalesce(submitted_at, created_at) < now() - interval '12 hours')::integer)
            from public.support_claims where status in ('submitted', 'manual_review'));
end;
$$;
revoke execute on function public.admin_pending_claims() from public, anon;
grant execute on function public.admin_pending_claims() to authenticated;

commit;
