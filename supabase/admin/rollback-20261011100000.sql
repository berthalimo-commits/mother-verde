-- ROLLBACK of migration 20261011100000_admin_and_audit.sql.
-- !! Deletes the admin list and the whole audit log.
-- Run AFTER rollback-20261011120000. Runs as ONE transaction.
begin;
drop function if exists public.admin_list_audit(integer);
drop function if exists public.admin_log(text, uuid, text, jsonb, text);
drop function if exists public.admin_whoami();
drop function if exists public.is_admin_aal2();
drop function if exists public.is_sql_editor();
drop table if exists public.admin_audit_log;
drop table if exists public.admin_users;
commit;
