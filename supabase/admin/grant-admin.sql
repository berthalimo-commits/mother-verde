-- Give the admin role to an existing account (by e-mail). Paste in the
-- Supabase SQL Editor. Nobody can do this from the app.
insert into public.admin_users (user_id, note) select id, 'owner' from auth.users where lower(email) = 'berthalimo@gmail.com' on conflict (user_id) do nothing;
select u.email, a.added_at from public.admin_users a join auth.users u on u.id = a.user_id;
