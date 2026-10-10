-- Community is part of full access: close it on the SERVER (RLS), not just
-- in the UI. Requires migration 20261010120000 (has_full_access()).
--
-- After this migration:
--   * Only signed-in people with full access (24 h trial or verified
--     contribution) can read community profiles, posts, comments and photo
--     listings, or follow / swipe / report / upload. Visitors without an
--     account see nothing (the directory is no longer public).
--   * Everyone always keeps: reading their OWN rows, deleting their own posts,
--     comments, follows, photos and member profile, and deleting the account.
--   * Publishing still goes only through the community-publish-* Edge
--     Functions; their new version checks full access and daily limits
--     (community_usage_log below).
--   * community_can_view / community_is_mutual no longer answer about other
--     people's relationships when called from the browser.
--
-- Honest limit: photos in the public bucket stay reachable by anyone who has
-- the exact URL (public bucket URLs skip these rules). Closing that needs a
-- private bucket + signed URLs — a separate change.
--
-- Undo: supabase/admin/rollback-20261010130000.sql.

-- ---------------------------------------------------------------------------
-- 1. community_members (directory / profiles)
-- ---------------------------------------------------------------------------
drop policy if exists "community_members_select_all" on public.community_members;
drop policy if exists "community_members_select_access" on public.community_members;
create policy "community_members_select_access" on public.community_members
  for select to authenticated
  using (auth.uid() = user_id or public.has_full_access());
revoke select on public.community_members from anon;

drop policy if exists "community_members_insert_own" on public.community_members;
create policy "community_members_insert_own" on public.community_members
  for insert to authenticated
  with check (auth.uid() = user_id and public.has_full_access());

drop policy if exists "community_members_update_own" on public.community_members;
create policy "community_members_update_own" on public.community_members
  for update to authenticated
  using (auth.uid() = user_id and public.has_full_access())
  with check (auth.uid() = user_id);
-- community_members_delete_own stays as it is (always allowed).

-- ---------------------------------------------------------------------------
-- 2. community_posts (writes already go only through the Edge Function)
-- ---------------------------------------------------------------------------
drop policy if exists "community_posts_select_visible" on public.community_posts;
create policy "community_posts_select_visible" on public.community_posts
  for select to authenticated
  using (
    auth.uid() = user_id
    or (public.has_full_access()
        and (featured or public.community_can_view(auth.uid(), user_id)))
  );
-- community_posts_delete_own stays (always allowed).

-- ---------------------------------------------------------------------------
-- 3. community_comments
-- ---------------------------------------------------------------------------
drop policy if exists "community_comments_select_visible" on public.community_comments;
create policy "community_comments_select_visible" on public.community_comments
  for select to authenticated
  using (
    auth.uid() = user_id
    or (public.has_full_access()
        and exists (
          select 1 from public.community_posts p
          where p.id = post_id
            and (p.featured or public.community_can_view(auth.uid(), p.user_id))
        ))
  );
-- community_comments_delete_own stays (always allowed).

-- ---------------------------------------------------------------------------
-- 4. Follows, swipes, reports: creating them needs full access.
--    Reading your own follows/swipes and unfollowing stay allowed.
-- ---------------------------------------------------------------------------
drop policy if exists "community_follows_insert_own" on public.community_follows;
create policy "community_follows_insert_own" on public.community_follows
  for insert to authenticated
  with check (auth.uid() = follower_id and public.has_full_access());

drop policy if exists "community_swipes_insert_own" on public.community_swipes;
create policy "community_swipes_insert_own" on public.community_swipes
  for insert to authenticated
  with check (auth.uid() = swiper_id and public.has_full_access());

drop policy if exists "community_reports_insert_own" on public.community_reports;
create policy "community_reports_insert_own" on public.community_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id and public.has_full_access());

-- ---------------------------------------------------------------------------
-- 5. community-photos bucket: listing / uploading / replacing need full
--    access. Deleting your own files stays allowed. (Public URLs: see top.)
-- ---------------------------------------------------------------------------
drop policy if exists "community_photos_read_all" on storage.objects;
drop policy if exists "community_photos_read_access" on storage.objects;
create policy "community_photos_read_access" on storage.objects
  for select to authenticated
  using (bucket_id = 'community-photos' and public.has_full_access());

drop policy if exists "community_photos_insert_own" on storage.objects;
create policy "community_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'community-photos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.has_full_access());

drop policy if exists "community_photos_update_own" on storage.objects;
create policy "community_photos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'community-photos'
         and (storage.foldername(name))[1] = auth.uid()::text
         and public.has_full_access());
-- community_photos_delete_own stays (always allowed).

-- ---------------------------------------------------------------------------
-- 6. Relationship helpers: from the browser, only about yourself.
--    (Server code using the service role has no auth.uid() and keeps full
--    use; the RLS policies above always pass auth.uid() as the first
--    argument, so they are unaffected.)
-- ---------------------------------------------------------------------------
create or replace function public.community_is_mutual(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.uid() is null or a = auth.uid())
    and exists(select 1 from public.community_follows where follower_id = a and followed_id = b)
    and exists(select 1 from public.community_follows where follower_id = b and followed_id = a);
$$;

create or replace function public.community_can_view(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.uid() is null or viewer = auth.uid())
    and (viewer = owner
         or exists(select 1 from public.community_follows where follower_id = viewer and followed_id = owner));
$$;

revoke execute on function public.community_is_mutual(uuid, uuid) from public, anon;
revoke execute on function public.community_can_view(uuid, uuid) from public, anon;
grant execute on function public.community_is_mutual(uuid, uuid) to authenticated, service_role;
grant execute on function public.community_can_view(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Daily limits for the publish functions (spam / DeepL quota).
--    One row per publish, written only by the Edge Functions (service role).
--    Kept even if the post is later deleted, so deleting doesn't reset the
--    limit; removed with the account (cascade). No IP or device data.
-- ---------------------------------------------------------------------------
create table if not exists public.community_usage_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('post', 'post_edit', 'comment')),
  chars      integer not null check (chars >= 0),
  created_at timestamptz not null default now()
);
create index if not exists community_usage_log_user_time_idx
  on public.community_usage_log (user_id, created_at desc);
alter table public.community_usage_log enable row level security;
revoke all on public.community_usage_log from anon, authenticated;
