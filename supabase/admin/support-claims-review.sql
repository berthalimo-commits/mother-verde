-- Reviewing support contributions. Paste ONE block at a time in the Supabase
-- SQL Editor. Requires migration 20261011120000_support_claims.sql.

-- 1) READ-ONLY: pending claims, oldest first. Open the "ver" link to check on
--    Basescan that the transfer is USDC, on Base, to your address, and that
--    at least (10 x flowers) - 0.50 USDC arrived.
select c.id, c.created_at, c.flowers, c.flowers * 10 as usdc_esperados,
       c.contact_email, u.email as correo_de_la_cuenta, c.tx_hash,
       'https://basescan.org/tx/' || c.tx_hash as ver
from public.support_claims c
join auth.users u on u.id = c.user_id
where c.status = 'pending'
order by c.created_at;

-- 2) APPROVE one claim (replace 123 with its id). Turns the account into
--    'supporter' (full access, no end date). One transaction by itself.
select * from public.approve_support_claim(123);

-- 3) REJECT one claim (replace 123 and the note). The person can send a new one.
select * from public.reject_support_claim(123, 'No encontramos la transferencia en la red Base.');

-- 4) READ-ONLY: everything reviewed in the last 30 days.
select c.id, c.status, c.reviewed_at, c.flowers, u.email, c.review_note
from public.support_claims c join auth.users u on u.id = c.user_id
where c.reviewed_at > now() - interval '30 days'
order by c.reviewed_at desc;
