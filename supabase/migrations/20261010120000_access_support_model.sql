-- Access model "support": 24 h free trial for NEW accounts (starts when the
-- e-mail is confirmed), then full access only through a manually verified
-- one-time support contribution (status 'supporter'). Replaces the 3-day card
-- trial, which stays in the schema but can no longer be started.
--
-- Also: signup abuse controls (disposable domains, Gmail normalization) via
-- the Supabase "Before User Created" auth hook. No IP address, device data or
-- phone number is stored anywhere.
--
-- Paste in the Supabase SQL Editor. Then:
--   * paste supabase/seed-blocked-email-domains/part-01.sql … part-07.sql, and
--   * LAST, enable the hook (Authentication -> Hooks -> "Before User Created"
--     -> Postgres -> schema public -> function hook_before_user_created),
--     following supabase/admin/hook-activation-plan.md.
-- Undo: supabase/admin/rollback-20261010120000.sql.
-- REQUIRED: Authentication -> "Confirm email" must be ON. If it is off,
-- Supabase fills email_confirmed_at at signup without a real confirmation,
-- and the trigger below never fires (no trial at all: fails closed).

-- ---------------------------------------------------------------------------
-- 1. New status 'supporter' + who may still get a trial.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_subscription_status_check;
alter table public.profiles add constraint profiles_subscription_status_check
  check (subscription_status in ('none','trialing','active','canceled','past_due','blocked','supporter'));

-- Existing rows get false (no automatic trial for accounts that already
-- exist); every profile created after this migration gets true.
alter table public.profiles add column if not exists trial_eligible boolean not null default false;
alter table public.profiles alter column trial_eligible set default true;

-- Normalized e-mail, only to detect the same address registered twice.
alter table public.profiles add column if not exists email_normalized text;

-- Column privileges: the browser still may update ONLY these five columns.
-- (Re-stated so the new columns are explicitly not client-writable.)
revoke update on public.profiles from authenticated, anon;
grant update (display_name, preferred_lang, contact_email, age_verified, onboarding_seen)
  on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. E-mail normalization (Gmail: dots and +alias don't make a new address).
-- ---------------------------------------------------------------------------
create or replace function public.normalize_email(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p is null or position('@' in p) = 0 then lower(trim(p))
    when lower(split_part(trim(p), '@', 2)) in ('gmail.com', 'googlemail.com') then
      replace(split_part(lower(split_part(trim(p), '@', 1)), '+', 1), '.', '') || '@gmail.com'
    else lower(trim(p))
  end;
$$;

update public.profiles p
  set email_normalized = public.normalize_email(u.email)
  from auth.users u
  where u.id = p.id and p.email_normalized is null;

create index if not exists profiles_email_normalized_idx on public.profiles (email_normalized);

-- New signups: same profile row as before, plus the normalized e-mail.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, preferred_lang, email_normalized)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'preferred_lang', 'es'),
    public.normalize_email(new.email)
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Who has full access. is_premium(uid) stays the single source of truth.
-- ---------------------------------------------------------------------------
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
      -- old subscription model (inactive while ACCESS_MODEL = 'support'):
      or (subscription_status = 'active' and subscription_expires_at is not null and subscription_expires_at > now())
      or (subscription_status = 'none' and subscription_active
          and (subscription_expires_at is null or subscription_expires_at > now()))
    from public.profiles where id = uid
  ), false);
$$;

-- is_premium(uid) answered for ANY uid, so a signed-in user could ask about
-- someone else. Only the server (service role / definer functions) may call
-- it now; the browser and RLS policies use has_full_access() (own account).
revoke execute on function public.is_premium(uuid) from public, anon, authenticated;
grant execute on function public.is_premium(uuid) to service_role;

create or replace function public.has_full_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.is_premium(auth.uid());
$$;
revoke execute on function public.has_full_access() from public;
grant execute on function public.has_full_access() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Start the 24 h trial when the e-mail becomes confirmed. Once per account
--    (trial_started_at), only for accounts created after this migration
--    (trial_eligible), never from the browser.
-- ---------------------------------------------------------------------------
create or replace function public.start_trial_on_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
      set subscription_status = 'trialing',
          trial_started_at = new.email_confirmed_at,
          trial_ends_at = new.email_confirmed_at + interval '24 hours'
      where id = new.id
        and trial_eligible
        and trial_started_at is null
        and subscription_status = 'none';
  end if;
  return new;
end;
$$;
revoke execute on function public.start_trial_on_email_confirmed() from public, anon, authenticated;

drop trigger if exists on_auth_email_confirmed on auth.users;
create trigger on_auth_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.start_trial_on_email_confirmed();

-- ---------------------------------------------------------------------------
-- 5. The old 3-day card trial and its cancel/reactivate RPCs: nobody may call
--    them while the support model is live. (To restore the subscription
--    model: grant execute ... to authenticated on these three again.)
-- ---------------------------------------------------------------------------
revoke execute on function public.start_free_trial(text, text) from public, anon, authenticated;
revoke execute on function public.cancel_subscription(boolean) from public, anon, authenticated;
revoke execute on function public.reactivate_subscription(boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Signup abuse controls: Before User Created auth hook.
--    Blocked domains live in this table; the list itself is in
--    supabase/blocked-email-domains.txt (seed: seed-blocked-email-domains/part-*.sql).
--    To block one more domain:
--      insert into public.blocked_email_domains (domain) values ('example.org');
-- ---------------------------------------------------------------------------
create table if not exists public.blocked_email_domains (
  domain   text primary key check (domain = lower(domain) and domain !~ '\s'),
  added_at timestamptz not null default now()
);
alter table public.blocked_email_domains enable row level security;
revoke all on public.blocked_email_domains from anon, authenticated;

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
