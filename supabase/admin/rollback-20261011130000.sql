-- ROLLBACK of migration 20261011130000_gift_codes_and_access.sql.
-- !! Deletes every gift code and redemption record. Days already granted stay
-- in profiles.access_until (removed by rollback-20261010120000 if you go that far).
-- Run BEFORE rollback-20261011120000. Runs as ONE transaction.
begin;
drop function if exists public.admin_export_csv(text, jsonb);
drop function if exists public.csv_cell(text);
drop function if exists public.admin_summary();
drop function if exists public.admin_get_user(uuid);
drop function if exists public.admin_list_users(text, text, integer, integer);
drop function if exists public.svc_users_view();
drop function if exists public.admin_access_state(public.profiles);
delete from public.app_config where key = 'csv_export_max_rows';
drop function if exists public.admin_revoke_access(text, text);
drop function if exists public.admin_grant_days(text, integer, text);
drop function if exists public.admin_revoke_gift_code(bigint, text);
drop function if exists public.admin_list_gift_codes(integer);
drop function if exists public.svc_finish_sent_gift_code(bigint, boolean, text, uuid, text);
drop function if exists public.svc_reserve_sent_gift_code(text, text, integer, integer, uuid, text);
drop function if exists public.admin_create_gift_codes(integer, integer, integer);
drop function if exists public.admin_actor_label();
drop function if exists public.redeem_gift_code(text);
drop function if exists public.gift_codes_created_today();
drop function if exists public.gift_code_generate();
drop function if exists public.gift_code_hash(text);
drop table if exists public.gift_redeem_attempts;
drop table if exists public.gift_codes;
commit;
