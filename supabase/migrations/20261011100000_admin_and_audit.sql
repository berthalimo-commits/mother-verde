-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- Administration: who is an admin, how that is checked on the server, and an
-- audit log of every administrative action.
--
--   * admin_users: one row per admin. Nobody can add themselves: the browser
--     has no privilege at all on this table. Rows are added only by the owner
--     pasting SQL in the Supabase SQL Editor (supabase/admin/grant-admin.sql).
--   * is_admin_aal2(): true only for a signed-in admin whose session passed
--     MFA (JWT claim aal = 'aal2'). Every admin function checks it; the panel's
--     buttons are not security.
--   * is_sql_editor(): true when the call doesn't come through the Supabase
--     API (no JWT claims at all) — i.e. the owner in the SQL Editor or a
--     direct database connection, both of which already have full control.
--   * admin_audit_log: who, what, which account, why, when. Written only by
--     the admin functions; admins with MFA can read it; nobody can edit it.

create table if not exists public.admin_users (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  note     text
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_sql_editor()
returns boolean
language sql
stable
set search_path = public
as $$
  -- PostgREST always sets request.jwt.claims (even for anon); the SQL Editor
  -- and direct connections never do.
  select coalesce(current_setting('request.jwt.claims', true), '') = '';
$$;

create or replace function public.is_admin_aal2()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

-- For the panel: "am I an admin, and is MFA done?" Reveals nothing about
-- anyone else.
create or replace function public.admin_whoami()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'admin', auth.uid() is not null and exists (select 1 from public.admin_users a where a.user_id = auth.uid()),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'));
$$;

create table if not exists public.admin_audit_log (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  actor_user_id  uuid,          -- null = SQL Editor / server job
  actor_label    text not null, -- admin e-mail, 'sql-editor' or 'auto-verify'
  action         text not null,
  target_user_id uuid,
  target_email   text,
  reason         text,
  details        jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_log_at_idx on public.admin_audit_log (at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

-- Internal: record one admin action. Not callable from the browser.
create or replace function public.admin_log(p_action text, p_target_user uuid, p_reason text, p_details jsonb default '{}'::jsonb, p_actor_label text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_label text := p_actor_label;
begin
  if v_label is null then
    v_label := case when v_actor is null then 'sql-editor'
                    else coalesce((select email from auth.users where id = v_actor), v_actor::text) end;
  end if;
  insert into public.admin_audit_log (actor_user_id, actor_label, action, target_user_id, target_email, reason, details)
  values (v_actor, v_label, p_action, p_target_user,
          (select email from auth.users where id = p_target_user), p_reason, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Read the audit log (admins with MFA; also the SQL Editor).
create or replace function public.admin_list_audit(p_limit integer default 200)
returns setof public.admin_audit_log
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin_aal2() or public.is_sql_editor()) then raise exception 'not_allowed'; end if;
  return query select * from public.admin_audit_log order by at desc limit least(greatest(p_limit, 1), 1000);
end;
$$;

revoke execute on function public.is_sql_editor() from public, anon, authenticated;
revoke execute on function public.admin_log(text, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_log(text, uuid, text, jsonb, text) to service_role;
revoke execute on function public.is_admin_aal2() from public, anon;
grant execute on function public.is_admin_aal2() to authenticated, service_role;
revoke execute on function public.admin_whoami() from public, anon;
grant execute on function public.admin_whoami() to authenticated;
revoke execute on function public.admin_list_audit(integer) from public, anon;
grant execute on function public.admin_list_audit(integer) to authenticated;

commit;
