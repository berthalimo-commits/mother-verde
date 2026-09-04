-- Reactivates traveler / grow / diagnosis / question reports as post types
-- inside the same community_posts feed, instead of 4 separate systems.
-- Medical testimonials stays out on purpose (real risk of unmoderated
-- specific medical advice, per the app's own existing copy).
--
-- meta is a single jsonb column (not 3 separate nullable columns) so any
-- future post type's extra field doesn't need another migration. It's not
-- constrained beyond post_type here because the only writer is our own UI
-- (the composer's dropdowns), same trust boundary as body_i18n already has.
alter table public.community_posts
  add column post_type text not null default 'general'
    check (post_type in ('general','viajero','cultivo','diagnostico','pregunta')),
  add column meta jsonb;
