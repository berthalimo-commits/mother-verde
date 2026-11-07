-- ROLLBACK of migration 20261015100000_game_progress.sql (zona del juego).
-- Deletes EVERY person's saved game progress. Runs as ONE transaction.
begin;
drop function if exists public.game_save(jsonb);
drop function if exists public.game_state_valid(jsonb);
drop table if exists public.game_progress;
commit;
