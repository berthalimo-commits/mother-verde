-- Community directory: publicly readable, one entry per account.
-- Email is intentionally NOT here — it stays private in profiles.contact_email,
-- matching the app's own copy ("tu correo nunca se muestra públicamente").
create table public.community_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  country text,
  profile_type text check (profile_type in ('cultivador','negocio','entusiasta','salud','aprendiendo','otro')),
  created_at timestamptz not null default now()
);

alter table public.community_members enable row level security;

create policy "community_members_select_all" on public.community_members
  for select
  to anon, authenticated
  using (true);

create policy "community_members_insert_own" on public.community_members
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "community_members_update_own" on public.community_members
  for update
  to authenticated
  using (auth.uid() = user_id);

create policy "community_members_delete_own" on public.community_members
  for delete
  to authenticated
  using (auth.uid() = user_id);
