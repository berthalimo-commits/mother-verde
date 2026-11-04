-- Rollback of 20261105100000_trial_once_per_person.sql.
-- Refuses while fingerprints exist (they are the only memory of who already
-- used the trial). To roll back anyway, first run on its own:
--   delete from public.trial_email_hashes;
-- Restores start_trial_on_email_confirmed() exactly as in 20261010120000.
begin;

do $$
begin
  if to_regclass('public.trial_email_hashes') is not null
     and exists (select 1 from public.trial_email_hashes) then
    raise exception 'trial_fingerprints_exist: run «delete from public.trial_email_hashes;» first if you really want to lose them';
  end if;
end $$;

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

drop trigger if exists on_auth_user_delete_trial on auth.users;
drop function if exists public.trial_remember_before_account_delete();
drop function if exists public.trial_email_used(uuid, text);
drop function if exists public.trial_email_hash(text);
drop table if exists public.trial_email_hashes;
drop table if exists public.trial_pepper;
drop function if exists public.trial_email_key(text);

commit;
