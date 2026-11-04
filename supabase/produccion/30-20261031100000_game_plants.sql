-- PRODUCCIÓN · archivo 30 de 31 · Juego: varias plantas y machos.
-- Pegar ENTERO y ejecutar una vez. Es una sola transacción: si falla, no se aplica nada de este archivo.
-- Copia exacta de supabase/migrations/20261031100000_game_plants.sql (generado por tools/build-produccion.mjs; no editar a mano).

-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- GAME v2, several plants + seed types: with regular seeds some plants can be
-- male; the player removes them in flowering and the saved equipment then
-- carries "machos": "retirados" (or "tarde": removed after they pollinated).
-- The seed type ("semilla") and the number of
-- plants ("plantas", 1..6) were already accepted by 20261029100000. Needs
-- 20261029100000_game_setup.sql first. Only game_state_valid() changes (one
-- more known equipment key). Undo: supabase/admin/rollback-20261031100000.sql
-- (puts back the 20261029100000 version; a game that removed its males would
-- then be refused on its next save).

create or replace function public.game_state_valid(s jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  k text;
  v jsonb;
  w jsonb;
  -- phase 5: the equipment and method of the run, each key only with its known values
  setup_ok constant jsonb := '{"carpa": ["pequena", "mediana", "grande"], "luz": ["led", "hps", "cmh"],
    "sistema": ["maceta", "dwc", "nft", "aeroponia", "acuaponia"], "sustrato": ["tierra", "coco", "lana_roca", "tierra_viva"],
    "maceta": ["plastico", "tela", "aire", "barro"], "maceta_tam": ["pequena", "grande"], "riego_tipo": ["mano", "goteo"],
    "medir": ["si", "no"], "semilla": ["feminizada", "regular", "autofloreciente"],
    "germinacion": ["papel", "taco", "tierra", "coco", "vaso", "lana_roca"], "trasplante": ["no", "si"],
    "machos": ["retirados", "tarde"]}';
  stages constant text[] := array['intro', 'germinacion', 'plantula', 'vegetativo', 'floracion', 'secado', 'curado', 'material', 'rosin', 'fin'];
  -- phase 6: root rot (hydroponics with warm water) and light burn (small tent)
  events constant text[] := array['oidio', 'botrytis', 'acaros', 'carencia_n', 'exceso_riego', 'pudricion_raiz', 'quemadura_luz'];
  num_in constant text := 'number';
begin
  if s is null or jsonb_typeof(s) <> 'object' then return false; end if;
  for k in select jsonb_object_keys(s) loop
    if not k = any(array['v', 'seq', 'run', 'stage', 'week', 'stageWeek', 'health', 'risks', 'event', 'log',
                         'result', 'last', 'lessons', 'trich', 'notes', 'post', 'lab', 'setup']) then
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
    if jsonb_typeof(v) <> 'object' or octet_length(v::text) > 1500 then return false; end if;
    for k in select jsonb_object_keys(v) loop
      if not k = any(array['secado', 'curado', 'material', 'rosin']) or jsonb_typeof(v -> k) <> 'object' then return false; end if;
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
  -- phase 5: { key: known value } and plantas = 1..6, small
  v := s -> 'setup';
  if v is not null and jsonb_typeof(v) <> 'null' then
    if jsonb_typeof(v) <> 'object' or octet_length(v::text) > 600 then return false; end if;
    for k, w in select * from jsonb_each(v) loop
      if k = 'plantas' then
        if jsonb_typeof(w) <> num_in or (w::text)::numeric not in (1, 2, 3, 4, 5, 6) then return false; end if;
      elsif not setup_ok ? k or jsonb_typeof(w) <> 'string' or not (setup_ok -> k) ? (w #>> '{}') then
        return false;
      end if;
    end loop;
  end if;
  v := s -> 'trich';
  if v is not null and jsonb_typeof(v) not in ('null', 'string') then return false; end if;
  return true;
end;
$$;
revoke execute on function public.game_state_valid(jsonb) from public, anon;
grant execute on function public.game_state_valid(jsonb) to authenticated, service_role;

commit;
