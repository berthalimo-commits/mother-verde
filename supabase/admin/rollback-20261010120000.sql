-- ROLLBACK of migration 20261010120000_access_support_model.sql.
-- Puts the database back exactly as it was before that migration.
--
-- !! STEP 0, BEFORE pasting this: in the Supabase dashboard, turn OFF the
-- "Before User Created" hook (Authentication -> Hooks). If the hook still
-- points at hook_before_user_created when this script drops the function,
-- EVERY new signup fails until the hook is turned off.
--
-- What happens to people:
--   * Accounts in 'supporter' are moved to the legacy full-access state
--     (subscription_status 'none' + subscription_active true, no end date),
--     which the restored is_premium() still treats as full access — so
--     nobody who contributed loses access. Check them afterwards with the
--     last query at the bottom.
--   * Accounts in a 24 h trial keep 'trialing' with their trial_ends_at; the
--     restored is_premium() handles that exactly as before.
-- Paste in the Supabase SQL Editor, in one go.

-- 1. Auth hook function + its domain table.
drop function if exists public.hook_before_user_created(jsonb);
drop table if exists public.blocked_email_domains;

-- 2. Trial-on-confirmation trigger.
drop trigger if exists on_auth_email_confirmed on auth.users;
drop function if exists public.start_trial_on_email_confirmed();

-- 3. Old card-trial RPCs: callable again (as before).
grant execute on function public.start_free_trial(text, text) to authenticated;
grant execute on function public.cancel_subscription(boolean) to authenticated;
grant execute on function public.reactivate_subscription(boolean) to authenticated;

-- 4. has_full_access() goes; is_premium() back to its previous definition and
--    its previous (default, public) execute privilege.
drop function if exists public.has_full_access();

create or replace function public.is_premium(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      (subscription_status = 'trialing' and trial_ends_at is not null and trial_ends_at > now())
      or
      (subscription_status = 'active' and subscription_expires_at is not null and subscription_expires_at > now())
      or
      -- legacy rows set before this migration
      (subscription_status = 'none' and subscription_active
        and (subscription_expires_at is null or subscription_expires_at > now()))
    from public.profiles where id = uid
  ), false);
$$;
grant execute on function public.is_premium(uuid) to public;

-- 5. Signup trigger back to the original (no normalized e-mail).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, preferred_lang)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'preferred_lang', 'es')
  );
  return new;
end;
$$;

-- 6. 'supporter' rows -> legacy full access, then the old status list.
update public.profiles
  set subscription_status = 'none',
      subscription_active = true,
      subscription_expires_at = null
  where subscription_status = 'supporter';

alter table public.profiles drop constraint if exists profiles_subscription_status_check;
alter table public.profiles add constraint profiles_subscription_status_check
  check (subscription_status in ('none','trialing','active','canceled','past_due','blocked'));

-- 7. New columns + index.
drop index if exists public.profiles_email_normalized_idx;
alter table public.profiles drop column if exists email_normalized;
alter table public.profiles drop column if exists trial_eligible;
drop function if exists public.normalize_email(text);

-- 8. Table privileges as they were (RLS still blocks inserts/deletes and
--    other people's rows; billing columns stay non-writable from the browser).
grant insert, delete on public.profiles to authenticated, anon;
grant update on public.profiles to anon;

-- Check (read-only): who has full access now through the legacy branch.
select u.email, p.subscription_status, p.subscription_active, p.subscription_expires_at
from public.profiles p join auth.users u on u.id = p.id
where p.subscription_active;
