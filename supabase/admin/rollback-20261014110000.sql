-- ROLLBACK of migration 20261014110000_late_payment.sql.
-- Late claims (late = true) keep their data; afterwards a late TXID can no
-- longer be given. If an open late claim has the same amount as another open
-- claim, the old unique rule can't be restored: close (approve/reject) the
-- late one first. Runs as ONE transaction.
begin;
drop index if exists public.support_claims_amount_open;
create unique index support_claims_amount_open
  on public.support_claims (amount_units) where status in ('awaiting_payment', 'submitted', 'manual_review');
revoke select (late) on public.support_claims from authenticated;
alter table public.support_claims drop column if exists late;

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
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_tx !~ '^0x[0-9a-f]{64}$' then raise exception 'bad_tx_format'; end if;
  if v_name is not null and (char_length(v_name) > 80 or v_name ~ '[[:cntrl:]<>]') then raise exception 'bad_contact_name'; end if;
  if v_phone is not null and v_phone !~ '^[+]?[0-9][0-9 ().-]{5,23}$' then raise exception 'bad_contact_phone'; end if;
  select * into c from public.support_claims where id = p_claim_id and user_id = auth.uid();
  if c.id is null then raise exception 'not_found'; end if;
  if c.status <> 'awaiting_payment' then raise exception 'not_awaiting_payment'; end if;
  if c.expires_at < now() then
    update public.support_claims set status = 'expired' where id = c.id;
    raise exception 'expired';
  end if;
  if exists (select 1 from public.support_claims where tx_hash = v_tx) then raise exception 'tx_already_used'; end if;
  update public.support_claims set status = 'submitted', tx_hash = v_tx, submitted_at = now(),
         contact_name = v_name, contact_phone = v_phone
   where id = c.id returning * into c;
  return c;
end;
$$;
commit;
