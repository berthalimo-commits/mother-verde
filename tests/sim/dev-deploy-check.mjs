// Opens the DEPLOYED dev version (Vercel) as a visitor — no sign-in, no
// account — and checks what's there. Records every request: there must be no
// write to Supabase (production database shared with dev).
// Usage: node dev-deploy-check.mjs <share-url>
import { check, sleep, browser, summary, OUT } from './browser.mjs';
const share = process.argv[2];
const base = new URL(share).origin;
const b = await browser(null, null, 390);
await b.send('Network.enable');
await b.send('Page.navigate', { url: share }); await sleep(6000);
await b.send('Runtime.enable');
await b.send('Page.navigate', { url: base + '/' });
for (let i = 0; i < 160 && !(await b.ev('document.documentElement.dataset.access')); i++) await sleep(500);
const jsErrors = b.events.filter((e) => e.method === 'Runtime.exceptionThrown').map((e) => (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text || '').split('\n')[0]);
const logs = b.events.filter((e) => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error').map((e) => e.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 160));
console.log('errores JS:', JSON.stringify(jsErrors), '| console.error:', JSON.stringify(logs));
for (let i = 0; i < 20 && !(await b.ev(`!!document.getElementById('mvDevPreview')`)); i++) await sleep(500);
const info = await b.ev(`({ flag: document.documentElement.dataset.mvPreview, sel: !!document.getElementById('mvDevPreview'), access: document.documentElement.dataset.access, screen: document.querySelector('.screen.active')?.id })`);
check('build de dev: flag de vista previa y selector presentes', info.flag === '1' && info.sel, JSON.stringify(info));
await b.ev(`document.getElementById('ageGateModal').style.display='none'; 1`);
check('visitante -> pantalla de entrada (acceso)', info.screen === 'acceso' && info.access === 'visitor', JSON.stringify(info));
const h = async () => b.ev(`document.querySelector('#acceso .acc-text')?.innerText.slice(0, 40)`);
const heads = {};
for (const L of ['en', 'de', 'fr', 'es']) { await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500); heads[L] = await h(); }
check('cambio de idioma con la pantalla abierta (título en cada idioma)', new Set(Object.values(heads)).size >= 2 && heads.es.startsWith('Una enciclopedia'), JSON.stringify(heads));
await b.ev(`document.querySelector('#langSwitch button[data-lang=de]').click(); 1`); await sleep(300);
await b.send('Page.reload'); for (let i = 0; i < 160 && !(await b.ev('document.documentElement.dataset.access')); i++) await sleep(500);
check('al recargar conserva el idioma (DE)', (await b.ev(`document.documentElement.lang`)) === 'de');
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(400);
await b.ev(`(() => { const s = document.getElementById('mvDpState'); s.value = 'expired'; s.onchange(); return 1; })()`); await sleep(500);
await b.shot('dev-acceso-expired');
await b.ev(`showScreen('desbloquear'); 1`); await sleep(800);
const g = await b.ev(`({ slots: document.querySelectorAll('.ds-slot').length, cols: getComputedStyle(document.getElementById('dsGarden')).gridTemplateColumns.split(' ').length })`);
check('Desbloquear: 20 lugares, 5 columnas en móvil', g.slots === 20 && g.cols === 5, JSON.stringify(g));
await b.ev(`document.querySelector('.ds-slot[data-n="20"]').click(); 1`); await sleep(300);
await b.ev(`document.getElementById('dsReservarBtn').click(); 1`); await sleep(800);
const amt = await b.ev(`document.getElementById('dsAmount')?.textContent`);
const warn = await b.ev(`document.querySelector('.ds-amount-warn')?.innerText`);
check(`vista previa: monto de ejemplo para 20 flores (${amt}) + aviso de monto exacto`, /^200\.00\d\d$/.test(amt || '') && /Envía exactamente este monto/.test(warn || ''));
await b.shot('dev-desbloquear-20');
await b.send('Page.navigate', { url: base + '/panel-mv.html?demo=1' }); await sleep(5000);
check('panel de ejemplo con datos de ejemplo', /VISTA PREVIA con datos de ejemplo/.test(await b.ev(`document.body.innerText`)));
await b.shot('dev-panel-demo');
await b.send('Page.navigate', { url: base + '/panel-mv.html' }); await sleep(5000);
check('panel real sin sesión -> «Inicia sesión…» (no se puede usar)', /Inicia sesión|Sign in|Melde dich|Connecte-toi/.test(await b.ev(`document.body.innerText`)));
const reqs = b.events.filter((e) => e.method === 'Network.requestWillBeSent').map((e) => e.params.request);
const supa = reqs.filter((r) => r.url.includes('supabase.co'));
const writes = supa.filter((r) => !['GET', 'HEAD', 'OPTIONS'].includes(r.method));
console.log('peticiones a Supabase (producción):', supa.length, '→', [...new Set(supa.map((r) => r.method + ' ' + new URL(r.url).pathname))].join(' | '));
check('0 escrituras en la base de datos de producción', writes.length === 0, writes.map((r) => r.method + ' ' + r.url).join(', '));
await b.close();
summary();
process.exit(0);
