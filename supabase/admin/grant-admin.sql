-- hello@motherverdeny.com = ADMIN + FULL ACCESS (no end date) — and ONLY that
-- account. Paste in the Supabase SQL Editor. Nobody can do this from the app.
-- Undo: rollback-grant-admin.sql.
--
-- WHEN: after the merge to main, once you have (i) signed up in the app with
-- hello@motherverdeny.com and (ii) confirmed that e-mail. Then open the panel
-- (/panel-mv.html) and turn on two-step verification: the panel's data needs
-- it (checked in the database, not only on screen).
--
-- What it does, for that one account:
--   * admin role (row in admin_users);
--   * full access with no end date (profiles.subscription_status = 'supporter',
--     the same as a verified contribution).
-- Safe to paste again: nothing is duplicated, and the audit log only gets a
-- line when something actually changed. No other account is touched.
-- If the account doesn't exist yet, has no profile, or its e-mail isn't
-- confirmed, PART 2 STOPS with a clear message and changes nothing.

-- PART 1 (read-only): which account was found and how it is now.
-- Select from here down to the line "PART 2", run it, and check it shows
-- exactly one row: hello@motherverdeny.com, e-mail confirmed = true.
select u.id, u.email,
       u.email_confirmed_at is not null                                   as email_confirmed,
       p.id is not null                                                   as has_profile,
       p.subscription_status, p.access_until,
       exists (select 1 from public.admin_users a where a.user_id = u.id) as is_admin_now
  from auth.users u
  left join public.profiles p on p.id = u.id
 where lower(u.email) = 'hello@motherverdeny.com';
-- (also read-only) every account that is admin today, for your information:
select u.email, a.added_at, a.note from public.admin_users a join auth.users u on u.id = a.user_id;

-- PART 2: make the changes. One transaction: all or nothing.
begin;
do $$
declare
  v_id uuid;
  v_confirmed timestamptz;
  v_prev text;
  v_rows integer;
begin
  select id, email_confirmed_at into v_id, v_confirmed
    from auth.users where lower(email) = 'hello@motherverdeny.com';
  if v_id is null then
    raise exception 'NO SE HIZO NADA: no existe ninguna cuenta con hello@motherverdeny.com. Regístrate primero en la app con ese correo, confírmalo y vuelve a pegar este archivo.';
  end if;
  if v_confirmed is null then
    raise exception 'NO SE HIZO NADA: la cuenta hello@motherverdeny.com existe pero su correo no está confirmado. Abre el enlace del correo de confirmación y vuelve a pegar este archivo.';
  end if;
  select subscription_status into v_prev from public.profiles where id = v_id for update;
  if not found then
    raise exception 'NO SE HIZO NADA: la cuenta hello@motherverdeny.com no tiene fila en profiles. Entra una vez en la app con esa cuenta y vuelve a pegar este archivo.';
  end if;

  -- 1) admin role
  insert into public.admin_users (user_id, note) values (v_id, 'owner (hello@motherverdeny.com)')
  on conflict (user_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason)
    values (null, 'sql-editor', 'admin_granted', v_id, 'hello@motherverdeny.com', 'grant-admin.sql');
  end if;

  -- 2) full access, no end date (the previous state is kept for the rollback)
  if v_prev is distinct from 'supporter' then
    update public.profiles set subscription_status = 'supporter' where id = v_id;
    insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
    values (null, 'sql-editor', 'owner_full_access', v_id, 'hello@motherverdeny.com', 'grant-admin.sql',
            jsonb_build_object('previous_status', v_prev));
  end if;
end $$;
commit;

-- Result: one row, hello@motherverdeny.com, is_admin = true, subscription_status = supporter, full_access = true.
select u.email,
       exists (select 1 from public.admin_users a where a.user_id = u.id) as is_admin,
       p.subscription_status,
       public.is_premium(u.id)                                            as full_access
  from auth.users u join public.profiles p on p.id = u.id
 where lower(u.email) = 'hello@motherverdeny.com';
