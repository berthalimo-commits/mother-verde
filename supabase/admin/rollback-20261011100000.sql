-- ROLLBACK of migration 20261011100000_admin_and_audit.sql.
-- !! Deletes the admin list and the whole audit log.
-- Run AFTER rollback-20261011120000. Runs as ONE transaction.
begin;

-- Refuses while the table has rows (2nd independent review, 2026-11-06), like
-- the newer rollbacks: nothing real is lost by accident. To roll back anyway,
-- first export (select * from public.admin_audit_log;) and then, on its own, run:
--   delete from public.admin_audit_log;
do $$
begin
  if to_regclass('public.admin_audit_log') is not null and exists (select 1 from public.admin_audit_log) then
    raise exception 'audit_log_has_rows: export first (select * from public.admin_audit_log;), then run «delete from public.admin_audit_log;» only if you really want to lose them (registro de acciones de la administradora)';
  end if;
end $$;
drop function if exists public.admin_list_audit(integer);
drop function if exists public.admin_log(text, uuid, text, jsonb, text);
drop function if exists public.admin_whoami();
drop function if exists public.is_admin_aal2();
drop function if exists public.is_sql_editor();
drop table if exists public.admin_audit_log;
drop table if exists public.admin_users;
commit;
