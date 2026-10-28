-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- Late payment, closed against stolen TXIDs (audit docs/auditoria-verificacion.md,
-- findings N1 + N2). Requires 20261014110000 (late payment) and 20261014100000.
--
--  * A late TXID is accepted ONLY through the support-claims Edge Function,
--    which first checks on Base that the transfer is USDC, to our address, for
--    EXACTLY the amount of the person's OWN expired reservation; then it calls
--    svc_submit_late_claim (server only). The browser can no longer attach a
--    TXID to an expired reservation directly.
--  * If a TXID is already on another claim, nobody gets a dead-end "already
--    used": a CONFLICT is stored (support_claim_conflicts), both claims go to
--    manual review, and the person only sees "we'll review it by hand".
--    Nothing about the other claim is visible to either person (the table and
--    review_history are admin-only).
--  * A late claim whose amount now also belongs to someone else's claim gets a
--    "mismo_monto" conflict, so the admin compares both before deciding.
--  * A claim with an open conflict is NEVER approved (not by auto-verify, not
--    by the panel) until the admin resolves the conflict with a written
--    reason; everything is in the audit log.
--  * Reasons are no longer overwritten: "Comprobar en Base" adds its codes to
--    review_reason and to an admin-only history (review_history).

alter table public.support_claims add column if not exists review_history jsonb not null default '[]'::jsonb;
-- review_history is NOT granted to the browser (column privileges, see 20261011120000).

create table if not exists public.support_claim_conflicts (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  kind             text not null check (kind in ('mismo_txid', 'mismo_monto')),
  tx_hash          text check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  claim_id         bigint references public.support_claims(id) on delete set null,   -- the newer claim
  other_claim_id   bigint references public.support_claims(id) on delete set null,   -- the one it collides with
  status           text not null default 'open' check (status in ('open', 'resolved')),
  winner_claim_id  bigint,
  resolved_at      timestamptz,
  resolved_label   text,
  reason           text check (reason is null or char_length(reason) <= 500)
);
create index if not exists support_claim_conflicts_open on public.support_claim_conflicts (status) where status = 'open';
alter table public.support_claim_conflicts enable row level security;
revoke all on public.support_claim_conflicts from public, anon, authenticated;

