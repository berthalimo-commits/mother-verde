// Browser test — live access (A1.6) and the server clock (A1.5), against
// fakeserver.mjs. No page reload anywhere: a marker on window must survive.
import { check, sleep, sql, browser, summary, ADMIN, PAYER } from './browser.mjs';

const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const open = async (b) => { await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500); await b.ev(`document.getElementById('ageGateModal').style.display='none'; window.__noReload = 1; 1`); };
const st = (b) => b.ev(`({ access: document.documentElement.dataset.access, screen: document.querySelector('.screen.active')?.id, same: window.__noReload === 1 })`);
const accessCalls = (b) => b.ev(`performance.getEntriesByType('resource').filter((r) => /rpc\\/my_access/.test(r.name)).length`);
// Simulate "the person comes back to this tab".
const comeBack = (b) => b.ev(`(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); return 1; })()`);
const hide = (b) => b.ev(`(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); return 1; })()`);

// 1) activation while the lock screen is open: noticed within 60 s, no reload
let b = await browser(PAYER, 'aal1', 420);
await open(b);
let s = await st(b);
check('aportante con la prueba vencida: pantalla de bloqueo', s.access === 'expired' && s.screen === 'acceso', JSON.stringify(s));
const calls0 = await accessCalls(b);
await sql(`update profiles set subscription_status = 'supporter' where id = '${PAYER}'`);  // the admin activates it
let t0 = Date.now(), seen = null;
while (Date.now() - t0 < 75000) { await sleep(2000); s = await st(b); if (s.access === 'supporter') { seen = Date.now() - t0; break; } }
check('se activa el aporte -> la app abierta lo ve sola en ≤ 60 s (sin recargar) y sale del bloqueo', s.access === 'supporter' && s.screen === 'home' && s.same === true && seen !== null && seen <= 62000, JSON.stringify({ s, seen }));
const callsInMinute = (await accessCalls(b)) - calls0;
check('en ese minuto, 1 o 2 consultas de acceso como mucho (límite de peticiones)', callsInMinute >= 1 && callsInMinute <= 2, String(callsInMinute));
await b.close();

// 2) revocation: noticed when coming back to the tab
b = await browser(ADMIN, 'aal1', 420);
await open(b);
s = await st(b);
check('cuenta con acceso completo, en Inicio', s.access === 'supporter', JSON.stringify(s));
await hide(b);
await sql(`update profiles set subscription_status = 'revoked' where id = '${ADMIN}'`);
await sleep(31000); // past the 30 s minimum gap
const callsHidden = await accessCalls(b);
await sleep(2000);
check('con la pestaña oculta no consulta nada', (await accessCalls(b)) === callsHidden);
await comeBack(b); await sleep(2500);
s = await st(b);
check('se revoca el acceso -> al volver a la pestaña la app lo ve (sin recargar) y bloquea', s.access === 'revoked' && s.screen === 'acceso' && s.same === true, JSON.stringify(s));
const c1 = await accessCalls(b);
await comeBack(b); await comeBack(b); await comeBack(b); await sleep(1500);
check('volver a la pestaña varias veces seguidas no repite la consulta (mínimo 30 s)', (await accessCalls(b)) === c1);
await sql(`update profiles set subscription_status = 'supporter' where id = '${ADMIN}'`);
await b.close();

// 3) a network blip during a live check never locks anyone
b = await browser(ADMIN, 'aal1', 420);
await open(b);
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*my_access*', '*support_claims*'] });
await b.ev(`window.mvRefreshAccessLive(); 1`); await sleep(2000);
s = await st(b);
check('si falla la consulta en vivo, se queda con la última respuesta (no bloquea a quien tiene acceso)', s.access === 'supporter' && s.screen !== 'acceso', JSON.stringify(s));
await b.send('Network.setBlockedURLs', { urls: [] });
await b.close();

// 4) the device clock is 3 days ahead: the server clock decides
await sql(`update profiles set subscription_status = 'trialing', trial_started_at = now(), trial_ends_at = now() + interval '20 hours' where id = '${NEWBIE}'`);
b = await browser(NEWBIE, 'aal1', 420);
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const real = Date.now.bind(Date); const shift = 3 * 86400000; Date.now = () => real() + shift; })();` });
await open(b);
s = await st(b);
const left = await b.ev(`document.getElementById('accStrip')?.innerText || document.body.innerText.match(/te quedan[^.]*/i)?.[0] || ''`);
check('reloj del teléfono 3 días adelantado: sigue la prueba de 24 h (manda la hora del servidor)', s.access === 'trial', JSON.stringify(s));
check('…y la cuenta atrás sigue en horas, no en 0', !/menos de 1 minuto/i.test(left), left);
await b.close();
summary();
