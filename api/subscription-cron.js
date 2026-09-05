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
// NOT yet added to vercel.json / vercel.ts crons — wire the schedule when
// Payment Nerds is connected. Suggested: every hour  ("0 * * * *").
//
// Auth: set CRON_SECRET in the Vercel project; the scheduler is configured to
// send it as `Authorization: Bearer <CRON_SECRET>`. Manual runs must match.
// ===========================================================================

import { createClient } from '@supabase/supabase-js';

const PRICE_USD = '7.10';
const REMINDER_WINDOW_HOURS = 24;

function admin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase admin env not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

// -- TODO(payment-nerds): real charge. Return { ok: true } / { ok: false }. ----
async function chargeCard(/* profile, amountUsd */) {
  return { ok: false, pending: true, reason: 'payment-nerds-not-connected' };
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

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (secret && auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  let db;
  try { db = admin(); }
  catch (e) { res.status(500).json({ error: e.message }); return; }

  const now = new Date();
  const soon = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3600000);
  const summary = { remindersSent: 0, trialsCharged: 0, trialsBlocked: 0, trialsCanceled: 0, renewals: 0, renewalsBlocked: 0, subsCanceled: 0, errors: [] };

  // --- 1. Day-2 reminders -------------------------------------------------
  try {
    const { data: due } = await db
      .from('profiles')
      .select('id, contact_email, preferred_lang, trial_ends_at')
      .eq('subscription_status', 'trialing')
      .is('trial_reminder_sent_at', null)
      .eq('cancel_at_period_end', false)
      .lte('trial_ends_at', soon.toISOString())
      .gt('trial_ends_at', now.toISOString());
    for (const p of due || []) {
      await sendTrialReminderEmail(p); // TODO(email): currently a no-op stub
      await db.from('profiles').update({ trial_reminder_sent_at: now.toISOString() }).eq('id', p.id);
      summary.remindersSent++;
    }
  } catch (e) { summary.errors.push('reminders: ' + e.message); }

  // --- 2. Trials that have ended ----------------------------------------
  try {
    const { data: ended } = await db
      .from('profiles')
      .select('id, cancel_at_period_end, trial_ends_at, payment_customer_id')
      .eq('subscription_status', 'trialing')
      .lte('trial_ends_at', now.toISOString());
    for (const p of ended || []) {
      if (p.cancel_at_period_end) {
        await db.from('profiles').update({ subscription_status: 'canceled', canceled_at: now.toISOString() }).eq('id', p.id);
        summary.trialsCanceled++;
        continue;
      }
      const charge = await chargeCard(p, PRICE_USD); // TODO(payment-nerds)
      if (charge.ok) {
        await db.from('profiles').update({
          subscription_status: 'active',
          subscription_active: true,
          subscription_expires_at: addOneMonth(now),
        }).eq('id', p.id);
        summary.trialsCharged++;
      } else {
        // Immediate block — no grace period.
        await db.from('profiles').update({
          subscription_status: 'blocked',
          subscription_active: false,
        }).eq('id', p.id);
        summary.trialsBlocked++;
      }
    }
  } catch (e) { summary.errors.push('trial-end: ' + e.message); }

  // --- 3. Paid subscriptions past their period -------------------------
  try {
    const { data: expired } = await db
      .from('profiles')
      .select('id, cancel_at_period_end, subscription_expires_at, payment_customer_id')
      .eq('subscription_status', 'active')
      .lte('subscription_expires_at', now.toISOString());
    for (const p of expired || []) {
      if (p.cancel_at_period_end) {
        await db.from('profiles').update({
          subscription_status: 'canceled',
          subscription_active: false,
          canceled_at: now.toISOString(),
        }).eq('id', p.id);
        summary.subsCanceled++;
        continue;
      }
      const charge = await chargeCard(p, PRICE_USD); // TODO(payment-nerds)
      if (charge.ok) {
        await db.from('profiles').update({ subscription_expires_at: addOneMonth(now) }).eq('id', p.id);
        summary.renewals++;
      } else {
        await db.from('profiles').update({
          subscription_status: 'blocked',
          subscription_active: false,
        }).eq('id', p.id);
        summary.renewalsBlocked++;
      }
    }
  } catch (e) { summary.errors.push('renewal: ' + e.message); }

  res.status(200).json({ ok: true, ran_at: now.toISOString(), ...summary });
}
