import { createClient } from '@supabase/supabase-js';
import { CAPTCHA, captchaIsOn } from './captchaConfig.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

window.mvSupabase = supabase;
window.mvCurrentUser = null;
window.mvCurrentProfile = null;

// Canonical client-side full-access check. Mirrors public.is_premium(uid) in
// supabase/migrations/20261010120000_access_support_model.sql — keep the two
// in sync. Full access = verified contribution ('supporter'), the 24 h trial,
// or days from a gift code / an admin (access_until), unless an admin took
// access away ('revoked'). Rows from the old card model are still honoured.
// Exposed so main.js can recompute Premium itself instead of trusting a
// caller-supplied value (see the window.setIsPremium guard in main.js).
window.mvComputeIsPremium = computeIsPremium;
function computeIsPremium(profile){
  if(!profile) return false;
  const now = Date.now();
  const status = profile.subscription_status || 'none';
  // One-time support contribution, verified by hand: full access, no end date.
  if(status === 'supporter') return true;
  if(status === 'revoked') return false;
  if(profile.access_until && new Date(profile.access_until).getTime() > now) return true;
  if(status === 'trialing'){
    return !!profile.trial_ends_at && new Date(profile.trial_ends_at).getTime() > now;
  }
  if(status === 'active'){
    return !profile.subscription_expires_at || new Date(profile.subscription_expires_at).getTime() > now;
  }
  // Legacy rows written before the trial system existed.
  if(status === 'none' && profile.subscription_active){
    return !profile.subscription_expires_at || new Date(profile.subscription_expires_at).getTime() > now;
  }
  // canceled (period over) / past_due / blocked -> no access.
  return false;
}

async function loadProfile(userId){
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if(error){ console.error('loadProfile', error); return null; }
  return data;
}

async function refreshAuthState(){
  const { data: { session } } = await supabase.auth.getSession();
  window.mvCurrentUser = session?.user || null;
  window.mvCurrentProfile = window.mvCurrentUser ? await loadProfile(window.mvCurrentUser.id) : null;
  window.setIsPremium?.(computeIsPremium(window.mvCurrentProfile));
  window.renderCuenta?.();
  window.renderBitacoraGate?.();
  if(document.getElementById('bitacora')?.classList.contains('active')) window.loadBitEntries?.();
  window.loadTrichLog?.();
  if(window.mvCurrentUser) window.mvSetPendingConfirm?.('');
  await loadLatestClaim();
  window.mvApplyAccessState?.();
}

// Latest support-contribution claim of the signed-in person (support_claims,
// RLS: own rows only). null when none, signed out, or the table isn't there.
async function loadLatestClaim(){
  window.mvLatestClaim = null;
  if(!window.mvCurrentUser) return;
  const { data, error } = await supabase.from('support_claims')
    .select('id, status, flowers, amount_units, created_at, expires_at, tx_hash, submitted_at, review_reason, reviewed_at')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if(!error) window.mvLatestClaim = data || null;
}
window.mvLoadLatestClaim = loadLatestClaim;

// Let public/main.js and src/desbloquear.js force a full auth/profile reload
// after an access change, so gating updates everywhere at once.
window.mvRefreshAuth = refreshAuthState;

supabase.auth.onAuthStateChange(() => { refreshAuthState(); });

function mapAuthError(err){
  const msg = (err && err.message || '').toLowerCase();
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

/* ---------------------- E-mail confirmation ---------------------- */
// Resend the sign-up confirmation e-mail (the access screen limits how often).
window.mvResendConfirmation = async function(email){
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: captchaOptions() });
  captchaReset();
  return error || null;
};

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
        options: { data: { preferred_lang: (window.getCurrentLang && window.getCurrentLang()) || 'es' }, ...captchaOptions() }
      });
      if(error) throw error;
      if(!data.session){
        // E-mail not confirmed yet: the access screen explains it and offers
        // to resend. The 24 h trial starts only once it's confirmed.
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
refreshAuthState();
