-- READ-ONLY precheck for 20261015100000_game_progress.sql (zona del juego).
-- Paste in the Supabase SQL Editor BEFORE that migration. It changes nothing.
-- Every row must say 'ok'. 'FALTA' = the launch SQL (20261010120000) isn't
-- there yet: paste the game migration only after it. 'YA EXISTE' = the game
-- migration was already applied: don't paste it again.
with expected(kind, name) as (values
  ('function', 'public.has_full_access()'),
  ('table',    'public.profiles')
), must_not_exist(kind, name) as (values
  ('table',    'public.game_progress'),
  ('function', 'public.game_save(p_state jsonb)'),
  ('function', 'public.game_state_valid(s jsonb)')
), present as (
  select 'function' kind, n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' name
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  union all
  select 'table', table_schema || '.' || table_name from information_schema.tables where table_schema = 'public'
)
select e.kind, e.name,
       case when exists (select 1 from present p where p.kind = e.kind and p.name = e.name) then 'ok' else 'FALTA' end as resultado
from expected e
union all
select m.kind, m.name,
       case when exists (select 1 from present p where p.kind = m.kind and p.name = m.name) then 'YA EXISTE' else 'ok' end
from must_not_exist m
order by 3 desc, 1, 2;
