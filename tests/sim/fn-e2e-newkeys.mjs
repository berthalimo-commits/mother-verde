// fn-e2e in «new keys only» mode (Bertha, 2026-11-06): the Edge Functions receive the NEW Supabase keys
// (SUPABASE_SECRET_KEYS / SUPABASE_PUBLISHABLE_KEYS, JSON by name), the legacy ones are disabled, and the
// Vercel cron uses sb_secret_… / sb_publishable_…. Same checks as fn-e2e; nothing leaves this machine.
process.env.MV_KEYS = 'new';
await import('./fn-e2e.mjs');
