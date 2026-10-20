-- Runs as ONE transaction: if any statement fails, nothing is applied.
begin;

-- GAME (zona del juego, phase 1): each person's saved progress.
-- Independent: it only needs has_full_access() from 20261010120000, so it can
-- be pasted on its own, any time after the launch SQL. Undo:
-- supabase/admin/rollback-20261015100000.sql. Read-only check before pasting:
-- supabase/admin/precheck-game.sql.
--
--   * one row per person; each person reads ONLY their own row (RLS);
--   * nobody writes the table directly: only game_save(), which
--       - refuses without full access (has_full_access(): same rule as the
--         Community — 24 h trial, contribution or gift days),
--       - checks the format on the server (game_state_valid) and the size
--         (16 KB at most),
--       - allows at most 20 saves per minute per person,
--       - never goes backwards: a save whose step counter ("seq") is not
--         newer than the stored one is refused and the stored progress is
--         returned (another device was ahead);
--   * losing access keeps the row untouched; deleting the account deletes it
--     (foreign key on delete cascade).

create table if not exists public.game_progress (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  state           jsonb not null,
  seq             integer not null default 0 check (seq between 0 and 1000000),
  updated_at      timestamptz not null default now(),
  window_start    timestamptz not null default now(),
  saves_in_window integer not null default 0
);
alter table public.game_progress enable row level security;

drop policy if exists "game_progress_select_own" on public.game_progress;
create policy "game_progress_select_own" on public.game_progress
  for select to authenticated using (user_id = auth.uid());
-- No insert / update / delete policies: writes go through game_save() only.
revoke all on public.game_progress from public, anon, authenticated;
grant select (user_id, state, seq, updated_at) on public.game_progress to authenticated;

-- The saved game, checked key by key. Unknown keys are refused.
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
                         'result', 'last', 'lessons', 'trich', 'notes', 'post']) then
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
  v := s -> 'trich';
  if v is not null and jsonb_typeof(v) not in ('null', 'string') then return false; end if;
  return true;
end;
$$;
revoke execute on function public.game_state_valid(jsonb) from public, anon;
grant execute on function public.game_state_valid(jsonb) to authenticated, service_role;

-- Save. Returns { ok, seq, state } — when ok = false and stale = true, "state"
-- is the newer progress already stored (the app continues from it).
create or replace function public.game_save(p_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_seq integer;
  r public.game_progress;
  v_count integer;
  v_start timestamptz;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_full_access() then raise exception 'no_access'; end if;
  if p_state is null or octet_length(p_state::text) > 16384 then raise exception 'too_large'; end if;
  if not public.game_state_valid(p_state) then raise exception 'bad_state'; end if;
  v_seq := (p_state ->> 'seq')::integer;

  insert into public.game_progress (user_id, state, seq, saves_in_window)
  values (v_uid, p_state, v_seq, 1)
  on conflict (user_id) do nothing
  returning * into r;
  if r.user_id is not null then
    return jsonb_build_object('ok', true, 'seq', v_seq, 'state', p_state);
  end if;

  select * into r from public.game_progress where user_id = v_uid for update;
  -- at most 20 saves per minute (stale ones count too)
  if r.window_start > now() - interval '1 minute' then
    if r.saves_in_window >= 20 then raise exception 'rate_limited'; end if;
    v_count := r.saves_in_window + 1; v_start := r.window_start;
  else
    v_count := 1; v_start := now();
  end if;

  if v_seq <= r.seq then
    update public.game_progress set saves_in_window = v_count, window_start = v_start where user_id = v_uid;
    return jsonb_build_object('ok', false, 'stale', true, 'seq', r.seq, 'state', r.state);
  end if;

  update public.game_progress
     set state = p_state, seq = v_seq, updated_at = now(), saves_in_window = v_count, window_start = v_start
   where user_id = v_uid;
  return jsonb_build_object('ok', true, 'seq', v_seq, 'state', p_state);
end;
$$;
revoke execute on function public.game_save(jsonb) from public, anon;
grant execute on function public.game_save(jsonb) to authenticated;

commit;
