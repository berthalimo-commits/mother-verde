-- Community redesign Fase 1: profiles (cover photo + bio), posts, follows, swipes
-- (Descubrir), comments (unlocked by mutual follow), and reports (manual review only —
-- no automated moderation exists yet, matching the app's own honest copy elsewhere).

-- ---------------------------------------------------------------------------
-- 1. Extend the existing public directory with cover photo + short bio.
--    Additive, non-destructive — existing rows and app behavior are unaffected.
-- ---------------------------------------------------------------------------
alter table public.community_members
  add column cover_photo_url text,
  add column bio text;

-- ---------------------------------------------------------------------------
-- 2. Posts: text or photo, one row per post. Visible to the author and to
--    anyone who follows them (one-directional follow unlocks full profile +
--    feed, per product decision — mutual follow is a stricter gate used only
--    for comments below).
-- ---------------------------------------------------------------------------
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('text','photo')),
  body text,
  photo_url text,
  created_at timestamptz not null default now(),
  check (kind = 'text' or photo_url is not null)
);

create index community_posts_user_id_idx on public.community_posts(user_id);
create index community_posts_created_at_idx on public.community_posts(created_at desc);

alter table public.community_posts enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Follows: one row per (follower, followed) pair. Mutual = both directions
--    exist. A right-swipe in Descubrir both records the swipe AND creates the
--    follow row (see trigger below) — a left-swipe never creates a follow.
-- ---------------------------------------------------------------------------
create table public.community_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index community_follows_followed_id_idx on public.community_follows(followed_id);

alter table public.community_follows enable row level security;

create policy "community_follows_select_own" on public.community_follows
  for select to authenticated
  using (auth.uid() = follower_id or auth.uid() = followed_id);

create policy "community_follows_insert_own" on public.community_follows
  for insert to authenticated
  with check (auth.uid() = follower_id);

create policy "community_follows_delete_own" on public.community_follows
  for delete to authenticated
  using (auth.uid() = follower_id);

-- ---------------------------------------------------------------------------
-- 4. Swipes: one row per (swiper, swiped) pair — lets Descubrir exclude
--    profiles already seen, regardless of direction.
-- ---------------------------------------------------------------------------
create table public.community_swipes (
  swiper_id uuid not null references auth.users(id) on delete cascade,
  swiped_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('left','right')),
  created_at timestamptz not null default now(),
  primary key (swiper_id, swiped_id),
  check (swiper_id <> swiped_id)
);

alter table public.community_swipes enable row level security;

create policy "community_swipes_select_own" on public.community_swipes
  for select to authenticated
  using (auth.uid() = swiper_id);

create policy "community_swipes_insert_own" on public.community_swipes
  for insert to authenticated
  with check (auth.uid() = swiper_id);

-- A right-swipe also creates the follow relationship, atomically.
create function public.handle_community_swipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction = 'right' then
    insert into public.community_follows (follower_id, followed_id)
    values (new.swiper_id, new.swiped_id)
    on conflict (follower_id, followed_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_community_swipe
  after insert on public.community_swipes
  for each row execute procedure public.handle_community_swipe();

-- ---------------------------------------------------------------------------
-- Helper: true if a and b follow each other in both directions.
-- Reused by the comments RLS policy below and callable directly from the
-- client (supabase.rpc('community_is_mutual', {a: ..., b: ...})) so the UI
-- can decide whether to show the comment box without extra round trips.
-- ---------------------------------------------------------------------------
create function public.community_is_mutual(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists(select 1 from public.community_follows where follower_id = a and followed_id = b)
    and
    exists(select 1 from public.community_follows where follower_id = b and followed_id = a);
$$;

-- Helper: true if viewer can see owner's full profile/posts (self, or follows them).
create function public.community_can_view(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select viewer = owner
    or exists(select 1 from public.community_follows where follower_id = viewer and followed_id = owner);
$$;

-- Posts: visible to the author and to anyone who follows them.
create policy "community_posts_select_visible" on public.community_posts
  for select to authenticated
  using (public.community_can_view(auth.uid(), user_id));

create policy "community_posts_insert_own" on public.community_posts
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "community_posts_update_own" on public.community_posts
  for update to authenticated
  using (auth.uid() = user_id);

create policy "community_posts_delete_own" on public.community_posts
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Comments: only insertable when the commenter and the post's author
--    mutually follow each other (or the commenter is the author). Visible to
--    anyone who could see the underlying post (its author + their followers)
--    — comments stay fully public within the post's own audience, never a
--    private side-channel.
-- ---------------------------------------------------------------------------
create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index community_comments_post_id_idx on public.community_comments(post_id);

alter table public.community_comments enable row level security;

create policy "community_comments_select_visible" on public.community_comments
  for select to authenticated
  using (
    exists(
      select 1 from public.community_posts p
      where p.id = post_id and public.community_can_view(auth.uid(), p.user_id)
    )
  );

create policy "community_comments_insert_unlocked" on public.community_comments
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists(
      select 1 from public.community_posts p
      where p.id = post_id
        and (p.user_id = auth.uid() or public.community_is_mutual(auth.uid(), p.user_id))
    )
  );

create policy "community_comments_delete_own" on public.community_comments
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Reports: insert-only from the client. No select policy is granted to
--    anon/authenticated on purpose — reports are reviewed manually via the
--    Supabase dashboard (service_role) until real moderation tooling exists,
--    matching the "sin moderación real todavía" note already used elsewhere
--    in the app's own copy.
-- ---------------------------------------------------------------------------
create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('profile','post','comment')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now()
);

alter table public.community_reports enable row level security;

create policy "community_reports_insert_own" on public.community_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- 7. Storage: a public bucket for cover photos and post photos. Photo URLs
--    are unguessable (UUID-based paths) but the bucket itself is public, so
--    a raw photo URL is viewable without an access check — the surrounding
--    metadata (who posted it, captions, profile bios) stays fully protected
--    by the RLS policies above. This tradeoff is intentional for Fase 1 to
--    avoid the added complexity of signed, per-viewer URLs; flagged here so
--    it's a documented decision, not a silent gap.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('community-photos', 'community-photos', true)
on conflict (id) do nothing;

create policy "community_photos_read_all" on storage.objects
  for select
  using (bucket_id = 'community-photos');

create policy "community_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'community-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "community_photos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'community-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "community_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'community-photos' and (storage.foldername(name))[1] = auth.uid()::text);
