import { createClient } from '@supabase/supabase-js';
import { CAPTCHA, captchaIsOn } from './captchaConfig.js';

// What an e-mail link brought back, read BEFORE the client consumes the URL.
// Supabase sends the person to the site with, in the hash (or the query):
//   error=access_denied&error_code=otp_expired   link expired or already used
//   type=recovery | signup | email_change        link worked (plus the tokens)
//   message=Confirmation link accepted…          e-mail change: one of the two
//                                                links done, the other one left
// The links use the implicit flow: they work in any browser or phone, even one
// where the person never signed in (PKCE would tie them to the first browser).
function readAuthLink(){
  try {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const q = new URLSearchParams(location.search);
    const get = (k) => h.get(k) || q.get(k) || '';
    return { error: get('error'), code: get('error_code'), type: get('type'), message: get('message') };
  } catch(e){ return {}; }
}
const MV_LINK = readAuthLink();
// Where the links in our e-mails come back to. Must be in Supabase → Auth →
// URL Configuration → Redirect URLs; if it isn't, Supabase uses the Site URL.
const MV_REDIRECT = location.origin + '/';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

window.mvSupabase = supabase;
window.mvCurrentUser = null;
window.mvCurrentProfile = null;

// Access: ONE rule, in the database (public.access_info, migration
// 20261014140000), used by RLS, the Edge Functions, the panel and — through
// my_access() — this app. Nothing here recomputes it: the app keeps the
// server's answer and only compares "until" with the SERVER clock (offset
// measured from server_now), so a wrong device clock doesn't matter.
let accessOffset = 0;
window.mvCurrentAccess = null;
window.mvServerNow = () => Date.now() + accessOffset;
async function loadAccess(){
  if(!window.mvCurrentUser){ window.mvCurrentAccess = null; return; }
  const { data, error } = await supabase.rpc('my_access');
  if(error || !data){ console.error('my_access', error); window.mvCurrentAccess = null; return; }
  if(data.server_now) accessOffset = new Date(data.server_now).getTime() - Date.now();
  window.mvCurrentAccess = data;
}
function hasFullAccess(){
  const x = window.mvCurrentAccess;
  return !!x && x.full === true && (!x.until || new Date(x.until).getTime() > window.mvServerNow());
}
window.mvHasFullAccess = hasFullAccess;

async function loadProfile(userId){
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if(error){ console.error('loadProfile', error); return null; }
  return data;
}

async function refreshAuthState(){
  const { data: { session } } = await supabase.auth.getSession();
  window.mvCurrentUser = session?.user || null;
  window.mvCurrentProfile = window.mvCurrentUser ? await loadProfile(window.mvCurrentUser.id) : null;
  await loadAccess();
  window.setIsPremium?.(hasFullAccess());
  window.renderCuenta?.();
  window.renderBitacoraGate?.();
  if(document.getElementById('bitacora')?.classList.contains('active')) window.loadBitEntries?.();
  window.loadTrichLog?.();
  if(window.mvCurrentUser) window.mvSetPendingConfirm?.('');
  await loadLatestClaim();
  window.mvApplyAccessState?.();
  renderRecovery();
  renderCeBox();
  renderLinkCard();
}

// Latest support-contribution claim of the signed-in person (support_claims,
// RLS: own rows only). null when none, signed out, or the table isn't there.
async function loadLatestClaim(){
  window.mvLatestClaim = null;
  if(!window.mvCurrentUser) return;
  const { data, error } = await supabase.from('support_claims')
    .select('id, status, flowers, amount_units, created_at, expires_at, tx_hash, submitted_at, review_reason, reviewed_at, late')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if(!error) window.mvLatestClaim = data || null;
}
window.mvLoadLatestClaim = loadLatestClaim;

// Let public/main.js and src/desbloquear.js force a full auth/profile reload
// after an access change, so gating updates everywhere at once.
window.mvRefreshAuth = refreshAuthState;

