-- ROLLBACK of migration 20261014130000_pending_claims_counter.sql. Loses nothing
-- (it only adds a read-only counter for the panel). Runs as ONE transaction.
begin;
drop function if exists public.admin_pending_claims();
commit;
