-- Bitácora: read-only on the SERVER too for accounts without access (A2.4).
-- Until now the screen hid «new entry» and «delete» while locked
-- (public/style.css, html.mv-locked), but the database still let an expired,
-- revoked or never-started account insert, edit and delete its own entries.
-- Now writing needs the same rule as every paid zone: has_full_access()
-- (migration 20261014140000, one access rule). Reading stays open to the
-- owner, so the read-only log and its PDF keep working without access.
-- Deleting the whole account (delete-account, service role) is not affected.
-- Independent of the other October migrations; needs 20261014140000 before it.
-- Rollback: supabase/admin/rollback-20261020100000.sql
begin;

drop policy if exists "bitacora_insert_own" on public.bitacora_entries;
create policy "bitacora_insert_own" on public.bitacora_entries
  for insert with check (auth.uid() = user_id and public.has_full_access());

drop policy if exists "bitacora_update_own" on public.bitacora_entries;
create policy "bitacora_update_own" on public.bitacora_entries
  for update using (auth.uid() = user_id and public.has_full_access())
  with check (auth.uid() = user_id and public.has_full_access());

drop policy if exists "bitacora_delete_own" on public.bitacora_entries;
create policy "bitacora_delete_own" on public.bitacora_entries
  for delete using (auth.uid() = user_id and public.has_full_access());

commit;
