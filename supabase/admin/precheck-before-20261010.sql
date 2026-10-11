-- READ-ONLY precheck. Paste in the Supabase SQL Editor BEFORE migrations
-- 20261010120000 and 20261010130000. It changes nothing.
--
-- It checks that production has exactly the objects those migrations expect
-- to replace (policies, functions, constraint, triggers) and none of the
-- objects they will create. Every row must say 'ok'. If any row says
-- 'FALTA' or 'YA EXISTE', stop and send me the result before pasting.
with expected(kind, name) as (values
  ('policy',     'public.community_members.community_members_select_all'),
  ('policy',     'public.community_members.community_members_insert_own'),
  ('policy',     'public.community_members.community_members_update_own'),
  ('policy',     'public.community_posts.community_posts_select_visible'),
  ('policy',     'public.community_comments.community_comments_select_visible'),
  ('policy',     'public.community_follows.community_follows_insert_own'),
  ('policy',     'public.community_swipes.community_swipes_insert_own'),
  ('policy',     'public.community_reports.community_reports_insert_own'),
  ('policy',     'storage.objects.community_photos_read_all'),
  ('policy',     'storage.objects.community_photos_insert_own'),
  ('policy',     'storage.objects.community_photos_update_own'),
  ('function',   'public.is_premium(uid uuid)'),
  ('function',   'public.community_is_mutual(a uuid, b uuid)'),
  ('function',   'public.community_can_view(viewer uuid, owner uuid)'),
  ('function',   'public.start_free_trial(p_customer_id text, p_subscription_id text)'),
  ('function',   'public.cancel_subscription(p_confirm boolean)'),
  ('function',   'public.reactivate_subscription(p_confirm boolean)'),
  ('function',   'public.handle_new_user()'),
  ('constraint', 'profiles_subscription_status_check'),
  ('trigger',    'auth.users.on_auth_user_created'),
  ('table',      'public.translation_cache'),
  ('table',      'public.cron_runs'),
  ('bucket',     'community-photos')
), must_not_exist(kind, name) as (values
  ('function', 'public.has_full_access()'),
  ('function', 'public.normalize_email(p text)'),
  ('function', 'public.hook_before_user_created(event jsonb)'),
  ('function', 'public.deepl_reserve_chars(p_chars integer)'),
  ('table',    'public.blocked_email_domains'),
  ('table',    'public.community_usage_log'),
  ('table',    'public.app_config'),
  ('table',    'public.deepl_usage_daily'),
  ('trigger',  'auth.users.on_auth_email_confirmed'),
  ('column',   'public.profiles.trial_eligible'),
  ('column',   'public.profiles.email_normalized')
), present as (
  select 'policy' kind, schemaname || '.' || tablename || '.' || policyname name from pg_policies
  union all
  select 'function', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  union all
  select 'constraint', conname from pg_constraint where conrelid = 'public.profiles'::regclass
  union all
  select 'trigger', event_object_schema || '.' || event_object_table || '.' || trigger_name from information_schema.triggers
  union all
  select 'table', table_schema || '.' || table_name from information_schema.tables where table_schema = 'public'
  union all
  select 'column', table_schema || '.' || table_name || '.' || column_name from information_schema.columns where table_schema = 'public'
  union all
  select 'bucket', id from storage.buckets
)
select e.kind, e.name,
       case when exists (select 1 from present p where p.kind = e.kind and p.name = e.name) then 'ok' else 'FALTA' end as resultado
from expected e
union all
select m.kind, m.name,
       case when exists (select 1 from present p where p.kind = m.kind and p.name = m.name) then 'YA EXISTE' else 'ok' end
from must_not_exist m
order by 3 desc, 1, 2;
