-- ROLLBACK of migration 20261020100000_bitacora_read_only_without_access.sql.
-- Loses nothing (no data changes): puts back the previous rules, where any
-- signed-in owner could write to their own Bitácora, with or without access.
-- Runs as ONE transaction.
begin;

drop policy if exists "bitacora_insert_own" on public.bitacora_entries;
create policy "bitacora_insert_own" on public.bitacora_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "bitacora_update_own" on public.bitacora_entries;
create policy "bitacora_update_own" on public.bitacora_entries
  for update using (auth.uid() = user_id);

drop policy if exists "bitacora_delete_own" on public.bitacora_entries;
create policy "bitacora_delete_own" on public.bitacora_entries
  for delete using (auth.uid() = user_id);

commit;
