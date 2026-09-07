-- Featured posts: an editorial channel that every signed-in member sees,
-- regardless of who they follow. Solves the "empty feed for a brand-new user"
-- problem — the personal feed is otherwise strictly "own posts + followed
-- authors" (community_posts_select_visible).
--
-- Only our own service-role seeding sets featured = true; there is no client
-- path to it (the INSERT policy still only checks auth.uid() = user_id, and the
-- composer never sends the column).
--
-- Comments on a featured post are open to any signed-in member (they can see
-- and reply), instead of the usual mutual-follow gate — so the seeded "open
-- question" posts actually work. Trade-off: featured-post comments are
-- unmoderated at current scale; flip featured off on a post if it's abused.

alter table public.community_posts
  add column featured boolean not null default false;

create index community_posts_featured_idx
  on public.community_posts(created_at desc) where featured;

drop policy "community_posts_select_visible" on public.community_posts;
create policy "community_posts_select_visible" on public.community_posts
  for select to authenticated
  using (featured or public.community_can_view(auth.uid(), user_id));

-- Comments: see + reply on a featured post without following its author.
drop policy "community_comments_select_visible" on public.community_comments;
create policy "community_comments_select_visible" on public.community_comments
  for select to authenticated
  using (
    exists(
      select 1 from public.community_posts p
      where p.id = post_id
        and (p.featured or public.community_can_view(auth.uid(), p.user_id))
    )
  );

drop policy "community_comments_insert_unlocked" on public.community_comments;
create policy "community_comments_insert_unlocked" on public.community_comments
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists(
      select 1 from public.community_posts p
      where p.id = post_id
        and (p.featured
             or p.user_id = auth.uid()
             or public.community_is_mutual(auth.uid(), p.user_id))
    )
  );
