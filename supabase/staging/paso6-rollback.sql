-- STAGING · paso 6 · REVERSIÓN. Copia exacta de supabase/admin/rollback-20261104100000.sql.
-- Se niega si ya hay aceptaciones guardadas (expórtalas antes).
-- Rollback of 20261104100000_purpose_and_signup_message.sql.
-- Refuses while any reservation has a recorded acceptance (nothing is lost by
-- accident). Restores the hook exactly as in 20261010120000 (one generic
-- message) and lets the browser reserve with the one-argument function again.
begin;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'support_claims' and column_name = 'purpose_accepted_at')
     and exists (select 1 from public.support_claims where purpose_accepted_at is not null) then
    raise exception 'purpose_acceptances_exist: export them first (select id, user_id, purpose_accepted_at from public.support_claims where purpose_accepted_at is not null)';
  end if;
end $$;

drop function if exists public.create_support_claim(integer, boolean);
grant execute on function public.create_support_claim(integer) to authenticated;
revoke select (purpose_accepted_at) on public.support_claims from authenticated;
alter table public.support_claims drop column if exists purpose_accepted_at;

-- the hook as it was (20261010120000)
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

  -- One generic message for both cases, so the response doesn't reveal
  -- whether an address already has an account.
  if exists (
    select 1 from public.blocked_email_domains b
    where v_domain = b.domain or v_domain like '%.' || b.domain
  ) or exists (
    select 1 from public.profiles p where p.email_normalized = public.normalize_email(v_email)
  ) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'signup_not_allowed'));
  end if;

  return '{}'::jsonb;
end;
$$;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

commit;
