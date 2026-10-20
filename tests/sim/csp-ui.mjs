// Browser test — security headers (A2.2) and the 404 page (A2.3) on the BUILT
// app served like Vercel (static-headers.mjs on :5175, CSP ENFORCED, as on
// every non-production host). Every screen and sub-section, the 4 languages,
// the panel with all its tabs, installing as an app (manifest + service
// worker) and the 404: no CSP violation, no JavaScript error, nothing broken.
import { spawn } from 'child_process';
import { check, sleep, browser, summary, ADMIN } from './browser.mjs';

const SITE = 'http://localhost:5175';
const srv = spawn(process.execPath, ['static-headers.mjs'], { cwd: new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), stdio: 'ignore' });
for (let i = 0; i < 40; i++) { await sleep(250); try { if ((await fetch(SITE + '/')).ok) break; } catch {} }

// ------------------------------------------------------------ headers
const r = await fetch(SITE + '/');
const H = (k) => r.headers.get(k) || '';
check('cabeceras: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy y HSTS', H('x-content-type-options') === 'nosniff' && H('x-frame-options') === 'DENY'
  && H('referrer-policy') === 'strict-origin-when-cross-origin' && /camera=\(\)/.test(H('permissions-policy')) && /max-age=\d{7,}/.test(H('strict-transport-security')));
const csp = H('content-security-policy');
check('CSP aplicada fuera de producción, con frame-ancestors \'none\', sin eval y solo con lo que la app usa', /frame-ancestors 'none'/.test(csp) && !/unsafe-eval/.test(csp)
  && /fonts\.googleapis\.com/.test(csp) && /flagcdn\.com/.test(csp) && /object-src 'none'/.test(csp), csp);
const prodRule = (await import('fs')).readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8');
check('producción (motherverdeny.com): la CSP va primero en modo Report-Only y fijada al proyecto de producción', /"Content-Security-Policy-Report-Only"/.test(prodRule) && /https:\/\/[a-z0-9]{20}\.supabase\.co/.test(prodRule) && /motherverdeny/.test(prodRule));

// ------------------------------------------------------------ every screen, 4 languages
const b = await browser(null, null, 390);
const sess = { access_token: `u:${ADMIN}:aal2`, refresh_token: `r:${ADMIN}:aal2`, token_type: 'bearer', expires_in: 360000, expires_at: Math.floor(Date.now() / 1000) + 360000, user: { id: ADMIN, aud: 'authenticated', role: 'authenticated', email: 'x', app_metadata: {}, user_metadata: {}, created_at: '' } };
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
  if (location.port === '5175' && !sessionStorage.getItem('seeded')) { localStorage.setItem('sb-localhost-auth-token', ${JSON.stringify(JSON.stringify(sess))}); sessionStorage.setItem('seeded', '1'); }` });
await b.send('Page.navigate', { url: SITE + '/' }); await sleep(5500);
await b.ev(`document.getElementById('ageGateModal') && (document.getElementById('ageGateModal').style.display='none'); 1`);
const screens = await b.ev(`[...document.querySelectorAll('section.screen')].map((s) => s.id)`);
let visited = 0;
for (const L of ['es', 'en', 'de', 'fr']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(300);
  for (const sc of screens) {
    await b.ev(`showScreen('${sc}'); 1`); await sleep(120); visited++;
    if (L !== 'es') continue;
    const subs = await b.ev(`[...document.querySelectorAll('#${sc} .subview')].map((s) => s.id.replace('${sc}-', ''))`);
    for (const sub of subs || []) { await b.ev(`showSub('${sc}', '${sub}'); 1`); await sleep(80); visited++; }
  }
}
await sleep(1500);
const viol = await b.ev(`window.__csp`);
const errs = b.events.filter((e) => e.method === 'Runtime.exceptionThrown').map((e) => (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text).split('\n')[0]);
check(`${screens.length} pantallas y sus secciones, en los 4 idiomas (${visited} vistas): ninguna infracción de la CSP`, viol.length === 0, [...new Set(viol)].slice(0, 8).join(' | '));
check('…y ningún error de JavaScript', errs.length === 0, [...new Set(errs)].slice(0, 5).join(' | '));
check('el cambio de idioma sigue funcionando con la CSP (título en francés)', await b.ev(`document.documentElement.lang`) === 'fr');
check('los datos llegan de Supabase con la CSP (cuenta cargada)', await b.ev(`!!window.mvCurrentProfile && !!window.mvCurrentAccess`));

await b.close();

// ------------------------------------------------------------ install as an app
// index.html skips the service worker on "localhost" on purpose; 127.0.0.1 is
// also a secure origin, so it is used here to see the worker under the CSP.
const w = await browser(null, null, 390);
await w.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));` });
await w.send('Page.navigate', { url: 'http://127.0.0.1:5175/' }); await sleep(6000);
const man = await w.send('Page.getAppManifest');
check('instalación como app: el manifiesto se lee sin errores', !!man.result?.url && (man.result.errors || []).length === 0, JSON.stringify(man.result?.errors));
const sw = await w.ev(`navigator.serviceWorker.getRegistration().then((r) => !!(r && (r.active || r.installing || r.waiting)))`);
check('instalación como app: el service worker se registra con la CSP', sw === true);
await w.send('Page.reload'); await sleep(5000);
check('tras recargar, la página la controla el service worker y sin infracciones', await w.ev(`!!navigator.serviceWorker.controller`) && (await w.ev(`window.__csp.length`)) === 0, await w.ev(`JSON.stringify(window.__csp)`));
await w.close();

