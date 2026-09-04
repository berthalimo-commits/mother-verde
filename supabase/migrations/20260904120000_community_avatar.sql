-- Small profile-picture field, distinct from the still-unused cover_photo_url
-- (reserved for a future profile-page banner). avatar_url is public — same
-- table, same RLS as the rest of the directory — and shows next to the
-- author's name everywhere identity appears: directory, Descubrir, posts,
-- comments, and the top-bar account icon.
alter table public.community_members
  add column avatar_url text;
