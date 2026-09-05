import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

window.mvSupabase = supabase;
window.mvCurrentUser = null;
window.mvCurrentProfile = null;

// Canonical client-side Premium check. Mirrors public.is_premium(uid) in
// supabase/migrations/20260905180000_subscription_trial.sql — keep the two in
// sync. Premium = inside an active 3-day trial, or a paid subscription that
// hasn't lapsed. A pending cancellation (cancel_at_period_end) still counts as
// Premium until the period actually ends; the cron then flips the row.
function computeIsPremium(profile){
  if(!profile) return false;
  const now = Date.now();
  const status = profile.subscription_status || 'none';
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
  window.syncTrialBanners?.();
  if(document.getElementById('bitacora')?.classList.contains('active')) window.loadBitEntries?.();
  window.loadTrichLog?.();
}

// Let public/main.js (and src/subscription.js) force a full auth/profile reload
// after a subscription state change, so gating updates everywhere at once.
window.mvRefreshAuth = refreshAuthState;

supabase.auth.onAuthStateChange(() => { refreshAuthState(); });

function mapAuthError(err){
  const msg = (err && err.message || '').toLowerCase();
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
        options: { data: { preferred_lang: window.currentLang || 'es' } }
      });
      if(error) throw error;
      if(!data.session){
        setAuthMsg(window.t('authSignupCheckEmail'), false);
      } else {
        setAuthMsg(window.t('authSignupSuccess'), false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if(error) throw error;
    }
    document.getElementById('authForm').reset();
  } catch(err){
    setAuthMsg(window.t(mapAuthError(err)), true);
  } finally {
    setAuthBusy(false);
  }
});

document.getElementById('authLogoutBtn')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
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
