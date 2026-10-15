// ===========================================================================
// Daily job — tidies access states. Nothing is billed here:
// access is free for 24 h, then by contribution or gift days, and is decided
// by time in public.is_premium(), so nothing here grants or removes access.
// ===========================================================================
// Every run:
//   1. Support contributions: reserved amounts past their expiry -> 'expired'
//      (public.expire_support_claims(), migration 20261011120000).
//   2. Leftovers of the old card model: rows still marked 'active' /
//      'past_due' whose period ended -> 'canceled'; legacy 'none' rows with an
//      ended period -> subscription_active false. Tidy-up only: is_premium()
//      already gives them no access.
//   3. Calls the Edge Function community-retranslate (retries up to 20
//      untranslated posts/comments within the global DeepL daily cap).
//   4. Records the run in public.cron_runs (Vercel Hobby keeps logs 1 hour).
//
// Scheduled in vercel.json at 23:00 UTC (Hobby: once a day, may run up to
// 59 minutes late).
//
// Vercel environment variables: CRON_SECRET (the scheduler sends it as
// `Authorization: Bearer <CRON_SECRET>`), SUPABASE_URL or VITE_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY, RETRANSLATE_SECRET (same
// value as the Supabase secret of community-retranslate).
// ===========================================================================

import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

const JOB = 'subscription-cron';
const RUN_LOG_RETENTION_DAYS = 180;

function supabaseUrl() { return process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL; }

function admin() {
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase admin env not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

// supabase-js does NOT throw on a failed query — it returns { error }.
async function must(query, step) {
  const { data, error } = await query;
  if (error) throw new Error(`${step}: ${error.message}`);
  return data;
}

export default async function handler(req, res) {
  // Fail closed: without CRON_SECRET every request is rejected.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const expected = secret ? `Bearer ${secret}` : null;
  const authBuf = Buffer.from(auth);
  const expectedBuf = Buffer.from(expected || '');
  const authorized = !!expected && authBuf.length === expectedBuf.length && timingSafeEqual(authBuf, expectedBuf);
  if (!authorized) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  let db;
  try { db = admin(); }
  catch (e) {
    console.error(`${JOB}:`, e.message);
    res.status(500).json({ error: e.message });
    return;
  }

  const now = new Date();
  const summary = { claimsExpired: 0, legacyCanceled: [], legacyDeactivated: [], retranslate: null };
  const errors = [];

  // --- 1. Expired reserved amounts -------------------------------------
  try {
    summary.claimsExpired = await must(db.rpc('expire_support_claims'), 'claims: expire');
  } catch (e) { errors.push({ step: 'claims', message: e.message }); }

  // --- 2. Old card-model leftovers -------------------------------------
  try {
    const rows = await must(db.from('profiles')
      .update({ subscription_status: 'canceled', subscription_active: false })
      .in('subscription_status', ['active', 'past_due'])
      .lte('subscription_expires_at', now.toISOString())
      .select('id'), 'legacy: cancel');
    summary.legacyCanceled = (rows || []).map((r) => r.id);
    const rows2 = await must(db.from('profiles')
      .update({ subscription_active: false })
      .eq('subscription_status', 'none')
      .eq('subscription_active', true)
      .lte('subscription_expires_at', now.toISOString())
      .select('id'), 'legacy: deactivate');
    summary.legacyDeactivated = (rows2 || []).map((r) => r.id);
  } catch (e) { errors.push({ step: 'legacy', message: e.message }); }

  // --- 3. Retry untranslated posts/comments ----------------------------
  try {
    const rSecret = process.env.RETRANSLATE_SECRET;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!rSecret) throw new Error('RETRANSLATE_SECRET not set');
    const r = await fetch(`${supabaseUrl()}/functions/v1/community-retranslate`, {
      method: 'POST',
      headers: {
        'x-retranslate-secret': rSecret,
        ...(anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {}),
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(50000),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(body).slice(0, 200)}`);
    summary.retranslate = { done: body.done, failed: body.failed, gave_up: body.gave_up, stopped: body.stopped };
    if (body.errors?.length) errors.push({ step: 'retranslate: rows', message: body.errors.slice(0, 5).join(' | ') });
  } catch (e) { errors.push({ step: 'retranslate', message: e.message }); }

  // --- 4. Record the run -----------------------------------------------
  const ok = errors.length === 0;
  let logged = true;
  try {
    await must(db.from('cron_runs').insert({
      job: JOB, started_at: now.toISOString(), finished_at: new Date().toISOString(), ok, summary, errors,
    }), 'cron_runs: insert');
    const cutoff = new Date(now.getTime() - RUN_LOG_RETENTION_DAYS * 86400000).toISOString();
    await must(db.from('cron_runs').delete().eq('job', JOB).lt('started_at', cutoff), 'cron_runs: prune');
  } catch (e) {
    logged = false;
    errors.push({ step: 'run-log', message: e.message });
  }

  if (!ok || !logged) console.error(`${JOB} errors:`, JSON.stringify(errors));
  // A non-2xx status makes the run show as failed in Vercel's Cron Jobs view.
  res.status(ok && logged ? 200 : 500).json({ ok: ok && logged, ran_at: now.toISOString(), ...summary, errors });
}
