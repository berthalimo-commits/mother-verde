// ===========================================================================
// Trial / subscription lifecycle job  —  runs on a schedule (once connected).
// ===========================================================================
// What it does every run:
//   1. Trials ending within 24h, no reminder sent yet -> send the day-2
//      reminder + stamp trial_reminder_sent_at.
//      EMAIL IS DESIGNED ONLY. No transactional email provider is connected
//      (domain + hello@motherverdeny.com live on Hostinger; DNS will be set up
//      there when we wire sending). Template: docs/trial-reminder-email.md.
//      Until then the in-app banner (#trialReminderBanner) is the channel.
//   2. Trials whose trial_ends_at has passed:
//        - cancel_at_period_end = true  -> status 'canceled' (no charge)
//        - otherwise                    -> TODO(payment-nerds): charge $7.10.
//          success -> 'active', subscription_expires_at = +1 month
//          failure -> 'blocked' IMMEDIATELY (no grace period — owner's call)
//      While the processor is offline we cannot charge, so an un-cancelled
//      expired trial goes straight to 'blocked'. That's the honest state:
//      the user had full access for 3 days and we can't bill them yet.
//   3. Active subs past subscription_expires_at:
//        - cancel_at_period_end = true  -> 'canceled'
//        - otherwise                    -> TODO(payment-nerds): renewal charge.
//          success -> extend +1 month ; failure -> 'blocked'
//
// Scheduled in vercel.json, daily at 08:00 UTC (Hobby allows one run a day).
//
// Every authorized run is recorded in public.cron_runs (migration
// 20261005120000_cron_runs.sql): counts, the profile ids touched, and every
// error. Vercel Hobby keeps runtime logs for only 1 hour, so that table is
// the place to check whether the job ran and what it did.
//
// supabase-js does NOT throw on a failed query — it returns { error }. Every
// call below goes through must(), so a failed select/update is recorded as an
// error instead of being counted as done.
//
// Auth: set CRON_SECRET in the Vercel project; the scheduler is configured to
// send it as `Authorization: Bearer <CRON_SECRET>`. Manual runs must match.
// ===========================================================================

import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

const PRICE_USD = '7.10';
const REMINDER_WINDOW_HOURS = 24;

// Must match src/subscription.js. While false, NO charge can succeed and every
// trial that reaches day 3 is set to 'blocked' — never left with free access.
const PAYMENTS_ENABLED = false; // TODO(payment-nerds): flip on when the processor is live

function admin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase admin env not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

// -- TODO(payment-nerds): real charge. Return { ok: true } / { ok: false }. ----
async function chargeCard(/* profile, amountUsd */) {
  if (!PAYMENTS_ENABLED) return { ok: false, pending: true, reason: 'payment-nerds-not-connected' };
  // TODO(payment-nerds): call the processor here.
  return { ok: false, pending: true, reason: 'not-implemented' };
}

// Fail-closed wrapper: a charge counts as successful ONLY if payments are live
// AND the processor explicitly said ok. Anything else -> block.
async function chargeSucceeded(profile) {
  if (!PAYMENTS_ENABLED) return false;
  try {
    const r = await chargeCard(profile, PRICE_USD);
    return r && r.ok === true;
  } catch (e) {
    return false;
  }
}

// -- TODO(email): real send via the provider we set up on Hostinger DNS. -------
async function sendTrialReminderEmail(/* profile */) {
  // Template + copy: docs/trial-reminder-email.md (4 languages).
  return { ok: false, pending: true };
}

function addOneMonth(from) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

// Unwrap a supabase-js result: return its data, or throw with the step name.
async function must(query, step) {
  const { data, error } = await query;
  if (error) throw new Error(`${step}: ${error.message}`);
  return data;
}

// Keep the run log from growing forever.
const RUN_LOG_RETENTION_DAYS = 180;

