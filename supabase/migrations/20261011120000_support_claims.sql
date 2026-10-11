-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- One-time support contribution: after paying, the person tells us their
-- e-mail and the transaction code; the owner checks it by hand on the
-- blockchain and approves it with approve_support_claim(id), which turns
-- the account into 'supporter' (full access, no end date).
-- Requires 20261010120000 (status 'supporter').
--
-- Rules (enforced here, not in the browser):
--   * Each person inserts and reads only their own claims.
--   * Status always starts as 'pending'; the browser can never change it
--     (no UPDATE/DELETE privilege at all).
--   * At most ONE pending claim per person.
--   * The transaction code must look like a Base/Ethereum transaction hash
--     (0x + 64 hex characters) and can only be claimed once, by anyone.
--   * Stored: account (user_id), contact e-mail, transaction code, network,
--     number of flowers, status and review dates. No IP or device data.
--   * Deleted together with the account (cascade).

create table if not exists public.support_claims (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_email text not null
                check (char_length(contact_email) between 3 and 254
                       and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  tx_hash       text not null check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  network       text not null default 'base' check (network = 'base'),
  flowers       integer not null default 1 check (flowers between 1 and 10),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  review_note   text check (review_note is null or char_length(review_note) <= 500)
);

create unique index if not exists support_claims_one_pending
  on public.support_claims (user_id) where status = 'pending';
create unique index if not exists support_claims_tx_once
  on public.support_claims (lower(tx_hash));

alter table public.support_claims enable row level security;
revoke all on public.support_claims from anon, authenticated;
-- The browser may only choose these three columns; user_id, status, network
-- and the review fields always take their defaults.
grant select on public.support_claims to authenticated;
grant insert (contact_email, tx_hash, flowers) on public.support_claims to authenticated;

drop policy if exists "support_claims_select_own" on public.support_claims;
create policy "support_claims_select_own" on public.support_claims
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "support_claims_insert_own" on public.support_claims;
create policy "support_claims_insert_own" on public.support_claims
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_at is null and review_note is null);

-- Owner-only helpers, run from the Supabase SQL Editor (as postgres).
-- Nobody else may call them.
create or replace function public.approve_support_claim(p_id bigint, p_note text default null)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.support_claims;
begin
  update public.support_claims
     set status = 'approved', reviewed_at = now(), review_note = p_note
   where id = p_id and status = 'pending'
   returning * into c;
  if c.id is null then raise exception 'claim % not found or not pending', p_id; end if;
  update public.profiles set subscription_status = 'supporter' where id = c.user_id;
  if not found then raise exception 'no profile for claim %', p_id; end if;
  return c;
end;
$$;

create or replace function public.reject_support_claim(p_id bigint, p_note text default null)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.support_claims;
begin
  update public.support_claims
     set status = 'rejected', reviewed_at = now(), review_note = p_note
   where id = p_id and status = 'pending'
   returning * into c;
  if c.id is null then raise exception 'claim % not found or not pending', p_id; end if;
  return c;
end;
$$;

revoke execute on function public.approve_support_claim(bigint, text) from public, anon, authenticated, service_role;
revoke execute on function public.reject_support_claim(bigint, text) from public, anon, authenticated, service_role;

commit;
