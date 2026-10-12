-- Give the admin role to hello@motherverdeny.com — and ONLY to that account.
-- Paste in the Supabase SQL Editor, the whole file at once. Nobody can do
-- this from the app.
--
-- WHEN: after the merge to main, once you have (i) signed up in the app with
-- hello@motherverdeny.com and (ii) confirmed that e-mail. Then open the panel
-- (/panel-mv.html) and turn on two-step verification.
--
-- If that account doesn't exist yet, or its e-mail isn't confirmed, it STOPS
-- with a clear message and changes nothing (nobody gets the role).
-- Betian (berthalimo@gmail.com) is a member profile and never an admin: if it
-- ever had the role, it is removed here.
-- Runs as ONE transaction.
begin;
do $$
declare
  v_id uuid;
  v_confirmed timestamptz;
begin
  select id, email_confirmed_at into v_id, v_confirmed
    from auth.users where lower(email) = 'hello@motherverdeny.com';
  if v_id is null then
    raise exception 'NO SE HIZO NADA: no existe ninguna cuenta con hello@motherverdeny.com. Regístrate primero en la app con ese correo, confírmalo y vuelve a pegar este archivo.';
  end if;
  if v_confirmed is null then
    raise exception 'NO SE HIZO NADA: la cuenta hello@motherverdeny.com existe pero su correo no está confirmado. Abre el enlace del correo de confirmación y vuelve a pegar este archivo.';
  end if;
  insert into public.admin_users (user_id, note) values (v_id, 'owner (hello@motherverdeny.com)')
  on conflict (user_id) do nothing;
  delete from public.admin_users a using auth.users u
   where u.id = a.user_id and lower(u.email) = 'berthalimo@gmail.com';
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason)
  values (null, 'sql-editor', 'admin_granted', v_id, 'hello@motherverdeny.com', 'grant-admin.sql');
end $$;
commit;

-- Result: must show exactly one row, hello@motherverdeny.com.
select u.email, a.added_at, a.note from public.admin_users a join auth.users u on u.id = a.user_id;
