// «STAGING · pruebas»: a visible badge on the web and the panel when this
// build is connected to the test project (mother-verde-staging), so nobody
// mistakes it for the real site. The stage is decided at build time by
// vite.config.js from the Supabase address (never shown in production or with
// the local simulated database). Follows the page language (html lang).
const TEXT = { es: 'STAGING · pruebas', en: 'STAGING · testing', de: 'STAGING · Tests', fr: 'STAGING · tests' };
const LABEL = {
  es: 'Entorno de pruebas: no es la web real y no tiene datos de personas reales.',
  en: 'Test environment: this is not the real site and it has no real people’s data.',
  de: 'Testumgebung: nicht die echte Website, keine Daten echter Personen.',
  fr: 'Environnement de test : ce n’est pas le vrai site et il n’a pas de données de vraies personnes.',
};

export function mountStageBadge(stage = import.meta.env.VITE_MV_STAGE) {
  if (stage !== 'staging' || document.getElementById('mvStageBadge')) return;
  const el = document.createElement('div');
  el.id = 'mvStageBadge';
  el.setAttribute('role', 'note');
  el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483000;pointer-events:none;background:#E3A75F;color:#07100D;'
    + 'font:700 12px/1 system-ui,-apple-system,sans-serif;letter-spacing:.06em;padding:7px 10px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.4)';
  const paint = () => {
    const l = (document.documentElement.lang || 'es').slice(0, 2);
    el.textContent = TEXT[l] || TEXT.es;
    el.setAttribute('aria-label', LABEL[l] || LABEL.es);
    if (!/^\[STAGING\] /.test(document.title)) document.title = '[STAGING] ' + document.title;
  };
  paint();
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  new MutationObserver(paint).observe(document.querySelector('title') || document.head, { childList: true, characterData: true, subtree: true });
  (document.body || document.documentElement).appendChild(el);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountStageBadge());
else mountStageBadge();
