-- READ-ONLY. Changes nothing. Lists the accounts from the old card model that
-- the app used to show as "full access" although the server said "no access":
-- status 'active' WITHOUT an end date (and the older 'none' + subscription_active
-- rows, shown for comparison). Since 20261014140000 the app and the server use
-- the same rule, so 'has_access_now' is what BOTH show today. Paste in the SQL
-- Editor and decide what to do with each account (nothing is changed here).
select u.email,
       p.subscription_status,
       p.subscription_active,
       p.subscription_expires_at,
       p.access_until,
       p.trial_ends_at,
       p.created_at,
       public.is_premium(p.id) as has_access_now
  from public.profiles p
  join auth.users u on u.id = p.id
 where (p.subscription_status = 'active' and p.subscription_expires_at is null)
    or (p.subscription_status = 'none' and p.subscription_active)
 order by p.created_at;
