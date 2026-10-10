-- Full access for the owner's two accounts, so they are never blocked.
-- Paste in the Supabase SQL Editor AFTER the 20261010120000 migration.
-- Run PART 1 first (read-only) and check it shows exactly these two
-- accounts; only then run PART 2.

-- PART 1 (read-only): which rows PART 2 would change.
select u.id, u.email, m.display_name, p.subscription_status
from auth.users u
join public.profiles p on p.id = u.id
left join public.community_members m on m.user_id = u.id
where (u.email = 'berthalimo@gmail.com' and m.display_name = 'Betian')
   or (u.id = '5bcf51c6-db9d-4965-906e-c1fb426eb0b3' and u.email = 'berthalimo@proton.me');

-- PART 2: mark both as 'supporter' (full access, no end date).
update public.profiles p
set subscription_status = 'supporter'
from auth.users u
left join public.community_members m on m.user_id = u.id
where p.id = u.id
  and ((u.email = 'berthalimo@gmail.com' and m.display_name = 'Betian')
    or (u.id = '5bcf51c6-db9d-4965-906e-c1fb426eb0b3' and u.email = 'berthalimo@proton.me'))
returning p.id, u.email, p.subscription_status;
