// ===========================================================================
// Subscription / free-trial flow  ->  window.mvSub
// ===========================================================================
// Product shape (decided with the owner):
//   * 3-day free trial, then $7.10/month, charged automatically.
//   * The exact price + the "you will be charged" sentence are shown on the
//     same screen as the card field, in normal-size text (see #premiumModal in
//     index.html) BEFORE any card data is asked for.
//   * A separate, unchecked consent checkbox (#pmConsent) must be ticked.
//   * Cancelling is fully self-serve from Cuenta -> Suscripcion. No emails, no
//     support contact.
//   * Day 2 (24h before the trial ends): a reminder. Channel today = an in-app
//     banner (#trialReminderBanner). The email version is DESIGNED ONLY — see
//     api/subscription-cron.js and docs/trial-reminder-email.md — because no
//     transactional email provider is connected yet.
//   * If the day-3 charge fails: immediate block (no grace period). The row
//     goes to 'blocked', computeIsPremium() returns false, content re-locks,
//     and a non-dismissible banner points the user at "update card".
//
// PAYMENT PROCESSOR: Payment Nerds. Not connected yet (integration meeting
// pending). Every place that would talk to the processor is stubbed and marked
//   TODO(payment-nerds):
// and never runs while PAYMENTS_ENABLED === false. The Supabase data model and
// the whole UI already work end-to-end without it (card-less trial start on
// localhost / preview), so wiring the processor later is an additive change.
// ===========================================================================

const PAYMENTS_ENABLED = false; // TODO(payment-nerds): flip to true once the processor is live
const PRICE_USD        = '7.10';
const PRICE_LABEL      = '$7.10';
const BILLING_PERIOD   = 'month';
const TRIAL_DAYS       = 3;

// Trial start is allowed from the browser without a card while the processor
// is offline, but ONLY on localhost / Vercel preview — never on the real
// production domain, where the offer button stays disabled ("proximamente").
function isTestHost(){
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.vercel.app');
}
function trialStartAllowed(){
  return PAYMENTS_ENABLED || isTestHost();
}

function sb(){ return window.mvSupabase; }
function profileRow(){ return window.mvCurrentProfile; }

// ---------------------------------------------------------------------------
// Derived, UI-facing view of the current subscription.
// ---------------------------------------------------------------------------
function getState(){
  const p = profileRow();
  if(!window.mvCurrentUser) return { status: 'anon', price: PRICE_LABEL, trialDays: TRIAL_DAYS, paymentsEnabled: PAYMENTS_ENABLED, trialStartAllowed: trialStartAllowed() };
  if(!p) return { status: 'loading', price: PRICE_LABEL, trialDays: TRIAL_DAYS, paymentsEnabled: PAYMENTS_ENABLED, trialStartAllowed: trialStartAllowed() };

  const now      = Date.now();
  const raw      = p.subscription_status || 'none';
  const trialEnds  = p.trial_ends_at ? new Date(p.trial_ends_at) : null;
  const paidUntil  = p.subscription_expires_at ? new Date(p.subscription_expires_at) : null;
  const periodEnd  = raw === 'active' ? paidUntil : (trialEnds || paidUntil);
  const cancelAtPeriodEnd = !!p.cancel_at_period_end;

  // Lazy client view: if the period is already over but the cron hasn't run
  // yet, show the outcome the cron would produce. Immediate block on a missed
  // charge (no grace), per spec.
  let status = raw;
  if((raw === 'trialing' || raw === 'active') && periodEnd && periodEnd.getTime() <= now){
    status = cancelAtPeriodEnd ? 'canceled' : 'blocked';
  }

  const msLeft = periodEnd ? periodEnd.getTime() - now : null;
  const hoursLeft = msLeft != null ? msLeft / 3600000 : null;

  let trialDayNumber = null;
  if(raw === 'trialing' && p.trial_started_at){
    const started = new Date(p.trial_started_at).getTime();
    trialDayNumber = Math.min(TRIAL_DAYS, Math.floor((now - started) / 86400000) + 1);
  }

  return {
    status,                       // 'none' | 'trialing' | 'active' | 'canceled' | 'past_due' | 'blocked'
    raw,                          // untouched DB value
    cancelAtPeriodEnd,
    trialUsed: !!p.trial_started_at,
    periodEnd,                    // Date | null  -> when access ends / renews
    trialEnds,                    // Date | null
    firstChargeDate: trialEnds,   // the first charge lands exactly when the trial ends
    hoursLeft,
    daysLeft: hoursLeft != null ? Math.max(0, Math.ceil(hoursLeft / 24)) : null,
    trialDayNumber,               // 1..3 while trialing
    price: PRICE_LABEL,
    priceUsd: PRICE_USD,
    billingPeriod: BILLING_PERIOD,
    trialDays: TRIAL_DAYS,
    paymentsEnabled: PAYMENTS_ENABLED,
    trialStartAllowed: trialStartAllowed(),
  };
}

async function reloadProfile(){
  if(window.mvRefreshAuth) return window.mvRefreshAuth();
}

