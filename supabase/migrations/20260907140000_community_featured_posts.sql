-- Featured posts: an editorial channel that every signed-in member sees,
-- regardless of who they follow. Solves the "empty feed for a brand-new user"
-- problem — the personal feed is otherwise strictly "own posts + followed
-- authors" (community_posts_select_visible).
--
-- Only our own service-role seeding sets featured = true; there is no client
-- path to it (the INSERT policy still only checks auth.uid() = user_id, and the
-- composer never sends the column).

alter table public.community_posts
  add column featured boolean not null default false;

create index community_posts_featured_idx
  on public.community_posts(created_at desc) where featured;

drop policy "community_posts_select_visible" on public.community_posts;
create policy "community_posts_select_visible" on public.community_posts
  for select to authenticated
  using (featured or public.community_can_view(auth.uid(), user_id));
