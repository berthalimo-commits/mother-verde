-- PRODUCCIÓN · archivo 24 de 32 · Propósito del aporte (casilla) + «Ya tienes cuenta».
-- Pegar ENTERO y ejecutar una vez. Es una sola transacción: si falla, no se aplica nada de este archivo.
-- Copia exacta de supabase/migrations/20261104100000_purpose_and_signup_message.sql (generado por tools/build-produccion.mjs; no editar a mano).

-- Purpose of the contribution + clear «you already have an account» (Bertha's
-- decisions, 2026-11-03).
--
-- 1. Before reserving an amount, the person ticks «I understand the purpose
--    of my contribution and I agree». The server stores ONLY that it was
--    accepted and when (support_claims.purpose_accepted_at), nothing else.
--    The browser can only reserve through the new
--    create_support_claim(p_flowers, p_purpose_ok): without the tick it is
--    refused (purpose_required). The old one-argument function stays (the
--    new one calls it) but the browser can no longer call it.
-- 2. The «Before User Created» hook now tells the two cases apart:
--    'account_exists' (the same address, or the same Gmail with dots / +tag
--    / googlemail, already has an account) and 'signup_not_allowed'
--    (disposable domain). The app shows «Ya tienes cuenta: entra o recupera
--    tu contraseña» for the first one.
-- Runs as ONE transaction. Rollback: supabase/admin/rollback-20261104100000.sql.
begin;

alter table public.support_claims add column if not exists purpose_accepted_at timestamptz;
-- the person sees their own acceptance (row rules already limit them to their own claims)
grant select (purpose_accepted_at) on public.support_claims to authenticated;

create or replace function public.create_support_claim(p_flowers integer, p_purpose_ok boolean)
returns public.support_claims
language plpgsql
security definer
set search_path = public
as $$
declare c public.support_claims;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_purpose_ok is distinct from true then raise exception 'purpose_required'; end if;
  c := public.create_support_claim(p_flowers);
  -- an open reservation reused as is keeps its first acceptance time
  update public.support_claims set purpose_accepted_at = now()
   where id = c.id and purpose_accepted_at is null;
  select * into c from public.support_claims where id = c.id;
  return c;
end;
$$;
revoke execute on function public.create_support_claim(integer, boolean) from public, anon;
grant execute on function public.create_support_claim(integer, boolean) to authenticated;
-- the browser may only reserve with the tick
revoke execute on function public.create_support_claim(integer) from authenticated;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(event->'user'->>'email'));
  v_domain text;
begin
  -- Nothing to check without an e-mail (this app only uses e-mail signup).
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    return '{}'::jsonb;
  end if;
  v_domain := split_part(v_email, '@', 2);

  if exists (
    select 1 from public.blocked_email_domains b
    where v_domain = b.domain or v_domain like '%.' || b.domain
  ) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'signup_not_allowed'));
  end if;
  -- Bertha's decision (2026-11-03): say clearly that the account exists.
  if exists (select 1 from public.profiles p where p.email_normalized = public.normalize_email(v_email)) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'account_exists'));
  end if;

  return '{}'::jsonb;
end;
$$;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

commit;
