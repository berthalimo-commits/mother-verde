-- ROLLBACK of migration 20261014140000_one_access_rule.sql: puts back the
-- previous is_premium() and admin_access_state() (same results) and removes
-- access_info() and my_access(). The app of that commit needs my_access():
-- roll the web back first. Runs as ONE transaction.
begin;
create or replace function public.is_premium(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      subscription_status = 'supporter'
      or (subscription_status = 'trialing' and trial_ends_at is not null and trial_ends_at > now())
      -- days granted by a gift code or an admin (not while access is revoked):
      or (subscription_status <> 'revoked' and access_until is not null and access_until > now())
      -- old subscription model (inactive while ACCESS_MODEL = 'support'):
      or (subscription_status = 'active' and subscription_expires_at is not null and subscription_expires_at > now())
      or (subscription_status = 'none' and subscription_active
          and (subscription_expires_at is null or subscription_expires_at > now()))
    from public.profiles where id = uid
  ), false);
$$;
create or replace function public.admin_access_state(p public.profiles)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p.subscription_status = 'revoked' then 'bloqueado'
    when p.subscription_status = 'supporter' then 'acceso_completo'
    when p.access_until is not null and p.access_until > now() then 'regalo'
    when p.subscription_status = 'trialing' and p.trial_ends_at > now() then 'prueba_activa'
    when public.is_premium(p.id) then 'acceso_completo'
    when p.trial_started_at is not null then 'prueba_vencida'
    else 'sin_prueba' end;
$$;
drop function if exists public.my_access();
drop function if exists public.access_info(uuid);
commit;