export default async function handler(req, res) {
  // Fail closed: a missing CRON_SECRET must reject every request, not skip
  // the check. This endpoint runs with the service-role key and can mutate
  // any profile's subscription_status, so an unauthenticated hole here is a
  // way to mass-block or mass-cancel every account, not just a config nit.
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
    console.error('subscription-cron:', e.message);
    res.status(500).json({ error: e.message });
    return;
  }

  const now = new Date();
  const soon = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3600000);
  const counts = { remindersSent: 0, trialsCharged: 0, trialsBlocked: 0, trialsCanceled: 0, renewals: 0, renewalsBlocked: 0, subsCanceled: 0 };
  const touched = { reminded: [], trialCharged: [], trialBlocked: [], trialCanceled: [], renewed: [], renewalBlocked: [], subCanceled: [] };
  const errors = [];

  // Apply one profile update; on failure record it and return false instead
  // of counting the row as handled.
  async function updateProfile(step, id, fields) {
    try {
      await must(db.from('profiles').update(fields).eq('id', id), step);
      return true;
    } catch (e) {
      errors.push({ step, profile_id: id, message: e.message });
      return false;
    }
  }

  // --- 1. Day-2 reminders -------------------------------------------------
  try {
    const due = await must(db
      .from('profiles')
      .select('id, contact_email, preferred_lang, trial_ends_at')
      .eq('subscription_status', 'trialing')
      .is('trial_reminder_sent_at', null)
      .eq('cancel_at_period_end', false)
      .lte('trial_ends_at', soon.toISOString())
      .gt('trial_ends_at', now.toISOString()), 'reminders: select');
    for (const p of due || []) {
      await sendTrialReminderEmail(p); // TODO(email): currently a no-op stub
      if (await updateProfile('reminders', p.id, { trial_reminder_sent_at: now.toISOString() })) {
        counts.remindersSent++; touched.reminded.push(p.id);
      }
    }
  } catch (e) { errors.push({ step: 'reminders', message: e.message }); }

  // --- 2. Trials that have ended ----------------------------------------
  try {
    const ended = await must(db
      .from('profiles')
      .select('id, cancel_at_period_end, trial_ends_at, payment_customer_id')
      .eq('subscription_status', 'trialing')
      .lte('trial_ends_at', now.toISOString()), 'trial-end: select');
    for (const p of ended || []) {
      if (p.cancel_at_period_end) {
        if (await updateProfile('trial-end: cancel', p.id, { subscription_status: 'canceled', canceled_at: now.toISOString() })) {
          counts.trialsCanceled++; touched.trialCanceled.push(p.id);
        }
        continue;
      }
      if (await chargeSucceeded(p)) {
        if (await updateProfile('trial-end: activate', p.id, {
          subscription_status: 'active',
          subscription_active: true,
          subscription_expires_at: addOneMonth(now),
        })) { counts.trialsCharged++; touched.trialCharged.push(p.id); }
      } else {
        // Default outcome on ANY doubt: immediate block, no grace period.
        if (await updateProfile('trial-end: block', p.id, {
          subscription_status: 'blocked',
          subscription_active: false,
        })) { counts.trialsBlocked++; touched.trialBlocked.push(p.id); }
      }
    }
  } catch (e) { errors.push({ step: 'trial-end', message: e.message }); }

  // --- 3. Paid subscriptions past their period -------------------------
  try {
    const expired = await must(db
      .from('profiles')
      .select('id, cancel_at_period_end, subscription_expires_at, payment_customer_id')
      .eq('subscription_status', 'active')
      .lte('subscription_expires_at', now.toISOString()), 'renewal: select');
    for (const p of expired || []) {
      if (p.cancel_at_period_end) {
        if (await updateProfile('renewal: cancel', p.id, {
          subscription_status: 'canceled',
          subscription_active: false,
          canceled_at: now.toISOString(),
        })) { counts.subsCanceled++; touched.subCanceled.push(p.id); }
        continue;
      }
      if (await chargeSucceeded(p)) {
        if (await updateProfile('renewal: extend', p.id, { subscription_expires_at: addOneMonth(now) })) {
          counts.renewals++; touched.renewed.push(p.id);
        }
      } else {
        if (await updateProfile('renewal: block', p.id, {
          subscription_status: 'blocked',
          subscription_active: false,
        })) { counts.renewalsBlocked++; touched.renewalBlocked.push(p.id); }
      }
    }
  } catch (e) { errors.push({ step: 'renewal', message: e.message }); }

  // --- 4. Record the run ----------------------------------------------
  const ok = errors.length === 0;
  const summary = { ...counts, profiles: touched, payments_enabled: PAYMENTS_ENABLED };
  let logged = true;
  try {
    await must(db.from('cron_runs').insert({
      job: 'subscription-cron',
      started_at: now.toISOString(),
      finished_at: new Date().toISOString(),
      ok,
      summary,
      errors,
    }), 'cron_runs: insert');
    const cutoff = new Date(now.getTime() - RUN_LOG_RETENTION_DAYS * 86400000).toISOString();
    await must(db.from('cron_runs').delete().eq('job', 'subscription-cron').lt('started_at', cutoff), 'cron_runs: prune');
  } catch (e) {
    logged = false;
    errors.push({ step: 'run-log', message: e.message });
  }

  if (!ok || !logged) console.error('subscription-cron errors:', JSON.stringify(errors));
  // A non-2xx status makes the run show as failed in Vercel's Cron Jobs view.
  res.status(ok && logged ? 200 : 500).json({ ok: ok && logged, ran_at: now.toISOString(), ...summary, errors });
}
