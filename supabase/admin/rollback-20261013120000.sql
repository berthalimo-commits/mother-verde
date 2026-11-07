-- ROLLBACK of migration 20261013120000_signup_fix_limits.sql.
-- !! Deletes the record of correction attempts (signup_fix_attempts) and
-- puts svc_signup_email_fix back as it was in 20261013100000. Only after
-- putting back the previous signup-fix-email (the new one calls the
-- functions removed here) or removing it.
-- Run BEFORE rollback-20261013110000. Runs as ONE transaction.
begin;
drop function if exists public.svc_signup_fix_finish(uuid, text, text);
drop function if exists public.svc_signup_fix_gate(text, text);
drop function if exists public.svc_signup_fix_log(text, text, uuid, text);
create or replace function public.svc_signup_email_fix(p_old text, p_new text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_new text := lower(trim(coalesce(p_new, '')));
  v_dom text;
begin
  if v_new !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'bad_email'; end if;
  select id into v_id from auth.users
   where lower(email) = lower(trim(coalesce(p_old, ''))) and email_confirmed_at is null
     and created_at > now() - interval '7 days';
  if v_id is null then raise exception 'not_found'; end if;
  v_dom := split_part(v_new, '@', 2);
  if exists (select 1 from public.blocked_email_domains b where v_dom = b.domain or v_dom like '%.' || b.domain)
     or exists (select 1 from auth.users u where lower(u.email) = v_new and u.id <> v_id)
     or exists (select 1 from public.profiles p where p.email_normalized = public.normalize_email(v_new) and p.id <> v_id)
  then
    raise exception 'not_allowed';
  end if;
  return v_id;
end;
$$;
drop function if exists public.email_fingerprint(text);
drop table if exists public.signup_fix_attempts;
commit;
