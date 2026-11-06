-- STAGING · paso 8 · códigos de regalo desde SQL: 7 días (migración 20261106100000)
-- Pegar ENTERO en el SQL Editor de STAGING. Una sola transacción.
-- Copia exacta de supabase/migrations/20261106100000_gift_codes_7_days.sql.

-- Gift codes created from SQL / the SQL editor (admin_create_gift_codes): the
-- days to REDEEM a code now default to 7, like the e-mailed codes
-- (admin-send-gift-code: CODE_VALID_DAYS = 7) and like the Terms say
-- (2nd independent review, Bertha's APRUEBO 2026-11-06). Before: 30.
-- Only the default changes; codes already created keep their date.
-- Rollback: supabase/admin/rollback-20261106100000.sql (puts 30 back; no data touched).
-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

create or replace function public.admin_create_gift_codes(p_count integer default 1, p_days integer default 7, p_valid_days integer default 7)
returns table (code text, days integer, redeem_before timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  i integer;
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  if p_count is null or p_count < 1 or p_count > 20 then raise exception 'bad_count'; end if;
  if public.gift_codes_created_today() + p_count > 20 then raise exception 'daily_limit_20'; end if;
  for i in 1..p_count loop
    v_code := public.gift_code_generate();
    insert into public.gift_codes (code_hash, days, expires_at, created_by, created_label)
    values (public.gift_code_hash(v_code), p_days, now() + make_interval(days => p_valid_days), auth.uid(), public.admin_actor_label());
    code := v_code; days := p_days; redeem_before := now() + make_interval(days => p_valid_days);
    return next;
  end loop;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, reason, details)
  values (auth.uid(), public.admin_actor_label(), 'gift_codes_created', null,
          jsonb_build_object('count', p_count, 'days', p_days, 'valid_days', p_valid_days));
end;
$$;

commit;