supabase.auth.onAuthStateChange((event) => {
  if(event === 'PASSWORD_RECOVERY') recoveryPending = true;
  refreshAuthState();
});

function mapAuthError(err){
  const msg = (err && err.message || '').toLowerCase();
  const code = (err && err.code) || '';
  // Sending limits (Supabase's e-mails per hour) and SMTP failures: say so,
  // instead of "something went wrong".
  if(code === 'over_email_send_rate_limit' || err?.status === 429 || msg.includes('rate limit')) return 'authErrRate';
  if(msg.includes('error sending') || code === 'unexpected_failure') return 'authErrSend';
  // Rejected by the "Before User Created" hook (disposable domain, or the same
  // Gmail address already has an account). One message for both on purpose.
  if(msg.includes('signup_not_allowed')) return 'authErrSignupNotAllowed';
  if(msg.includes('already registered') || msg.includes('already exists')) return 'authErrEmailTaken';
  if(msg.includes('invalid login credentials')) return 'authErrInvalidCredentials';
  if(msg.includes('password') && (msg.includes('least') || msg.includes('short') || msg.includes('weak'))) return 'authErrWeakPassword';
  if(msg.includes('email') && msg.includes('invalid')) return 'authErrInvalidEmail';
  return 'authErrGeneric';
}

function setAuthMsg(text, isError){
  const el = document.getElementById('authMsg');
  if(!el) return;
  el.textContent = text || '';
  el.style.color = isError ? 'var(--clay)' : 'var(--moss-deep)';
}

function setAuthBusy(busy){
  const btn = document.getElementById('authSubmitBtn');
  if(btn) btn.disabled = busy;
  if(busy) setAuthMsg(window.t('authLoading'), false);
}

let authMode = 'login';
function renderAuthMode(){
  const title = document.getElementById('authSubmitBtn');
  const switchLink = document.getElementById('authSwitchLink');
  if(title) title.textContent = window.t(authMode === 'login' ? 'authLoginBtn' : 'authSignupBtn');
  if(switchLink) switchLink.textContent = window.t(authMode === 'login' ? 'authSwitchToSignup' : 'authSwitchToLogin');
  const forgot = document.getElementById('authForgotLink');
  if(forgot) forgot.hidden = authMode !== 'login';
  document.querySelectorAll('#authTabs button').forEach(b => b.classList.toggle('on', b.dataset.authTab === authMode));
  setAuthMsg('', false);
}
window.mvRenderAuthMode = renderAuthMode;
// Used by the access screen's "Crear cuenta" / "Entrar" buttons.
window.mvSetAuthMode = function(mode){ authMode = mode === 'signup' ? 'signup' : 'login'; renderAuthMode(); };

/* ---------------------- Captcha (OFF until keys exist) ---------------------- */
// src/captchaConfig.js. When off, nothing is loaded and no token is sent.
let captchaToken = null;
let captchaWidgetId = null;
function captchaOptions(){ return captchaIsOn() && captchaToken ? { captchaToken } : {}; }
function captchaReset(){
  captchaToken = null;
  if(captchaIsOn() && window.turnstile && captchaWidgetId !== null) window.turnstile.reset(captchaWidgetId);
}
function captchaMount(){
  if(!captchaIsOn()) return;
  const box = document.getElementById('authCaptcha');
  if(!box || box.dataset.mounted) return;
  box.dataset.mounted = '1';
  window.mvOnTurnstileLoad = () => {
    captchaWidgetId = window.turnstile.render(box, {
      sitekey: CAPTCHA.SITE_KEY,
      callback: (token) => { captchaToken = token; },
      'expired-callback': () => { captchaToken = null; },
    });
  };
  const sc = document.createElement('script');
  sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=mvOnTurnstileLoad';
  sc.async = true; sc.defer = true;
  document.head.appendChild(sc);
}
captchaMount();

