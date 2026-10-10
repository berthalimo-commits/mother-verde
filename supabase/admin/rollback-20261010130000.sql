-- ROLLBACK of migration 20261010130000_community_full_access.sql.
-- Restores the Community rules exactly as they were before (directory public,
-- no full-access check). Run this BEFORE rollback-20261010120000.sql if you
-- undo both (these rules use has_full_access(), which that one removes).
-- Paste in the Supabase SQL Editor, in one go.

-- 1. community_members
drop policy if exists "community_members_select_access" on public.community_members;
create policy "community_members_select_all" on public.community_members
  for select to anon, authenticated using (true);
grant select on public.community_members to anon;

drop policy if exists "community_members_insert_own" on public.community_members;
create policy "community_members_insert_own" on public.community_members
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "community_members_update_own" on public.community_members;
create policy "community_members_update_own" on public.community_members
  for update to authenticated using (auth.uid() = user_id);

-- 2. community_posts
drop policy if exists "community_posts_select_visible" on public.community_posts;
create policy "community_posts_select_visible" on public.community_posts
  for select to authenticated
  using (featured or public.community_can_view(auth.uid(), user_id));

-- 3. community_comments
drop policy if exists "community_comments_select_visible" on public.community_comments;
create policy "community_comments_select_visible" on public.community_comments
  for select to authenticated
  using (
    exists(
      select 1 from public.community_posts p
      where p.id = post_id
        and (p.featured or public.community_can_view(auth.uid(), p.user_id))
    )
  );

-- 4. follows / swipes / reports
drop policy if exists "community_follows_insert_own" on public.community_follows;
create policy "community_follows_insert_own" on public.community_follows
  for insert to authenticated with check (auth.uid() = follower_id);

drop policy if exists "community_swipes_insert_own" on public.community_swipes;
create policy "community_swipes_insert_own" on public.community_swipes
  for insert to authenticated with check (auth.uid() = swiper_id);

drop policy if exists "community_reports_insert_own" on public.community_reports;
create policy "community_reports_insert_own" on public.community_reports
  for insert to authenticated with check (auth.uid() = reporter_id);

-- 5. community-photos bucket
drop policy if exists "community_photos_read_access" on storage.objects;
create policy "community_photos_read_all" on storage.objects
  for select using (bucket_id = 'community-photos');

drop policy if exists "community_photos_insert_own" on storage.objects;
create policy "community_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'community-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "community_photos_update_own" on storage.objects;
create policy "community_photos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'community-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 6. Relationship helpers: previous definitions and default privileges.
create or replace function public.community_is_mutual(a uuid, b uuid)
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

create or replace function public.community_can_view(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select viewer = owner
    or exists(select 1 from public.community_follows where follower_id = viewer and followed_id = owner);
$$;
grant execute on function public.community_is_mutual(uuid, uuid) to public;
grant execute on function public.community_can_view(uuid, uuid) to public;

-- 7. Usage log (the old Edge Functions don't use it).
drop table if exists public.community_usage_log;

-- 8. Global DeepL cap.
drop function if exists public.deepl_reserve_chars(integer);
drop table if exists public.deepl_usage_daily;