// ---------------------------------------------------------------------------
// State changes. Each is one authoritative Postgres RPC (security definer);
// the client can't write billing columns directly (column GRANTs revoked in
// the migration).
// ---------------------------------------------------------------------------
async function startTrial(){
  if(!window.mvCurrentUser) throw new Error('not-authenticated');
  if(!trialStartAllowed()) throw new Error('payments-not-live');

  let customerId = null, subscriptionId = null;
  if(PAYMENTS_ENABLED){
    // TODO(payment-nerds): tokenize the card entered in #pmCardElement, create a
    // customer + a subscription that carries a 3-day trial on the processor
    // side, and pass the returned ids through so the webhook can reconcile
    // charge events back to this profile.
    const token   = await tokenizeCard();
    const created = await createSubscription(token, { trialDays: TRIAL_DAYS, priceUsd: PRICE_USD });
    customerId     = created.customerId;
    subscriptionId = created.subscriptionId;
  }

  const { data, error } = await sb().rpc('start_free_trial', {
    p_customer_id: customerId,
    p_subscription_id: subscriptionId,
  });
  if(error) throw error;
  await reloadProfile();
  return data;
}

async function cancelSubscription(){
  const { data, error } = await sb().rpc('cancel_subscription');
  if(error) throw error;
  // TODO(payment-nerds): also call the processor to cancel the subscription so
  // no renewal attempt is made. (The RPC already stops OUR side.)
  await reloadProfile();
  return data;
}

async function reactivate(){
  const { data, error } = await sb().rpc('reactivate_subscription');
  if(error) throw error;
  // TODO(payment-nerds): un-cancel on the processor side too.
  await reloadProfile();
  return data;
}

// ---------------------------------------------------------------------------
// PENDING: Payment Nerds integration. All stubs. None of this runs while
// PAYMENTS_ENABLED === false.
// ---------------------------------------------------------------------------
async function mountCardElement(/* containerId */){
  // TODO(payment-nerds): mount the processor's hosted card fields into
  // #pmCardElement (PCI-safe iframe). Mother Verde never touches the PAN.
  throw new Error('TODO(payment-nerds): mountCardElement');
}
async function tokenizeCard(){
  // TODO(payment-nerds): return a single-use token / payment-method id for the
  // card currently in #pmCardElement.
  throw new Error('TODO(payment-nerds): tokenizeCard');
}
async function createSubscription(/* token, opts */){
  // TODO(payment-nerds): create customer + trialing subscription; return
  // { customerId, subscriptionId }.
  throw new Error('TODO(payment-nerds): createSubscription');
}
async function chargeNow(){
  // TODO(payment-nerds): charge the stored card immediately (used when a
  // blocked user adds a working card, and for canceled users re-subscribing
  // with no second trial).
  throw new Error('TODO(payment-nerds): chargeNow');
}
async function updateCard(){
  // TODO(payment-nerds): open hosted fields to replace the card on file, then
  // retry the outstanding charge.
  throw new Error('TODO(payment-nerds): updateCard');
}

// ---------------------------------------------------------------------------
// Dev aid: preview a subscription state in the UI without touching the DB.
// Mutates the in-memory profile only; a real reload wipes it. localhost only.
//   window.mvSub.__preview('blocked')   window.mvSub.__preview(null) to reset
// ---------------------------------------------------------------------------
const PREVIEW_KEYS = ['subscription_status','trial_started_at','trial_ends_at','subscription_expires_at','subscription_active','cancel_at_period_end'];
let __previewBackup = null;
function __localIsPremium(p){
  const now = Date.now(), s = p.subscription_status || 'none';
  if(s === 'trialing') return !!p.trial_ends_at && new Date(p.trial_ends_at).getTime() > now;
  if(s === 'active') return !p.subscription_expires_at || new Date(p.subscription_expires_at).getTime() > now;
  return false;
}
function __preview(status){
  if(!isTestHost()){ console.warn('mvSub.__preview is localhost/preview only'); return; }
  const p = window.mvCurrentProfile;
  if(!p){ console.warn('mvSub.__preview: no profile loaded (sign in first)'); return; }
  if(status === null || status === undefined){
    if(__previewBackup){ PREVIEW_KEYS.forEach(k => p[k] = __previewBackup[k]); __previewBackup = null; }
  } else {
    if(!__previewBackup){ __previewBackup = {}; PREVIEW_KEYS.forEach(k => __previewBackup[k] = p[k]); }
    const soon   = new Date(Date.now() + 20 * 3600000).toISOString();  // ~20h left -> triggers day-2 banner
    const past   = new Date(Date.now() -  1 * 3600000).toISOString();
    const future = new Date(Date.now() + 26 * 86400000).toISOString();
    p.subscription_active = false;
    p.cancel_at_period_end = false;
    p.trial_started_at = ['none'].includes(status) ? null : new Date(Date.now() - 2 * 86400000).toISOString();
    p.subscription_status = status;
    p.trial_ends_at = status === 'trialing' ? soon : (['blocked','canceled','past_due','active'].includes(status) ? past : null);
    p.subscription_expires_at = status === 'active' ? future : (status === 'canceled' ? soon : null);
  }
  window.setIsPremium?.(__localIsPremium(p));
  window.renderCuenta?.();
  window.syncTrialBanners?.();
  console.log('mvSub.__preview ->', getState());
}

window.mvSub = {
  getState,
  startTrial,
  cancelSubscription,
  reactivate,
  // pending processor stubs (exposed for wiring later / console testing)
  mountCardElement, tokenizeCard, createSubscription, chargeNow, updateCard,
  PAYMENTS_ENABLED, PRICE_LABEL, PRICE_USD, TRIAL_DAYS,
  __preview,
};