/* ---------------------- E-mail sending limits (this browser) ---------------------- */
// Every "send me an e-mail" button: at least 60 s between two, at most 3 an
// hour, per kind (signup / recovery / email_change). Supabase also limits on
// its side (e-mails per hour for the whole project).
const MAIL_GAP_MS = 60000, MAIL_MAX_PER_HOUR = 3;
function mailSends(kind){
  try {
    const all = JSON.parse(localStorage.getItem('mv-mail-sends') || '{}');
    return (all[kind] || []).filter((ts) => Date.now() - ts < 3600000);
  } catch(e){ return []; }
}
// Milliseconds until the next e-mail of this kind may be asked for (0 = now).
function mailWaitMs(kind){
  const s = mailSends(kind);
  // The first confirmation e-mail (sent by the sign-up itself) starts the
  // 60 s gap but isn't one of the 3 resends.
  const last = Math.max(0, ...s, ...(kind === 'signup' ? mailSends('signup0') : []));
  if(!last) return 0;
  const gap = last + MAIL_GAP_MS - Date.now();
  const hour = s.length >= MAIL_MAX_PER_HOUR ? Math.min(...s) + 3600000 - Date.now() : 0;
  return Math.max(0, gap, hour);
}
function mailNoteSent(kind){
  try {
    const all = JSON.parse(localStorage.getItem('mv-mail-sends') || '{}');
    all[kind] = [...mailSends(kind), Date.now()];
    localStorage.setItem('mv-mail-sends', JSON.stringify(all));
  } catch(e){}
}
window.mvMailWaitMs = mailWaitMs;
window.mvMailSendsLeft = (kind) => Math.max(0, MAIL_MAX_PER_HOUR - mailSends(kind).length);
function waitText(ms){ return window.t('authErrWait').replace('{s}', Math.ceil(ms / 1000)); }

/* ---------------------- E-mail confirmation ---------------------- */
// Resend the sign-up confirmation e-mail. Returns null, or the i18n key of
// the message to show.
window.mvResendConfirmation = async function(email){
  if(mailWaitMs('signup') > 0) return 'authErrWait';
  mailNoteSent('signup');
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: MV_REDIRECT, ...captchaOptions() } });
  captchaReset();
  return error ? mapAuthError(error) : null;
};

// Correct a mistyped sign-up e-mail (unconfirmed account, password needed;
// supabase/functions/signup-fix-email), then send the confirmation to the
// corrected address. Returns { ok, sendError? } or { error }.
window.mvFixSignupEmail = async function(oldEmail, newEmail, password){
  const { data, error } = await supabase.functions.invoke('signup-fix-email', {
    body: { old_email: oldEmail, new_email: newEmail, password, ...(captchaToken ? { captcha_token: captchaToken } : {}) },
  });
  captchaReset();
  if(error){
    let code = '';
    try { code = (await error.context.json()).error || ''; } catch(e){}
    return { ok: false, error: code || 'server_error' };
  }
  if(!data?.ok) return { ok: false, error: 'server_error' };
  // Sent at once (new address), but counted in the hourly limit.
  mailNoteSent('signup');
  const { error: sendErr } = await supabase.auth.resend({ type: 'signup', email: newEmail, options: { emailRedirectTo: MV_REDIRECT } });
  return { ok: true, sendError: sendErr ? mapAuthError(sendErr) : null };
};

// "Forgot your password?": always the same answer, whether the account
// exists or not (nobody can use it to find out who has an account).
async function sendRecovery(email){
  if(mailWaitMs('recovery') > 0) return waitText(mailWaitMs('recovery'));
  mailNoteSent('recovery');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: MV_REDIRECT, ...captchaOptions() });
  captchaReset();
  const key = error ? mapAuthError(error) : '';
  return window.t(key === 'authErrRate' || key === 'authErrSend' ? key : 'authOlvidoEnviado');
}

