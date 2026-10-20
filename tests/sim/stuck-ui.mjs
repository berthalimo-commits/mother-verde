// Browser test — «Cargando…» never stays forever (A2.1). Requests to the
// (fake) Supabase are held open (a hang) or blocked (a failure) with the
// DevTools protocol, and the app and the panel must offer a way out:
// «Reintentar», «Cerrar sesión» and hello@motherverdeny.com — at once when a
// load fails, after 12 s when it hangs — in the 4 languages.
import { check, sleep, browser, summary, ADMIN, PAYER } from './browser.mjs';

const open = async (b, url = 'http://localhost:5174/') => {
  await b.send('Page.navigate', { url }); await sleep(4500);
  await b.ev(`document.getElementById('ageGateModal') && (document.getElementById('ageGateModal').style.display='none'); document.getElementById('mvDevPreview')?.remove(); 1`);
};
const hang = async (b, pattern) => { await b.send('Fetch.enable', { patterns: [{ urlPattern: pattern, requestStage: 'Request' }] }); };
const stuckShown = (b, where = '#accesoContent') => b.ev(`(() => { const s = document.querySelector('${where} .mv-stuck'); if (!s) return null;
  return { retry: !!s.querySelector('#mvStuckRetry'), out: !!s.querySelector('#mvStuckOut'), mail: !!s.querySelector('a[href="mailto:hello@motherverdeny.com"]'), text: s.innerText }; })()`);

// ------------------------------------------------------------ app: profile request hangs
let b = await browser(PAYER, 'aal1', 390);
await hang(b, '*rest/v1/profiles*');
await open(b);
const early = await b.ev(`document.querySelector('.screen.active')?.id + ' | ' + document.getElementById('accesoContent')?.innerText`);
check('perfil colgado: al principio «Cargando el estado de tu cuenta…» (sin acceso mientras tanto)', /^acceso \| Cargando el estado de tu cuenta/.test(early), early);
await sleep(11500); // the 12 s start when the session load starts (1–2 s after the page opens)
let s = await stuckShown(b);
check('…a los 12 s: «No pudimos cargar tu cuenta» con Reintentar, Cerrar sesión y hello@', !!s && s.retry && s.out && s.mail && /No pudimos cargar tu cuenta/.test(s.text), JSON.stringify(s));
for (const [L, re] of [['en', /We couldn’t load your account/], ['de', /Wir konnten dein Konto nicht laden/], ['fr', /Nous n’avons pas pu charger ton compte/], ['es', /No pudimos cargar tu cuenta/]]) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(400);
  const txt = await b.ev(`document.querySelector('#accesoContent .mv-stuck')?.innerText || ''`);
  check(`mensaje en ${L.toUpperCase()}`, re.test(txt), txt);
}
await b.send('Fetch.disable');
await b.ev(`document.getElementById('mvStuckRetry').click(); 1`); await sleep(3500);
check('«Reintentar» (con la conexión de vuelta) carga la cuenta y quita el mensaje', !(await stuckShown(b)) && await b.ev(`!!window.mvCurrentProfile && !!window.mvCurrentAccess`));
await b.close();

// ------------------------------------------------------------ app: access request fails
b = await browser(PAYER, 'aal1', 390);
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*rpc/my_access*'] });
await open(b);
s = await stuckShown(b);
check('acceso que falla (no cuelga): el mensaje sale enseguida, sin esperar 12 s', !!s && s.retry && s.out && s.mail, JSON.stringify(s));
await b.ev(`showScreen('cuenta'); 1`); await sleep(500);
const cuenta = await b.ev(`document.querySelector('#cuentaAccesoTexto .mv-stuck') ? 'stuck' : document.getElementById('cuentaAccesoTexto')?.innerText`);
check('Cuenta → «Tu acceso» muestra la misma salida en vez de «Cargando…»', cuenta === 'stuck', cuenta);
await b.ev(`document.querySelector('#cuentaAccesoTexto #mvStuckOut').click(); 1`); await sleep(4500);
check('«Cerrar sesión» funciona aunque el servidor no responda (sesión borrada en este dispositivo)', await b.ev(`!window.mvCurrentUser && !Object.keys(localStorage).some((k) => /auth-token/.test(k) && localStorage.getItem(k))`));
await b.close();

// ------------------------------------------------------------ panel
b = await browser(ADMIN, 'aal2', 1200);
await hang(b, '*rpc/admin_whoami*');
await b.send('Page.navigate', { url: 'http://localhost:5174/panel-mv.html' }); await sleep(13500);
let p = await b.ev(`(() => { const s = document.querySelector('#app #mvStuck'); return s ? { retry: !!s.querySelector('#stRetry'), out: !!s.querySelector('#stOut'), mail: !!s.querySelector('a[href^="mailto:hello@"]') } : document.getElementById('app').innerText; })()`);
check('panel: comprobación de administradora colgada -> a los 12 s salida con Reintentar, Cerrar sesión y hello@', p && p.retry && p.out && p.mail, JSON.stringify(p));
await b.send('Fetch.disable');
await b.ev(`document.getElementById('stRetry').click(); 1`); await sleep(3000);
check('panel: «Reintentar» entra al panel', await b.ev(`!!document.getElementById('ptabs') && !document.getElementById('mvStuck')`));
await hang(b, '*rpc/admin_list_users*');
await b.ev(`document.querySelector('#ptabs button[data-t=users]').click(); 1`); await sleep(13000);
p = await b.ev(`!!document.querySelector('#usList #mvStuck')`);
check('panel: lista de cuentas colgada -> a los 12 s la salida aparece en su recuadro', p);
const adminSrc = (await import('fs')).readFileSync(new URL('../../src/admin.js', import.meta.url), 'utf8');
check('panel: textos de la salida en los 4 idiomas', [/couldn’t load this part/, /konnte nicht geladen werden/, /Impossible de charger/, /No pudimos cargar esta parte/].every((re) => re.test(adminSrc)));
await b.send('Fetch.disable');
await b.ev(`document.querySelector('#ptabs button[data-t=users]').click(); 1`); await sleep(2500);
check('panel: con la conexión de vuelta la lista carga', await b.ev(`!!document.querySelector('#usList table') && !document.querySelector('#usList #mvStuck')`));
await b.close();
summary();
