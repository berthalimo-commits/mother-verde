-- ROLLBACK of migration 20261011120000_support_claims.sql.
-- !! Deletes every support claim. Accounts already approved stay 'supporter'.
-- Run AFTER rollback-20261011130000 and BEFORE rollback-20261011100000.
-- Runs as ONE transaction.
begin;

-- Refuses while the table has rows (2nd independent review, 2026-11-06), like
-- the newer rollbacks: nothing real is lost by accident. To roll back anyway,
-- first export (select * from public.support_claims;) and then, on its own, run:
--   delete from public.support_claims;
do $$
begin
  if to_regclass('public.support_claims') is not null and exists (select 1 from public.support_claims) then
    raise exception 'support_claims_has_rows: export first (select * from public.support_claims;), then run «delete from public.support_claims;» only if you really want to lose them (avisos de aporte (también los pagados con TXID))';
  end if;
end $$;
drop function if exists public.admin_reject_claim(bigint, text);
drop function if exists public.admin_approve_claim(bigint, text);
drop function if exists public.admin_list_claims(text[]);
drop function if exists public.usdc_text(bigint);
drop function if exists public.svc_claim_context(bigint);
drop function if exists public.svc_approve_claim(bigint, uuid, text, text);
drop function if exists public.svc_record_claim_check(bigint, jsonb, boolean, text);
drop function if exists public.cancel_my_support_claim(bigint);
drop function if exists public.submit_support_claim_tx(bigint, text, text, text);
drop function if exists public.create_support_claim(integer);
drop function if exists public.expire_support_claims();
drop function if exists public.app_config_value(text, integer);
drop table if exists public.support_claims;
delete from public.app_config where key in ('claim_expiry_hours', 'claim_min_confirmations', 'claim_auto_max_usdc', 'claim_auto_verify_enabled');
commit;
