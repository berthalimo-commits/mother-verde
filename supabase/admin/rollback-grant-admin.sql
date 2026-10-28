-- ROLLBACK of grant-admin.sql: hello@motherverdeny.com stops being admin and
-- gets back the access state it had BEFORE grant-admin.sql gave it full access
-- (taken from the audit log, action 'owner_full_access'). If grant-admin.sql
-- never changed its access (it was already 'supporter'), the access stays.
-- No other account is touched. Safe to paste again.

-- PART 1 (read-only): what PART 2 would change.
select u.email,
       exists (select 1 from public.admin_users a where a.user_id = u.id) as is_admin_now,
       p.subscription_status                                              as status_now,
       (select l.details ->> 'previous_status' from public.admin_audit_log l
         where l.target_user_id = u.id and l.action = 'owner_full_access'
         order by l.at desc, l.id desc limit 1)                           as status_after_rollback
  from auth.users u join public.profiles p on p.id = u.id
 where lower(u.email) = 'hello@motherverdeny.com';

-- PART 2: one transaction.
begin;
do $$
declare
  v_id uuid;
  v_prev text;
  v_rows integer;
begin
  select id into v_id from auth.users where lower(email) = 'hello@motherverdeny.com';
  if v_id is null then
    raise exception 'NO SE HIZO NADA: no existe ninguna cuenta con hello@motherverdeny.com.';
  end if;

  delete from public.admin_users where user_id = v_id;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason)
    values (null, 'sql-editor', 'admin_removed', v_id, 'hello@motherverdeny.com', 'rollback-grant-admin.sql');
  end if;

  select l.details ->> 'previous_status' into v_prev from public.admin_audit_log l
   where l.target_user_id = v_id and l.action = 'owner_full_access'
   order by l.at desc, l.id desc limit 1;
  if v_prev is not null and v_prev <> 'supporter' then
    update public.profiles set subscription_status = v_prev
     where id = v_id and subscription_status = 'supporter';
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
      values (null, 'sql-editor', 'owner_full_access_removed', v_id, 'hello@motherverdeny.com', 'rollback-grant-admin.sql',
              jsonb_build_object('restored_status', v_prev));
    end if;
  end if;
end $$;
commit;

-- Result: is_admin = false; subscription_status = the one it had before.
select u.email,
       exists (select 1 from public.admin_users a where a.user_id = u.id) as is_admin,
       p.subscription_status
  from auth.users u join public.profiles p on p.id = u.id
 where lower(u.email) = 'hello@motherverdeny.com';
