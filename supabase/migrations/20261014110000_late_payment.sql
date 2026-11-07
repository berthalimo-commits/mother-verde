-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- Late payment: the 72 h reservation ran out, but the person had already
-- paid (or paid later). They can still give the transaction code. Such a
-- claim ALWAYS goes to manual review with the reason 'reserva_vencida' and
-- is never activated on its own (the automatic check only looks at
-- 'submitted' claims, and 'claim_open' fails for it, so approving it needs a
-- written reason). Requires 20261011120000.
--
-- The amount of an expired reservation may already belong to someone else's
-- new reservation, so late claims are left out of the "one open claim per
-- amount" rule (late = true); the TXID stays unique as always.

alter table public.support_claims add column if not exists late boolean not null default false;

drop index if exists public.support_claims_amount_open;
create unique index support_claims_amount_open
  on public.support_claims (amount_units)
  where status in ('awaiting_payment', 'submitted', 'manual_review') and not late;

create or replace function public.submit_support_claim_tx(p_claim_id bigint, p_tx_hash text,
                                                          p_contact_name text default null, p_contact_phone text default null)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx text := lower(trim(coalesce(p_tx_hash, '')));
  v_name text := nullif(regexp_replace(trim(coalesce(p_contact_name, '')), '\s+', ' ', 'g'), '');
  v_phone text := nullif(regexp_replace(trim(coalesce(p_contact_phone, '')), '\s+', ' ', 'g'), '');
  c public.support_claims;
  v_other public.support_claims;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_tx !~ '^0x[0-9a-f]{64}$' then raise exception 'bad_tx_format'; end if;
  if v_name is not null and (char_length(v_name) > 80 or v_name ~ '[[:cntrl:]<>]') then raise exception 'bad_contact_name'; end if;
  if v_phone is not null and v_phone !~ '^[+]?[0-9][0-9 ().-]{5,23}$' then raise exception 'bad_contact_phone'; end if;
  select * into c from public.support_claims where id = p_claim_id and user_id = auth.uid() for update;
  if c.id is null then raise exception 'not_found'; end if;
  if exists (select 1 from public.support_claims where tx_hash = v_tx) then raise exception 'tx_already_used'; end if;

  -- On time: as before.
  if c.status = 'awaiting_payment' and c.expires_at >= now() then
    update public.support_claims set status = 'submitted', tx_hash = v_tx, submitted_at = now(),
           contact_name = v_name, contact_phone = v_phone
     where id = c.id returning * into c;
    return c;
  end if;

  -- Late: the reservation expired (marked or not yet marked) and has no TXID.
  if c.tx_hash is null and (c.status = 'expired' or (c.status = 'awaiting_payment' and c.expires_at < now())) then
    -- One open claim per person: a newer unpaid reservation is canceled; a
    -- claim already in review stops this one.
    select * into v_other from public.support_claims
     where user_id = auth.uid() and id <> c.id and status in ('awaiting_payment', 'submitted', 'manual_review');
    if v_other.id is not null then
      if v_other.status <> 'awaiting_payment' then raise exception 'claim_in_review'; end if;
      update public.support_claims set status = 'canceled' where id = v_other.id;
    end if;
    update public.support_claims
       set status = 'manual_review', late = true, review_reason = 'reserva_vencida',
           tx_hash = v_tx, submitted_at = now(), contact_name = v_name, contact_phone = v_phone
     where id = c.id returning * into c;
    return c;
  end if;

  raise exception 'not_awaiting_payment';
end;
$$;
revoke execute on function public.submit_support_claim_tx(bigint, text, text, text) from public, anon;
grant execute on function public.submit_support_claim_tx(bigint, text, text, text) to authenticated;

-- The browser may read the new column of its own claims.
grant select (late) on public.support_claims to authenticated;

commit;
