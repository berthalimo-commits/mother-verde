-- ROLLBACK of migration 20261011120000_support_claims.sql.
-- !! Deletes every claim. Accounts already approved stay 'supporter'.
-- Runs as ONE transaction.
begin;
drop function if exists public.approve_support_claim(bigint, text);
drop function if exists public.reject_support_claim(bigint, text);
drop table if exists public.support_claims;
commit;
