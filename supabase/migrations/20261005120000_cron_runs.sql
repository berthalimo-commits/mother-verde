-- A permanent record of every scheduled-job run, so we never have to catch
-- Vercel's runtime logs inside their 1-hour Hobby retention window to know
-- whether api/subscription-cron.js actually ran and what it did.
--
-- One row per authorized run (unauthorized calls are rejected before any
-- write, so this table can't be spammed from outside). Written only by the
-- cron itself with the service-role key; nobody else can read or write it.
--
-- To check the last runs, in the SQL Editor:
--   select started_at, ok, summary, errors
--   from public.cron_runs order by started_at desc limit 10;

create table if not exists public.cron_runs (
  id          bigint generated always as identity primary key,
  job         text        not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean     not null,
  -- counts per action + the profile ids touched by each one
  summary     jsonb       not null default '{}'::jsonb,
  -- one entry per failed step or failed row: { step, profile_id?, message }
  errors      jsonb       not null default '[]'::jsonb
);

create index if not exists cron_runs_job_started_idx
  on public.cron_runs (job, started_at desc);

-- RLS on with no policies = no access for anon/authenticated; the
-- service-role key bypasses RLS. The revoke is belt-and-braces.
alter table public.cron_runs enable row level security;
revoke all on public.cron_runs from anon, authenticated;
