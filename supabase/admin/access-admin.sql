-- Access administration from the Supabase SQL Editor. Paste ONE block at a
-- time and replace the example values. Every action is written to
-- admin_audit_log. Requires migrations 20261011100000 and 20261011130000.

-- 1) TAKE ACCESS AWAY (fraud). Doesn't delete the account. Reason required.
select public.admin_revoke_access('persona@example.com', 'Motivo: …');

-- 2) GIVE N DAYS of full access (1–365). Reason required. Returns the new end date.
select public.admin_grant_days('persona@example.com', 7, 'Motivo: …');

-- 3) CREATE GIFT CODES to hand out yourself (max 20 per day in total).
--    The codes appear ONLY in this result: copy them now, they can't be shown again.
--    Arguments: how many, days of access each, days to redeem.
select * from public.admin_create_gift_codes(3, 7, 30);

-- 4) READ-ONLY: gift codes and their state (creado, enviado, usado, vencido, anulado).
select * from public.admin_list_gift_codes(200);

-- 5) VOID an unused gift code (replace 123 and the reason).
select public.admin_revoke_gift_code(123, 'Motivo: …');

-- 6) READ-ONLY: audit log, newest first.
select at, actor_label, action, target_email, reason, details from public.admin_list_audit(200);
