-- STAGING · paso 8 · reversión (solo si hiciera falta)
-- Vuelve a 30 días; no toca datos.
-- Copia exacta de supabase/admin/rollback-20261106100000.sql.

-- Rollback of 20261106100000_gift_codes_7_days.sql: the days to redeem a code
-- created from SQL go back to 30 by default. No data is touched.
begin;

create or replace function public.admin_create_gift_codes(p_count integer default 1, p_days integer default 7, p_valid_days integer default 30)
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