document.getElementById('authForgotLink')?.addEventListener('click', async () => {
  const input = document.getElementById('authEmailInput');
  const email = (input?.value || '').trim();
  if(!email){ setAuthMsg(window.t('lnkPideCorreo'), true); input?.focus(); return; }
  setAuthMsg(window.t('authLoading'), false);
  setAuthMsg(await sendRecovery(email), false);
});

/* ---------------------- Coming back from an e-mail link ---------------------- */
let linkNotice = null;       // 'expired' | 'error' | 'half' | 'changed' | null
let recoveryPending = false; // opened a "reset password" link
if(MV_LINK.error) linkNotice = (MV_LINK.code === 'otp_expired' || MV_LINK.error === 'access_denied') ? 'expired' : 'error';
else if(MV_LINK.message) linkNotice = 'half';
else if(MV_LINK.type === 'email_change') linkNotice = 'changed';
if(MV_LINK.type === 'recovery') recoveryPending = true;

function renderLinkCard(){
  const card = document.getElementById('authLinkCard');
  if(!card) return;
  if(!linkNotice){ card.hidden = true; card.innerHTML = ''; return; }
  const t = window.t;
  const close = '<button type="button" class="auth-link-btn" data-link-act="close">' + t('lnkCerrar') + '</button>';
  let html;
  if(linkNotice === 'expired' || linkNotice === 'error'){
    const bad = linkNotice === 'expired';
    html = '<h3>' + t(bad ? 'lnkExpH' : 'lnkErrH') + '</h3><p class="acc-text">' + t(bad ? 'lnkExpP' : 'lnkErrP') + '</p>'
      + (window.mvCurrentUser ? '' : '<div class="acc-actions"><button type="button" class="btn btn-ghost" data-link-act="signup">' + t('lnkNuevaConf') + '</button>'
        + '<button type="button" class="btn btn-ghost" data-link-act="recovery">' + t('lnkNuevaClave') + '</button></div>')
      + '<p class="acc-note" id="authLinkMsg" role="status"></p>';
  } else {
    html = '<p class="acc-text">' + t(linkNotice === 'half' ? 'lnkMitad' : 'lnkCambiado') + '</p>';
  }
  card.innerHTML = html + close;
  card.hidden = false;
}

document.getElementById('authLinkCard')?.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-link-act]');
  if(!b) return;
  const act = b.dataset.linkAct;
  if(act === 'close'){ linkNotice = null; renderLinkCard(); return; }
  const msg = document.getElementById('authLinkMsg');
  const input = document.getElementById('authEmailInput');
  const email = (input?.value || '').trim();
  if(!email){ if(msg) msg.textContent = window.t('lnkPideCorreo'); input?.focus(); return; }
  if(act === 'recovery'){ if(msg) msg.textContent = await sendRecovery(email); return; }
  const wait = mailWaitMs('signup');
  if(wait > 0){ if(msg) msg.textContent = waitText(wait); return; }
  const key = await window.mvResendConfirmation(email);
  if(msg) msg.textContent = window.t(!key ? 'lnkEnviado' : key === 'authErrRate' || key === 'authErrSend' ? key : 'lnkEnviado');
});

/* ---------------------- New password (after a reset link) ---------------------- */
function renderRecovery(){
  const card = document.getElementById('authRecoveryCard');
  if(card) card.hidden = !(recoveryPending && window.mvCurrentUser);
}
document.getElementById('authRecoveryForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const p1 = document.getElementById('recPass1').value, p2 = document.getElementById('recPass2').value;
  const msg = document.getElementById('recMsg'), btn = document.getElementById('recSaveBtn');
  if(p1 !== p2){ msg.textContent = window.t('recNoCoinciden'); return; }
  btn.disabled = true;
  const { error } = await supabase.auth.updateUser({ password: p1 });
  btn.disabled = false;
  if(error){
    const key = mapAuthError(error);
    msg.textContent = window.t(key === 'authErrWeakPassword' ? key : 'recError');
    return;
  }
  e.target.reset();
  recoveryPending = false;
  renderRecovery();
  setCeMsg(window.t('recOk'));
});

