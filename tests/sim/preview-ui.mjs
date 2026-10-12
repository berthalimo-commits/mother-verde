// Browser test of the DEV PREVIEW (state selector + sample panel) on the local
// dev server (preview flag on). Records every network request: in preview,
// nothing may be written to the database (no POST/PATCH/DELETE to Supabase
// except the read-only ones the app does as a visitor).
import { check, sleep, browser, summary, OUT } from './browser.mjs';

const writes = (b) => b.events.filter((e) => e.method === 'Network.requestWillBeSent')
  .map((e) => e.params.request)
  .filter((r) => r.url.includes(':54321') && !['GET', 'HEAD', 'OPTIONS'].includes(r.method))
  .map((r) => `${r.method} ${new URL(r.url).pathname}`);

let b = await browser(null, null, 420);
await b.send('Network.enable');
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; 1`);
check('selector de vista previa visible en el servidor de desarrollo', await b.ev(`!!document.getElementById('mvDevPreview')`));
const setState = async (st, cl = '') => { await b.ev(`(() => { const s = document.getElementById('mvDpState'); s.value = '${st}'; s.onchange(); const c = document.getElementById('mvDpClaim'); c.value = '${cl}'; c.onchange(); return 1; })()`); await sleep(500); };
const screenText = () => b.ev(`document.querySelector('.screen.active').innerText`);

await setState('expired');
check('«Prueba terminada» -> pantalla de bloqueo', /Tu prueba gratis terminó/.test(await screenText()));
await b.shot('preview-expired');
await setState('expired', 'submitted');
check('«Prueba terminada» + «TXID enviado» -> aviso «lo estamos verificando»', /verificando/.test(await screenText()));
await setState('expired', '');
await b.ev(`showScreen('desbloquear'); 1`); await sleep(500);
await b.ev(`document.querySelector('.ds-slot[data-n="3"]').click(); 1`); await sleep(300);
await b.ev(`document.getElementById('dsReservarBtn').click(); 1`); await sleep(800);
const amt = await b.ev(`document.getElementById('dsAmount')?.textContent`);
check(`Desbloquear: «Ver mi monto» con 3 flores -> monto de ejemplo ${amt} (simulado)`, /^30\.00\d\d$/.test(amt || ''));
await b.ev(`document.getElementById('dsClaimTx').value = '0x' + 'ab'.repeat(32); document.getElementById('dsClaimForm').requestSubmit(); 1`); await sleep(800);
check('enviar TXID (simulado) -> «lo estamos verificando»', /verificando/.test(await screenText()));
await b.shot('preview-desbloquear');
await setState('expired', '');
await b.ev(`showScreen('cuenta'); 1`); await sleep(300);
await b.ev(`(() => { const w = document.getElementById('cuentaLoggedInOnly'); w.style.display = ''; mvOpenGiftForm(); document.getElementById('giftCode').value = 'ABCD-EFGH-JKLM'; document.getElementById('giftForm').requestSubmit(); return 1; })()`); await sleep(500);
check('código de regalo (simulado) -> «¡Listo! … hasta …»', /Listo/.test(await screenText()));
await setState('granted');
check('«Acceso por regalo» -> sin bloqueo', (await b.ev(`document.documentElement.dataset.access`)) === 'granted' && !(await b.ev(`document.documentElement.classList.contains('mv-locked')`)));
await setState('revoked'); await b.ev(`showScreen('home'); 1`); await sleep(400);
check('«Acceso retirado» -> pantalla «Esta cuenta no tiene acceso»', /no tiene acceso/.test(await screenText()));
const w1 = writes(b);
check('en toda la vista previa de la app: 0 escrituras en la base de datos', w1.length === 0, w1.join(', '));
await b.close();

// sample panel
b = await browser(null, null, 420);
await b.send('Network.enable');
await b.send('Page.navigate', { url: 'http://localhost:5174/panel-mv.html?demo=1' }); await sleep(3500);
await b.ev(`document.querySelector('#ptabs button[data-t=claims]').click(); 1`); await sleep(800);
let t = await b.ev(`document.body.innerText`);
check('panel de ejemplo: aviso «VISTA PREVIA con datos de ejemplo» y avisos de aporte de ejemplo', /VISTA PREVIA con datos de ejemplo/.test(t) && /ana\.ejemplo@example\.com/.test(t) && /monto_distinto/.test(t), t.slice(0, 300));
await b.ev(`document.querySelector('button[data-act=approve]').click(); 1`); await sleep(800);
t = await b.ev(`document.body.innerText`);
check('«Activar acceso completo» en el ejemplo -> «Vista previa: no se guarda nada»', /no se guarda nada/.test(t));
await b.ev(`document.querySelector('#ptabs button[data-t=gifts]').click(); 1`); await sleep(600);
check('pestaña Códigos de regalo con estados de ejemplo', /anulado/.test(await b.ev(`document.body.innerText`)));
await b.ev(`document.querySelector('#ptabs button[data-t=audit]').click(); 1`); await sleep(600);
check('pestaña Registro de ejemplo', /claim_approved/.test(await b.ev(`document.body.innerText`)));
await b.shot('preview-panel');
const reqs = b.events.filter((e) => e.method === 'Network.requestWillBeSent').map((e) => e.params.request.url).filter((u) => u.includes(':54321'));
check('panel de ejemplo: 0 peticiones a la base de datos', reqs.length === 0, reqs.join(', '));
await b.close();
summary();
process.exit(0);