-- Add reason codes to a claim without losing the earlier ones.
create or replace function public.claim_add_reason(p_claim_id bigint, p_codes text, p_by text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
  v_merged text;
begin
  if p_codes is null or trim(p_codes) = '' then return; end if;
  select review_reason into v_old from public.support_claims where id = p_claim_id;
  select string_agg(code, ', ' order by first_pos) into v_merged from (
    select trim(x) code, min(n) first_pos
      from unnest(string_to_array(coalesce(v_old, '') || ',' || p_codes, ',')) with ordinality as t(x, n)
     where trim(x) <> ''
     group by trim(x)) s;
  update public.support_claims
     set review_reason = left(v_merged, 500),
         review_history = (review_history || jsonb_build_array(jsonb_build_object('at', now(), 'by', p_by, 'codes', left(p_codes, 300)))
                          )
   where id = p_claim_id;
end;
$$;
revoke execute on function public.claim_add_reason(bigint, text, text) from public, anon, authenticated;

-- Conflict codes are for the panel only: they go to the admin-only history,
-- and the person (who can read review_reason of their own claim) only sees
-- the neutral "revision_manual" — never that another claim exists.
create or replace function public.claim_add_note(p_claim_id bigint, p_codes text, p_by text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.claim_add_reason(p_claim_id, 'revision_manual', p_by);
  update public.support_claims
     set review_history = review_history || jsonb_build_array(jsonb_build_object('at', now(), 'by', p_by, 'codes', left(p_codes, 300)))
   where id = p_claim_id;
end;
$$;
revoke execute on function public.claim_add_note(bigint, text, text) from public, anon, authenticated;

create or replace function public.claim_conflict_open(p_claim_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.support_claim_conflicts
                  where status = 'open' and (claim_id = p_claim_id or other_claim_id = p_claim_id));
$$;
revoke execute on function public.claim_conflict_open(bigint) from public, anon, authenticated;
grant execute on function public.claim_conflict_open(bigint) to service_role;

-- "Comprobar en Base" / automatic check: codes are ADDED, never replace.
create or replace function public.svc_record_claim_check(p_claim_id bigint, p_verification jsonb, p_to_manual boolean, p_reason text)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare c public.support_claims;
begin
  update public.support_claims
     set verification = p_verification,
         status = case when p_to_manual and status = 'submitted' then 'manual_review' else status end
   where id = p_claim_id and status in ('submitted', 'manual_review')
   returning * into c;
  if c.id is null then raise exception 'not_found_or_closed'; end if;
  if p_to_manual then perform public.claim_add_reason(c.id, p_reason, 'comprobacion'); end if;
  select * into c from public.support_claims where id = c.id;
  return c;
end;
$$;

-- The other claim holding a TXID: flag it and keep it out of auto-approval.
create or replace function public.claim_flag_conflict(p_other bigint, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_claims set status = 'manual_review' where id = p_other and status = 'submitted';
  perform public.claim_add_note(p_other, p_code, 'conflicto');
end;
$$;
revoke execute on function public.claim_flag_conflict(bigint, text) from public, anon, authenticated;

-- The person, on time (reservation still valid). A TXID already on another
-- claim no longer fails: conflict + manual review, neutral to the person.
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
  v_holder bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_tx !~ '^0x[0-9a-f]{64}$' then raise exception 'bad_tx_format'; end if;
  if v_name is not null and (char_length(v_name) > 80 or v_name ~ '[[:cntrl:]<>]') then raise exception 'bad_contact_name'; end if;
  if v_phone is not null and v_phone !~ '^[+]?[0-9][0-9 ().-]{5,23}$' then raise exception 'bad_contact_phone'; end if;
  select * into c from public.support_claims where id = p_claim_id and user_id = auth.uid() for update;
  if c.id is null then raise exception 'not_found'; end if;
  -- An expired reservation goes through the late-payment check (Edge Function).
  if c.status = 'expired' or (c.status = 'awaiting_payment' and c.expires_at < now()) then raise exception 'expired'; end if;
  if c.status <> 'awaiting_payment' then raise exception 'not_awaiting_payment'; end if;

  select id into v_holder from public.support_claims where tx_hash = v_tx and id <> c.id for update;
  if v_holder is not null then
    update public.support_claims set status = 'manual_review', submitted_at = now(), contact_name = v_name, contact_phone = v_phone
     where id = c.id;
    insert into public.support_claim_conflicts (kind, tx_hash, claim_id, other_claim_id) values ('mismo_txid', v_tx, c.id, v_holder);
    perform public.claim_add_note(c.id, 'conflicto_txid', 'envio');
    perform public.claim_flag_conflict(v_holder, 'conflicto_txid');
    select * into c from public.support_claims where id = c.id;
    c.review_history := '[]'::jsonb;  -- admin-only, never in the person's answer
    return c;
  end if;

  update public.support_claims set status = 'submitted', tx_hash = v_tx, submitted_at = now(),
         contact_name = v_name, contact_phone = v_phone
   where id = c.id returning * into c;
  c.review_history := '[]'::jsonb;  -- admin-only, never in the person's answer
  return c;
end;
$$;
revoke execute on function public.submit_support_claim_tx(bigint, text, text, text) from public, anon;
grant execute on function public.submit_support_claim_tx(bigint, text, text, text) to authenticated;

-- Late TXID (server only: the Edge Function calls it AFTER checking on Base
-- that the transfer is exactly the amount of THIS reservation).
create or replace function public.svc_submit_late_claim(p_claim_id bigint, p_user uuid, p_tx_hash text, p_verification jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx text := lower(trim(coalesce(p_tx_hash, '')));
  c public.support_claims;
  v_other public.support_claims;
  v_holder bigint;
  v_same record;
  v_conflict boolean := false;
begin
  if v_tx !~ '^0x[0-9a-f]{64}$' then raise exception 'bad_tx_format'; end if;
  select * into c from public.support_claims where id = p_claim_id and user_id = p_user for update;
  if c.id is null then raise exception 'not_found'; end if;
  if not (c.tx_hash is null and (c.status = 'expired' or (c.status = 'awaiting_payment' and c.expires_at < now()))) then
    raise exception 'not_late';
  end if;
  -- One open claim per person: a newer unpaid reservation is canceled; a claim
  -- already in review stops this one.
  select * into v_other from public.support_claims
   where user_id = p_user and id <> c.id and status in ('awaiting_payment', 'submitted', 'manual_review');
  if v_other.id is not null then
    if v_other.status <> 'awaiting_payment' then raise exception 'claim_in_review'; end if;
    update public.support_claims set status = 'canceled' where id = v_other.id;
  end if;

  select id into v_holder from public.support_claims where tx_hash = v_tx and id <> c.id for update;
  if v_holder is not null then
    update public.support_claims
       set status = 'manual_review', late = true, submitted_at = now(), verification = p_verification
     where id = c.id;
    insert into public.support_claim_conflicts (kind, tx_hash, claim_id, other_claim_id) values ('mismo_txid', v_tx, c.id, v_holder);
    perform public.claim_add_reason(c.id, 'reserva_vencida', 'pago_tardio');
    perform public.claim_add_note(c.id, 'conflicto_txid', 'pago_tardio');
    perform public.claim_flag_conflict(v_holder, 'conflicto_txid');
    v_conflict := true;
  else
    update public.support_claims
       set status = 'manual_review', late = true, tx_hash = v_tx, submitted_at = now(), verification = p_verification
     where id = c.id;
    perform public.claim_add_reason(c.id, 'reserva_vencida', 'pago_tardio');
  end if;

  -- Same amount now (or later) reserved by someone else: compare both by hand.
  for v_same in
    select id from public.support_claims
     where amount_units = c.amount_units and id <> c.id and user_id is distinct from p_user
       and created_at >= c.created_at and status in ('awaiting_payment', 'submitted', 'manual_review', 'approved')
  loop
    insert into public.support_claim_conflicts (kind, tx_hash, claim_id, other_claim_id) values ('mismo_monto', v_tx, c.id, v_same.id);
    perform public.claim_add_note(c.id, 'conflicto_monto', 'pago_tardio');
    perform public.claim_flag_conflict(v_same.id, 'conflicto_monto');
    v_conflict := true;
  end loop;

  select * into c from public.support_claims where id = c.id;
  return jsonb_build_object('id', c.id, 'status', c.status, 'late', true, 'review', 'manual');
end;
$$;
revoke execute on function public.svc_submit_late_claim(bigint, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.svc_submit_late_claim(bigint, uuid, text, jsonb) to service_role;

-- Approve: never while a conflict on the claim is open.
create or replace function public.svc_approve_claim(p_claim_id bigint, p_actor uuid, p_actor_label text, p_reason text)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare c public.support_claims;
begin
  if public.claim_conflict_open(p_claim_id) then raise exception 'conflict_open'; end if;
  update public.support_claims
     set status = 'approved', reviewed_at = now(), reviewed_by = p_actor,
         reviewed_label = p_actor_label, review_reason = left(p_reason, 500),
         review_history = review_history || jsonb_build_array(jsonb_build_object('at', now(), 'by', coalesce(p_actor_label, 'admin'), 'codes', 'aprobado: ' || left(coalesce(p_reason, ''), 200)))
   where id = p_claim_id and status in ('submitted', 'manual_review')
   returning * into c;
  if c.id is null then raise exception 'not_found_or_closed'; end if;
  if c.user_id is not null then
    update public.profiles set subscription_status = 'supporter' where id = c.user_id;
  end if;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
  values (p_actor, p_actor_label, 'claim_approved', c.user_id,
          (select email from auth.users where id = c.user_id), p_reason,
          jsonb_build_object('claim_id', c.id, 'amount_units', c.amount_units, 'tx_hash', c.tx_hash,
                             'all_checks_passed', coalesce((c.verification ->> 'all_pass')::boolean, false),
                             'account_deleted', c.user_id is null, 'late', c.late));
  return c;
end;
$$;

-- Late claims always need a written reason to approve (claim_open fails for
-- them), and so does any claim that had a conflict.
create or replace function public.admin_approve_claim(p_claim_id bigint, p_reason text default null)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.support_claims;
  v_label text;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  select * into c from public.support_claims where id = p_claim_id;
  if c.id is null then raise exception 'not_found'; end if;
  if public.claim_conflict_open(c.id) then raise exception 'conflict_open'; end if;
  if (not coalesce((c.verification ->> 'all_pass')::boolean, false) or c.late
      or exists (select 1 from public.support_claim_conflicts where claim_id = c.id or other_claim_id = c.id))
     and char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'reason_required';
  end if;
  v_label := case when auth.uid() is null then 'sql-editor'
                  else coalesce((select email from auth.users where id = auth.uid()), auth.uid()::text) end;
  return public.svc_approve_claim(p_claim_id, auth.uid(), v_label, p_reason);
end;
$$;

-- Resolve a conflict: who paid. Written reason required; audit log.
-- Same TXID: the winner keeps (or receives) the TXID, the other claim is
-- rejected. Same amount: just marks it resolved (each claim is then approved
-- or rejected as usual). Winner null = resolved without a winner.
create or replace function public.admin_resolve_claim_conflict(p_conflict_id bigint, p_winner_claim_id bigint, p_reason text)
returns public.support_claim_conflicts
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.support_claim_conflicts;
  v_label text;
  v_loser bigint;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'reason_required'; end if;
  select * into k from public.support_claim_conflicts where id = p_conflict_id for update;
  if k.id is null then raise exception 'not_found'; end if;
  if k.status <> 'open' then raise exception 'already_resolved'; end if;
  if p_winner_claim_id is not null and p_winner_claim_id not in (coalesce(k.claim_id, -1), coalesce(k.other_claim_id, -1)) then
    raise exception 'bad_winner';
  end if;
  v_label := case when auth.uid() is null then 'sql-editor'
                  else coalesce((select email from auth.users where id = auth.uid()), auth.uid()::text) end;

  if k.kind = 'mismo_txid' and p_winner_claim_id is not null then
    v_loser := case when p_winner_claim_id = k.claim_id then k.other_claim_id else k.claim_id end;
    if v_loser is not null then
      update public.support_claims
         set tx_hash = case when tx_hash = k.tx_hash then null else tx_hash end,
             status = case when status in ('submitted', 'manual_review', 'awaiting_payment') then 'rejected' else status end,
             reviewed_at = now(), reviewed_by = auth.uid(), reviewed_label = v_label
       where id = v_loser;
      perform public.claim_add_note(v_loser, 'conflicto_resuelto_otro_aviso', v_label);
    end if;
    update public.support_claims set tx_hash = k.tx_hash where id = p_winner_claim_id and tx_hash is null;
    perform public.claim_add_note(p_winner_claim_id, 'conflicto_resuelto_a_favor', v_label);
  end if;

  update public.support_claim_conflicts
     set status = 'resolved', winner_claim_id = p_winner_claim_id, resolved_at = now(), resolved_label = v_label, reason = left(p_reason, 500)
   where id = k.id returning * into k;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, reason, details)
  values (auth.uid(), v_label, 'claim_conflict_resolved', p_reason,
          jsonb_build_object('conflict_id', k.id, 'kind', k.kind, 'tx_hash', k.tx_hash, 'claim_id', k.claim_id,
                             'other_claim_id', k.other_claim_id, 'winner_claim_id', p_winner_claim_id));
  return k;
end;
$$;
revoke execute on function public.admin_resolve_claim_conflict(bigint, bigint, text) from public, anon;
grant execute on function public.admin_resolve_claim_conflict(bigint, bigint, text) to authenticated;

-- Panel: conflicts with both claims side by side (admin only).
create or replace function public.admin_list_claim_conflicts(p_include_resolved boolean default false)
returns table (id bigint, created_at timestamptz, kind text, status text, tx_hash text, reason text, resolved_at timestamptz,
               resolved_label text, winner_claim_id bigint, a jsonb, b jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  return query
    select k.id, k.created_at, k.kind, k.status, k.tx_hash, k.reason, k.resolved_at, k.resolved_label, k.winner_claim_id,
           (select jsonb_build_object('id', c.id, 'status', c.status, 'late', c.late, 'amount_usdc', public.usdc_text(c.amount_units),
                                      'created_at', c.created_at, 'expires_at', c.expires_at, 'submitted_at', c.submitted_at,
                                      'tx_hash', c.tx_hash, 'account_email', u.email, 'account_deleted', c.user_id is null)
              from public.support_claims c left join auth.users u on u.id = c.user_id where c.id = k.claim_id),
           (select jsonb_build_object('id', c.id, 'status', c.status, 'late', c.late, 'amount_usdc', public.usdc_text(c.amount_units),
                                      'created_at', c.created_at, 'expires_at', c.expires_at, 'submitted_at', c.submitted_at,
                                      'tx_hash', c.tx_hash, 'account_email', u.email, 'account_deleted', c.user_id is null)
              from public.support_claims c left join auth.users u on u.id = c.user_id where c.id = k.other_claim_id)
      from public.support_claim_conflicts k
     where p_include_resolved or k.status = 'open'
     order by k.created_at;
end;
$$;
revoke execute on function public.admin_list_claim_conflicts(boolean) from public, anon;
grant execute on function public.admin_list_claim_conflicts(boolean) to authenticated;

-- Panel list: + late, history and "has an open conflict".
drop function if exists public.admin_list_claims(text[]);
create function public.admin_list_claims(p_statuses text[] default array['submitted', 'manual_review'])
returns table (id bigint, user_id uuid, account_email text, flowers integer, amount_usdc text,
               tx_hash text, status text, created_at timestamptz, submitted_at timestamptz,
               expires_at timestamptz, review_reason text, verification jsonb, explorer_url text,
               contact_name text, contact_phone text, account_deleted boolean,
               late boolean, review_history jsonb, conflict_open boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  return query
    select c.id, c.user_id, u.email::text, c.flowers, public.usdc_text(c.amount_units), c.tx_hash, c.status,
           c.created_at, c.submitted_at, c.expires_at, c.review_reason, c.verification,
           case when c.tx_hash is null then null else 'https://basescan.org/tx/' || c.tx_hash end,
           c.contact_name, c.contact_phone, c.user_id is null,
           c.late, c.review_history, public.claim_conflict_open(c.id)
      from public.support_claims c left join auth.users u on u.id = c.user_id
     where c.status = any(p_statuses)
     order by coalesce(c.submitted_at, c.created_at);
end;
$$;
revoke execute on function public.admin_list_claims(text[]) from public, anon;
grant execute on function public.admin_list_claims(text[]) to authenticated;

commit;