/* ---------------------- Change the sign-in e-mail ---------------------- */
// Supabase sends "Confirm your new e-mail" (and, with Secure e-mail change
// on, a link to the current address too). Nothing changes until it's opened.
function setCeMsg(text){ const el = document.getElementById('ceMsg'); if(el) el.textContent = text || ''; }
let ceCurrentEmail = '';
async function renderCeBox(){
  const el = document.getElementById('ceActual');
  if(!el) return;
  ceCurrentEmail = window.mvCurrentUser?.email || '';
  el.textContent = ceCurrentEmail;
  if(!window.mvCurrentUser) return;
  // The stored session can be older than the last change: ask the server.
  const { data } = await supabase.auth.getUser().catch(() => ({ data: null }));
  if(data?.user?.email){ ceCurrentEmail = data.user.email; el.textContent = ceCurrentEmail; }
}
document.getElementById('ceOpenBtn')?.addEventListener('click', () => {
  const f = document.getElementById('ceForm');
  f.hidden = !f.hidden;
  if(!f.hidden) document.getElementById('ceInput').focus();
});
document.getElementById('ceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('ceInput').value.trim().toLowerCase();
  if(!window.mvCurrentUser || !email) return;
  if(email === ceCurrentEmail.toLowerCase()){ setCeMsg(window.t('ceIgual')); return; }
  const wait = mailWaitMs('email_change');
  if(wait > 0){ setCeMsg(waitText(wait)); return; }
  mailNoteSent('email_change');
  const btn = document.getElementById('ceSendBtn');
  btn.disabled = true;
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: MV_REDIRECT });
  btn.disabled = false;
  if(error){ setCeMsg(window.t(mapAuthError(error))); return; }
  const esc = (x) => x.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  document.getElementById('ceMsg').innerHTML = window.t('ceEnviado').replace('{email}', '<b>' + esc(email) + '</b>');
  e.target.reset();
  e.target.hidden = true;
});

// Language switch: redraw what is built here (main.js calls it).
window.mvRedrawAuthTexts = function(){ renderLinkCard(); };

document.getElementById('authTabs')?.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-auth-tab]');
  if(!b) return;
  authMode = b.dataset.authTab;
  renderAuthMode();
});

document.getElementById('authSwitchLink')?.addEventListener('click', () => {
  authMode = authMode === 'login' ? 'signup' : 'login';
  renderAuthMode();
});

document.getElementById('authForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmailInput').value.trim();
  const password = document.getElementById('authPasswordInput').value;
  setAuthBusy(true);
  try{
    if(authMode === 'signup'){
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { preferred_lang: (window.getCurrentLang && window.getCurrentLang()) || 'es' }, emailRedirectTo: MV_REDIRECT, ...captchaOptions() }
      });
      if(error) throw error;
      if(!data.session){
        // E-mail not confirmed yet: the access screen explains it and offers
        // to resend. The 24 h trial starts only once it's confirmed.
        mailNoteSent('signup0');
        setAuthMsg(window.t('authSignupCheckEmail'), false);
        window.mvSetPendingConfirm?.(email);
        window.showScreen?.('acceso');
      } else {
        setAuthMsg(window.t('authSignupSuccess'), false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password, options: captchaOptions() });
      if(error){
        if((error.message || '').toLowerCase().includes('email not confirmed')){
          window.mvSetPendingConfirm?.(email);
          window.showScreen?.('acceso');
        }
        throw error;
      }
      window.mvSetPendingConfirm?.('');
    }
    document.getElementById('authForm').reset();
  } catch(err){
    setAuthMsg(window.t(mapAuthError(err)), true);
  } finally {
    captchaReset();
    setAuthBusy(false);
  }
});

document.getElementById('authLogoutBtn')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
});

/* ---------------------- Delete account ---------------------- */
// The real work (password re-check, Storage, translation cache, auth user)
// happens server-side in supabase/functions/delete-account. Here: an inline
// confirm that needs the password plus a typed, localized word.

