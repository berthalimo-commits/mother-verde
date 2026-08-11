-- Profiles: one row per auth.users, holds the real (not client-side) Free/Premium state.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_lang text not null default 'es' check (preferred_lang in ('es','en','de','fr')),
  contact_email text,
  age_verified boolean not null default false,
  onboarding_seen boolean not null default false,
  subscription_active boolean not null default false,
  subscription_expires_at timestamptz,
  subscription_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Canonical Premium check: active AND not expired. Used by the app instead of any client-side flag.
create function public.is_premium(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select subscription_active and (subscription_expires_at is null or subscription_expires_at > now())
     from public.profiles where id = uid),
    false
  );
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-create a profile row the moment someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, preferred_lang)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'preferred_lang', 'es')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Bitácora de cultivo (grow log): private, one user's own entries only.
create table public.bitacora_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date,
  etapa text,
  nota text,
  ph numeric,
  ec numeric,
  temp numeric,
  hum numeric,
  foto_url text,
  created_at timestamptz not null default now()
);

create index bitacora_entries_user_id_idx on public.bitacora_entries(user_id);

alter table public.bitacora_entries enable row level security;

create policy "bitacora_select_own" on public.bitacora_entries
  for select using (auth.uid() = user_id);

create policy "bitacora_insert_own" on public.bitacora_entries
  for insert with check (auth.uid() = user_id);

create policy "bitacora_update_own" on public.bitacora_entries
  for update using (auth.uid() = user_id);

create policy "bitacora_delete_own" on public.bitacora_entries
  for delete using (auth.uid() = user_id);
