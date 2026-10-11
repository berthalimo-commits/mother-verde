-- Reviewing support contributions from the Supabase SQL Editor.
-- Paste ONE block at a time. Requires migrations 20261011100000 and
-- 20261011120000. (The admin panel does the same, with MFA.)

-- 1) READ-ONLY: claims waiting for a decision ('submitted' = code given,
--    not decided; 'manual_review' = the automatic check found a problem, the
--    reason is in review_reason). Open "explorer_url" to see the transfer.
select id, account_email, flowers, amount_usdc, status, submitted_at, expires_at,
       review_reason, verification ->> 'all_pass' as all_checks_passed, explorer_url
from public.admin_list_claims(array['submitted', 'manual_review']);

-- 2) READ-ONLY: reserved amounts not paid yet.
select id, account_email, flowers, amount_usdc, created_at, expires_at
from public.admin_list_claims(array['awaiting_payment']);

-- 3) APPROVE one claim (replace 123). If the automatic check didn't pass every
--    point, a reason is required (at least 5 characters). The account becomes
--    'supporter'. Logged in admin_audit_log. (From here no e-mail is sent;
--    approving from the panel sends the confirmation e-mail.)
select id, status from public.admin_approve_claim(123, 'Comprobado a mano en Basescan: monto y destino correctos.');

-- 4) REJECT one claim (replace 123 and the reason). The person can try again.
select id, status from public.admin_reject_claim(123, 'No encontramos la transferencia en la red Base.');