function delAccEls(){
  return {
    box: document.getElementById('delAccConfirm'),
    text: document.getElementById('delAccConfirmText'),
    pw: document.getElementById('delAccPassword'),
    word: document.getElementById('delAccWord'),
    btn: document.getElementById('delAccConfirmBtn'),
    msg: document.getElementById('delAccMsg'),
  };
}

function resetDeleteAccount(){
  const el = delAccEls();
  if(!el.box) return;
  el.box.hidden = true;
  el.pw.value = '';
  el.word.value = '';
  el.msg.textContent = '';
  el.btn.disabled = false;
}

document.getElementById('delAccOpenBtn')?.addEventListener('click', () => {
  const el = delAccEls();
  const word = window.t('delAccWord');
  el.text.textContent = window.t('delAccConfirmText').replace('{word}', word);
  el.word.placeholder = word;
  el.msg.textContent = '';
  el.box.hidden = false;
  el.pw.focus();
});

document.getElementById('delAccCancelBtn')?.addEventListener('click', resetDeleteAccount);

document.getElementById('delAccConfirmBtn')?.addEventListener('click', async () => {
  if(!window.mvCurrentUser) return;
  const el = delAccEls();
  const password = el.pw.value;
  const typed = el.word.value.trim().toLocaleUpperCase();
  if(!password || typed !== window.t('delAccWord').toLocaleUpperCase()){
    el.msg.textContent = window.t('delAccErrConfirm');
    return;
  }
  el.btn.disabled = true;
  el.msg.textContent = window.t('delAccWorking');

  const { error } = await supabase.functions.invoke('delete-account', {
    body: { password, confirm: 'DELETE' },
  });
  if(error){
    let code = '';
    try { code = (await error.context.json()).error || ''; } catch(e){}
    el.msg.textContent = window.t(
      code === 'wrong password' ? 'delAccErrPassword'
      : (code === 'official account' || code === 'active subscription') ? 'delAccErrBlocked'
      : 'delAccErrGeneric'
    );
    el.btn.disabled = false;
    return;
  }

  // The account is gone server-side; drop the local session and everything
  // this device kept for the app.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  try { localStorage.clear(); sessionStorage.clear(); } catch(e){}
  resetDeleteAccount();
  await refreshAuthState();
  setAuthMsg(window.t('delAccDone'), false);
});

document.getElementById('cuentaGuardarBtn')?.addEventListener('click', async () => {
  if(!window.mvCurrentUser) return;
  const contact_email = document.getElementById('cuentaCorreoInput').value.trim();
  const statusEl = document.getElementById('cuentaGuardarStatus');
  const { error } = await supabase.from('profiles').update({ contact_email }).eq('id', window.mvCurrentUser.id);
  if(statusEl) statusEl.textContent = error ? window.t('authErrGeneric') : window.t('authProfileSaved');
  if(!error) window.mvCurrentProfile = await loadProfile(window.mvCurrentUser.id);
});

renderAuthMode();
// First load: once the client has read the link, take the leftovers out of
// the address bar and open Cuenta when the link needs an answer there.
refreshAuthState().then(() => {
  if(MV_LINK.error || MV_LINK.message || MV_LINK.type){
    try { history.replaceState(null, '', location.pathname); } catch(e){}
  }
  if(linkNotice || (recoveryPending && window.mvCurrentUser)){
    window.showScreen?.('cuenta');
    if(!window.mvCurrentUser) window.mvSetAuthMode?.('login');
    document.getElementById(recoveryPending && window.mvCurrentUser ? 'authRecoveryCard' : 'authLinkCard')?.scrollIntoView({ block: 'start' });
  }
});

// Dev-preview state selector: only in builds made with the preview flag
// (vite.config.js). In the production build this condition is the constant
// false, so the module is not even emitted.
if (import.meta.env.VITE_MV_PREVIEW === '1') import('./devPreview.js');
