-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- ONE access rule (audit 10.2 / 15.3). Until now it was written three times:
-- is_premium() here, computeIsPremium() in src/auth.js and mvAccessState() in
-- public/main.js, and they disagreed on old "active" rows without an end date.
-- Now access_info(uid) is the only place where the rule lives:
--   * is_premium(uid) / has_full_access() (RLS, Edge Functions) read it;
--   * the panel's state (admin_access_state) reads it;
--   * the app asks my_access() and only compares "until" with the SERVER's
--     clock (server_now), so a wrong phone clock no longer matters.
-- Same outcomes as the previous is_premium() for every row. Requires
-- 20261010120000 and 20261011130000. No account is changed.

create or replace function public.access_info(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select (case
      when p.subscription_status = 'supporter'
        then jsonb_build_object('state', 'supporter', 'full', true, 'until', null)
      when p.subscription_status = 'revoked'
        then jsonb_build_object('state', 'revoked', 'full', false, 'until', null)
      -- days granted by a gift code or an admin
      when p.access_until is not null and p.access_until > now()
        then jsonb_build_object('state', 'granted', 'full', true,
               'until', greatest(p.access_until, case when p.subscription_status = 'trialing' then p.trial_ends_at end))
      when p.subscription_status = 'trialing' and p.trial_ends_at is not null and p.trial_ends_at > now()
        then jsonb_build_object('state', 'trial', 'full', true, 'until', p.trial_ends_at)
      -- old card model, honoured until its end date
      when p.subscription_status = 'active' and p.subscription_expires_at is not null and p.subscription_expires_at > now()
        then jsonb_build_object('state', 'legacy', 'full', true, 'until', p.subscription_expires_at)
      when p.subscription_status = 'none' and p.subscription_active
           and (p.subscription_expires_at is null or p.subscription_expires_at > now())
        then jsonb_build_object('state', 'legacy', 'full', true, 'until', p.subscription_expires_at)
      when p.trial_started_at is not null
        then jsonb_build_object('state', 'expired', 'full', false, 'until', null)
      else jsonb_build_object('state', 'no_trial', 'full', false, 'until', null)
    end) || jsonb_build_object('trial_started', p.trial_started_at is not null)
    from public.profiles p where p.id = uid),
    jsonb_build_object('state', 'no_profile', 'full', false, 'until', null, 'trial_started', false));
$$;
revoke execute on function public.access_info(uuid) from public, anon, authenticated;
grant execute on function public.access_info(uuid) to service_role;

-- The server rule (RLS, publishing, ...) now reads access_info.
create or replace function public.is_premium(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (public.access_info(uid) ->> 'full')::boolean;
$$;

-- The app: my own access + the server clock.
create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null
              else public.access_info(auth.uid()) || jsonb_build_object('server_now', now()) end;
$$;
revoke execute on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- The panel's labels, from the same rule.
create or replace function public.admin_access_state(p public.profiles)
returns text language sql stable security definer set search_path = public as $$
  select case public.access_info(p.id) ->> 'state'
    when 'revoked' then 'bloqueado'
    when 'supporter' then 'acceso_completo'
    when 'legacy' then 'acceso_completo'
    when 'granted' then 'regalo'
    when 'trial' then 'prueba_activa'
    when 'expired' then 'prueba_vencida'
    else 'sin_prueba' end;
$$;

commit;
