-- Security fix: `featured` on community_posts was never column-locked, unlike
-- every other trust-sensitive flag in this schema (profiles billing columns,
-- community_members.verified_type). The 20260907140000 migration's own
-- comment claims "there is no client path to it" — true for the app's UI, but
-- false at the database level: the base INSERT/UPDATE grant on this table was
-- never narrowed, so any authenticated user could call
--   supabase.from('community_posts').update({featured:true}).eq('id', ownPostId)
-- directly and place their own post in the editorial channel every member
-- sees (and, per that same migration, open it to comments from anyone,
-- bypassing the normal mutual-follow gate). Same pattern as the client-side
-- setIsPremium bypass, just enforced in the wrong layer.
--
-- The composer never sends `featured` (confirmed in src/mvCommunity.js), so
-- narrowing the grant to the columns it actually writes is a no-op for every
-- legitimate call.
revoke insert, update on public.community_posts from authenticated;
grant insert (user_id, kind, body, photo_url, post_type, meta, body_i18n, source_lang, translation_status)
  on public.community_posts to authenticated;
grant update (body, post_type, meta, body_i18n, source_lang, translation_status)
  on public.community_posts to authenticated;

-- NOTE: body_i18n / source_lang / translation_status remain client-writable
-- here on purpose — the publish flow (src/mvCommunity.js translatedFields())
-- still computes them client-side today. That is a separate, larger finding
-- (a client can skip the community-translate Edge Function and write any
-- body_i18n it wants, showing different text to different-language readers)
-- that needs the insert/update itself moved server-side into an Edge
-- Function before these columns can be locked down too. Tracked, not fixed
-- in this migration.