// ------------------------------------------------------------ panel
const p = await browser(null, null, 1200);
await p.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
  if (!sessionStorage.getItem('seeded')) { localStorage.setItem('sb-localhost-auth-token', ${JSON.stringify(JSON.stringify(sess))}); sessionStorage.setItem('seeded', '1'); }` });
await p.send('Page.navigate', { url: SITE + '/panel-mv.html' }); await sleep(4000);
let tabs = 0;
for (const t of ['summary', 'users', 'claims', 'gifts', 'audit']) { if (await p.ev(`(() => { const x = document.querySelector('#ptabs button[data-t=${t}]'); if (!x) return false; x.click(); return true; })()`)) tabs++; await sleep(900); }
for (const L of ['en', 'de', 'fr', 'es']) { await p.ev(`document.querySelector('#plang button[data-plang=${L}]')?.click(); 1`); await sleep(500); }
const pv = await p.ev(`window.__csp`);
const perr = p.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;
check(`panel (panel-mv.html): sus ${tabs} pestañas y los 4 idiomas sin infracciones ni errores`, tabs === 5 && pv.length === 0 && perr === 0, [...new Set(pv)].join(' | '));
await p.close();

// ------------------------------------------------------------ 404
const nf = await fetch(SITE + '/esto-no-existe');
const nfHtml = await nf.text();
check('404: una dirección que no existe responde 404 con la página propia', nf.status === 404 && /Esta página no existe/.test(nfHtml) && /href="\/"/.test(nfHtml));
check('404: lleva las mismas cabeceras de seguridad', /frame-ancestors/.test(nf.headers.get('content-security-policy') || '') && nf.headers.get('x-content-type-options') === 'nosniff');
const ok = [];
for (const u of ['/', '/index.html', '/panel-mv.html', '/manifest.webmanifest', '/service-worker.js', '/icons/icon-192.png',
  '/?type=signup', '/#access_token=x&type=recovery', '/?error=access_denied&error_code=otp_expired', '/?gift=ABC']) ok.push([(await fetch(SITE + u)).status, u]);
check('las rutas válidas y los enlaces de los correos (/, /?…, /#…, panel) NO dan 404', ok.every(([s]) => s === 200), JSON.stringify(ok.filter(([s]) => s !== 200)));
const q = await browser(null, null, 390);
for (const [L, re] of [['en', /This page doesn’t exist/], ['de', /Diese Seite gibt es nicht/], ['fr', /Cette page n’existe pas/], ['es', /Esta página no existe/]]) {
  await q.send('Page.navigate', { url: SITE + '/nada-' + L }); await sleep(900);
  await q.ev(`document.querySelector('.langs button[data-l=${L}]').click(); 1`); await sleep(200);
  check(`404 en ${L.toUpperCase()} con botón a Inicio`, re.test(await q.ev(`document.body.innerText`)) && await q.ev(`document.getElementById('home').getAttribute('href')`) === '/');
}
await q.send('Page.navigate', { url: SITE + '/otra-cosa' }); await sleep(800);
check('404: recuerda el idioma elegido (el mismo que usa la app)', /Esta página no existe/.test(await q.ev(`document.body.innerText`)));
await q.ev(`document.getElementById('home').click(); 1`); await sleep(3500);
check('404: «Ir a Inicio» abre la plataforma', await q.ev(`location.pathname`) === '/' && await q.ev(`!!document.getElementById('home') || !!document.querySelector('section.screen')`));
await q.close();

srv.kill();
summary();
process.exit(0);
