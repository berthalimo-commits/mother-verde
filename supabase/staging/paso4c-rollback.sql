-- ROLLBACK of migration 20261029100000_game_setup.sql (zona del juego, phase 5).
-- Puts back game_state_valid() exactly as in 20261015100000_game_progress.sql.
-- Saved games that already use "setup" or the germination stage will be
-- refused on their next save until the migration is applied again.
-- Runs as ONE transaction.
begin;

create or replace function public.game_state_valid(s jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  k text;
  v jsonb;
  stages constant text[] := array['intro', 'plantula', 'vegetativo', 'floracion', 'secado', 'curado', 'rosin', 'fin'];
  events constant text[] := array['oidio', 'botrytis', 'acaros', 'carencia_n', 'exceso_riego'];
  num_in constant text := 'number';
begin
  if s is null or jsonb_typeof(s) <> 'object' then return false; end if;
  for k in select jsonb_object_keys(s) loop
    if not k = any(array['v', 'seq', 'run', 'stage', 'week', 'stageWeek', 'health', 'risks', 'event', 'log',
                         'result', 'last', 'lessons', 'trich', 'notes', 'post', 'lab']) then
      return false;
    end if;
  end loop;
  if s -> 'v' is distinct from '1'::jsonb then return false; end if;
  -- whole numbers within range
  foreach k in array array['seq', 'run', 'week', 'stageWeek', 'health'] loop
    v := s -> k;
    if v is null or jsonb_typeof(v) <> num_in or (v::text)::numeric <> trunc((v::text)::numeric) then return false; end if;
  end loop;
  if (s ->> 'seq')::numeric not between 0 and 1000000 or (s ->> 'run')::numeric not between 0 and 10000
     or (s ->> 'week')::numeric not between 0 and 60 or (s ->> 'stageWeek')::numeric not between 0 and 60
     or (s ->> 'health')::numeric not between 0 and 100 then
    return false;
  end if;
  if not (s ->> 'stage') = any(stages) then return false; end if;
  -- risks: { event id: 0..20 }
  if jsonb_typeof(coalesce(s -> 'risks', '{}'::jsonb)) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(coalesce(s -> 'risks', '{}'::jsonb)) loop
    if not k = any(events) or jsonb_typeof(v) <> num_in or (v::text)::numeric not between 0 and 20 then return false; end if;
  end loop;
  -- current event: null or { id: known event, ... } (small)
  v := s -> 'event';
  if v is not null and jsonb_typeof(v) <> 'null' then
    if jsonb_typeof(v) <> 'object' or not (v ->> 'id') = any(events) or octet_length(v::text) > 300 then return false; end if;
  end if;
  -- history of weeks, lessons seen, harvest result, last choices: bounded
  if s -> 'log' is not null and (jsonb_typeof(s -> 'log') <> 'array' or jsonb_array_length(s -> 'log') > 60) then return false; end if;
  if s -> 'lessons' is not null and (jsonb_typeof(s -> 'lessons') <> 'array' or jsonb_array_length(s -> 'lessons') > 40) then return false; end if;
  if s -> 'notes' is not null and (jsonb_typeof(s -> 'notes') <> 'array' or jsonb_array_length(s -> 'notes') > 40) then return false; end if;
  foreach k in array array['result', 'last'] loop
    v := s -> k;
    if v is not null and jsonb_typeof(v) not in ('null', 'object') then return false; end if;
    if v is not null and octet_length(v::text) > 1000 then return false; end if;
  end loop;
  -- after the harvest (phase 2): null or { secado | curado | rosin: {...} }, small
  v := s -> 'post';
  if v is not null and jsonb_typeof(v) <> 'null' then
    if jsonb_typeof(v) <> 'object' or octet_length(v::text) > 1000 then return false; end if;
    for k in select jsonb_object_keys(v) loop
      if not k = any(array['secado', 'curado', 'rosin']) or jsonb_typeof(v -> k) <> 'object' then return false; end if;
    end loop;
  end if;
  -- the safety lab (phase 3): null or { at: scene | null, f: [...], q: [...], v: visits }, small
  v := s -> 'lab';
  if v is not null and jsonb_typeof(v) <> 'null' then
    if jsonb_typeof(v) <> 'object' or octet_length(v::text) > 600 then return false; end if;
    for k in select jsonb_object_keys(v) loop
      if not k = any(array['at', 'f', 'q', 'v']) then return false; end if;
    end loop;
    if v -> 'at' is not null and jsonb_typeof(v -> 'at') <> 'null'
       and not (v ->> 'at') = any(array['intro', 's1', 's2', 's3', 's4', 'fin']) then return false; end if;
    if jsonb_typeof(coalesce(v -> 'f', '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(v -> 'q', '[]'::jsonb)) <> 'array' then return false; end if;
    if v -> 'v' is not null and (jsonb_typeof(v -> 'v') <> 'number' or (v ->> 'v')::numeric not between 0 and 1000) then return false; end if;
  end if;
  v := s -> 'trich';
  if v is not null and jsonb_typeof(v) not in ('null', 'string') then return false; end if;
  return true;
end;
$$;
revoke execute on function public.game_state_valid(jsonb) from public, anon;
grant execute on function public.game_state_valid(jsonb) to authenticated, service_role;

commit;
