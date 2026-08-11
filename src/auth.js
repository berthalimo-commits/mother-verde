import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

window.mvSupabase = supabase;
window.mvCurrentUser = null;
window.mvCurrentProfile = null;

function computeIsPremium(profile){
  if(!profile || !profile.subscription_active) return false;
  if(!profile.subscription_expires_at) return true;
  return new Date(profile.subscription_expires_at) > new Date();
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
}

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
  const display_name = document.getElementById('cuentaNombreInput').value.trim();
  const contact_email = document.getElementById('cuentaCorreoInput').value.trim();
  const statusEl = document.getElementById('cuentaGuardarStatus');
  const { error } = await supabase.from('profiles').update({ display_name, contact_email }).eq('id', window.mvCurrentUser.id);
  if(statusEl) statusEl.textContent = error ? window.t('authErrGeneric') : window.t('authProfileSaved');
  if(!error) window.mvCurrentProfile = await loadProfile(window.mvCurrentUser.id);
});

renderAuthMode();
refreshAuthState();
