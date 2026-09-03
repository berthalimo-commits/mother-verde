-- Community Fase 2: automatic translation of posts and comments into all four
-- platform languages (es, en, de, fr) at publish time. Each row keeps the
-- original body plus a body_i18n map { es, en, de, fr }; a reader sees their
-- own language with a fallback to the source language, then to body.
--
-- Translation itself runs in the `community-translate` Edge Function against
-- Azure AI Translator. This migration is only the storage columns, the length
-- caps, and the shared phrase cache — no network calls happen here.

-- ---------------------------------------------------------------------------
-- 1. Posts: i18n columns + a 2,000-character cap on the source body.
--    source_lang is the language the author actually wrote in (UI-language
--    hint, corrected by Azure's detection). translation_status lets a later
--    backfill find rows whose translation failed at publish time.
-- ---------------------------------------------------------------------------
alter table public.community_posts
  add column body_i18n jsonb,
  add column source_lang text check (source_lang in ('es','en','de','fr')),
  add column translation_status text not null default 'pending'
    check (translation_status in ('pending','done','failed','skipped'));

alter table public.community_posts
  add constraint community_posts_body_len
  check (body is null or char_length(body) <= 2000);

-- ---------------------------------------------------------------------------
-- 2. Comments: i18n columns + the 500-character cap.
-- ---------------------------------------------------------------------------
alter table public.community_comments
  add column body_i18n jsonb,
  add column source_lang text check (source_lang in ('es','en','de','fr')),
  add column translation_status text not null default 'pending'
    check (translation_status in ('pending','done','failed','skipped'));

alter table public.community_comments
  add constraint community_comments_body_len
  check (char_length(body) <= 500);

-- ---------------------------------------------------------------------------
-- 3. Translation cache: repeated short text ("gracias", "🔥", a common
--    question) is translated once and reused across users and across posts.
--    Keyed by the source-language hint + a hash of the normalized text.
--    Only the Edge Function (service_role) touches this table, so RLS is on
--    with no policy — anon/authenticated get nothing.
-- ---------------------------------------------------------------------------
create table public.translation_cache (
  source_lang  text not null check (source_lang in ('es','en','de','fr')),
  content_hash text not null,
  translations jsonb not null,
  hit_count    integer not null default 0,
  created_at   timestamptz not null default now(),
  last_hit_at  timestamptz,
  primary key (source_lang, content_hash)
);

alter table public.translation_cache enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Backfill helper: rows that were inserted with translation_status
--    'failed' (Azure was down or slow at publish time). A scheduled job can
--    select from this view and re-call the Edge Function for each id. Kept as
--    a view (not pg_cron here) so the schedule can be wired up once the
--    function is deployed and its URL + service key live in Vault.
-- ---------------------------------------------------------------------------
create view public.community_translation_backlog
  with (security_invoker = on) as
  select 'post'::text as kind, id, body, source_lang, created_at
    from public.community_posts
   where translation_status = 'failed'
  union all
  select 'comment'::text as kind, id, body, source_lang, created_at
    from public.community_comments
   where translation_status = 'failed';
