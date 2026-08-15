-- Optional trichome-maturation percentages for a bitácora entry (Cultivo → Cosecha trichome log).
-- Nullable, additive, non-destructive — existing entries and app behavior are unaffected.
alter table public.bitacora_entries
  add column trich_clear numeric,
  add column trich_milky numeric,
  add column trich_amber numeric;
