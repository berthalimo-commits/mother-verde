-- The 24-hour trial: ONCE PER PERSON, even after deleting the account
-- (independent review, point 4; Bertha's APRUEBO 2026-11-04).
--
-- 1. trial_email_key(email): the e-mail normalized so aliases count as one
--    person: lower case; «+anything» removed for Gmail, Outlook/Hotmail/
--    Live/MSN, iCloud and Proton; dots removed for Gmail; googlemail.com ->
--    gmail.com, me.com/mac.com -> icloud.com, protonmail.com/.ch/pm.me ->
--    proton.me (the same mailbox under several names).
-- 2. trial_email_hashes: ONLY a SHA-256 fingerprint of that key with a secret
--    pepper (so nobody can test a list of addresses against it), no account
--    id, no date of birth, nothing else. Written when an account that already
--    used its trial is deleted (trigger on auth.users, so it also works when
--    Bertha deletes an account from the Supabase dashboard).
-- 3. start_trial_on_email_confirmed(): no trial when the fingerprint exists or
--    another live account with the same normalized e-mail already had one
--    (ana+1@gmail.com and ana+2@gmail.com). That account sees the usual
--    «sin acceso» screen with the contribution options.
-- Nobody can read these from the browser (RLS on, no policies, no grants).
-- Rollback: supabase/admin/rollback-20261105100000.sql.
-- Check:    supabase/admin/check-20261105100000.sql (read only).
-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- ---------------------------------------------------------------------------
-- 1. Normalized e-mail
-- ---------------------------------------------------------------------------
create or replace function public.trial_email_key(p_email text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
  local text;
  dom text;
begin
  if position('@' in e) = 0 then return e; end if;
  local := split_part(e, '@', 1);
  dom := substr(e, length(local) + 2);
  dom := case
    when dom = 'googlemail.com' then 'gmail.com'
    when dom in ('me.com', 'mac.com') then 'icloud.com'
    when dom in ('protonmail.com', 'protonmail.ch', 'pm.me') then 'proton.me'
    else dom end;
  if dom in ('gmail.com', 'icloud.com', 'proton.me')
     or dom ~ '^(outlook|hotmail|live|msn)\.[a-z.]+$' then
    local := split_part(local, '+', 1);
  end if;
  if dom = 'gmail.com' then local := replace(local, '.', ''); end if;
  return local || '@' || dom;
end;
$$;
revoke execute on function public.trial_email_key(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Fingerprints (and the secret pepper, created once, never shown)
-- ---------------------------------------------------------------------------
create table if not exists public.trial_pepper (
  id boolean primary key default true check (id),
  pepper text not null
);
insert into public.trial_pepper (pepper)
  values (replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  on conflict (id) do nothing;
alter table public.trial_pepper enable row level security;
revoke all on public.trial_pepper from public, anon, authenticated;

create table if not exists public.trial_email_hashes (
  hash text primary key check (hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.trial_email_hashes enable row level security;
revoke all on public.trial_email_hashes from public, anon, authenticated;

create or replace function public.trial_email_hash(p_email text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select encode(sha256(convert_to((select pepper from public.trial_pepper) || ':' || public.trial_email_key(p_email), 'UTF8')), 'hex');
$$;
revoke execute on function public.trial_email_hash(text) from public, anon, authenticated;

-- Was the trial already used by this person (another account, live or deleted)?
create or replace function public.trial_email_used(p_uid uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trial_email_hashes where hash = public.trial_email_hash(p_email))
      or exists (select 1 from auth.users u join public.profiles p on p.id = u.id
                 where u.id <> p_uid and p.trial_started_at is not null
                   and public.trial_email_key(u.email) = public.trial_email_key(p_email));
$$;
revoke execute on function public.trial_email_used(uuid, text) from public, anon, authenticated;

-- Account deleted after using its trial -> keep only the fingerprint.
create or replace function public.trial_remember_before_account_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email is not null and exists (select 1 from public.profiles where id = old.id and trial_started_at is not null) then
    insert into public.trial_email_hashes (hash) values (public.trial_email_hash(old.email)) on conflict do nothing;
  end if;
  return old;
end;
$$;
revoke execute on function public.trial_remember_before_account_delete() from public, anon, authenticated;
drop trigger if exists on_auth_user_delete_trial on auth.users;
create trigger on_auth_user_delete_trial
  before delete on auth.users
  for each row execute function public.trial_remember_before_account_delete();

-- ---------------------------------------------------------------------------
-- 3. Start the trial (as in 20261010120000) unless this person already had one
-- ---------------------------------------------------------------------------
create or replace function public.start_trial_on_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null
     and not public.trial_email_used(new.id, new.email) then
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

commit;
