// Browser test: switching language LIVE on the new screens, and keeping it after a reload.
import { check, sleep, sql, mail, browser, summary, OUT } from './browser.mjs';
import fs from 'fs';

// Live language switching (no reload) + persistence after reload, on the new screens.
const ADMIN_ = 'b0000001-0000-4000-8000-000000000000', PAYER_ = 'b0000002-0000-4000-8000-000000000000', NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const LANGS = ['en', 'de', 'fr', 'es'];
const HELPERS = `
  window.__strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').split('{')[0].trim();
  window.__leaks = (L, rootSel) => {
    const txt = [...document.querySelectorAll(rootSel)].map((e) => e.innerText).join('\\n');
    const other = ['es', 'en', 'de', 'fr'].filter((x) => x !== L);
    const out = [];
    for (const k of Object.keys(translations.es).filter((k) => /^(acc|ds|gift|cuenta|subLoading|em|cmy(Err|Traduccion))/.test(k))) {
      const mine = __strip(translations[L][k]);
      for (const o of other) {
        const a = __strip(translations[o][k]);
        if (a.length >= 12 && a !== mine && txt.includes(a.slice(0, 40))) out.push(o + ':' + k);
      }
    }
    return [...new Set(out)];
  };
  window.__has = (L, key, rootSel) => [...document.querySelectorAll(rootSel)].map((e) => e.innerText).join('\\n').toLowerCase().includes(__strip(translations[L][key]).slice(0, 30).toLowerCase());
  1`;
async function open(uid, aal, url = 'http://localhost:5174/') {
  const b = await browser(uid, aal, 390);
  await b.send('Page.navigate', { url }); await sleep(5000);
  await b.ev(`document.getElementById('ageGateModal') && (document.getElementById('ageGateModal').style.display='none'); ${HELPERS}`);
  return b;
}
const click = (b, L) => b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`).then(() => sleep(500));
const ROOT = '.screen.active, #trialCountdown';
const results = {};
async function sweep(b, name, mustKey) {
  for (const L of LANGS) {
    await click(b, L);
    await b.ev(HELPERS);
    const leaks = await b.ev(`__leaks('${L}', '${ROOT}')`);
    const has = mustKey ? await b.ev(`__has('${L}', '${mustKey}', '${ROOT}')`) : true;
    const ok = leaks.length === 0 && has;
    (results[name] ||= []).push(ok);
    check(`${name} · ${L.toUpperCase()} sin recargar`, ok, `fugas: ${leaks.slice(0, 6).join(', ')}${has ? '' : ' · falta ' + mustKey}`);
  }
}

// 1) lock screen "Tu prueba gratis terminó" (real session, expired trial)
let b = await open(NEWBIE, 'aal1');
check('pantalla de bloqueo visible', await b.ev(`document.getElementById('acceso').classList.contains('active')`));
await sweep(b, 'Bloqueo (prueba terminada)', 'accTerminoH');
// 2) reload keeps the language
await click(b, 'de');
await b.send('Page.reload'); await sleep(5000);
await b.ev(`document.getElementById('ageGateModal') && (document.getElementById('ageGateModal').style.display='none'); ${HELPERS}`);
const after = await b.ev(`({ lang: document.documentElement.lang, btn: document.querySelector('#langSwitch button.lang-on')?.dataset.lang, leaks: __leaks('de', '${ROOT}'), has: __has('de', 'accTerminoH', '${ROOT}') })`);
check('al recargar conserva DE (html lang, botón marcado, textos)', after.lang === 'de' && after.btn === 'de' && after.leaks.length === 0 && after.has, JSON.stringify(after));
// 3) Desbloquear with a reserved amount
await click(b, 'es');
await b.ev(`showScreen('desbloquear'); 1`); await sleep(500);
await b.ev(`document.getElementById('dsReservarBtn')?.click(); 1`); await sleep(1500);
await sweep(b, 'Desbloquear (monto reservado)', 'dsEnviaExacto');
// 4) gift code form open in Cuenta, with a typed value
await click(b, 'es');
await b.ev(`showScreen('cuenta'); mvOpenGiftForm(); document.getElementById('giftCode').value = 'ABCD-EFGH-JKLM'; 1`); await sleep(400);
await sweep(b, 'Cuenta · código de regalo', 'giftLabel');
const kept = await b.ev(`({ open: !document.getElementById('giftForm').hidden, v: document.getElementById('giftCode').value })`);
check('el formulario del código sigue abierto y conserva lo escrito', kept.open && kept.v === 'ABCD-EFGH-JKLM', JSON.stringify(kept));
// 5) 24 h countdown strip (localhost preview of a running trial)
await b.ev(`mvAccessPreview('trial', 90); showScreen('home'); 1`); await sleep(500);
for (const L of LANGS) {
  await click(b, L);
  const ok = await b.ev(`document.getElementById('trialCountdownText').innerText.startsWith(__strip(translations['${L}'].accStripText).slice(0, 12))`);
  (results['Franja de prueba (24 h)'] ||= []).push(ok);
  check(`Franja de prueba · ${L.toUpperCase()} sin recargar`, ok);
}
await b.close();
// 6) lock screen with a pending contribution notice
b = await open(PAYER_, 'aal1');
await click(b, 'es');
await sweep(b, 'Bloqueo con aporte pendiente', 'dsPendingH');
await b.close();
// 7) admin panel: follows the app language and has its own switch
b = await browser(ADMIN_, 'aal2', 420);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(4000);
await b.ev(`document.querySelector('#langSwitch button[data-lang=fr]').click(); 1`); await sleep(300);
await b.send('Page.navigate', { url: 'http://localhost:5174/panel-mv.html' }); await sleep(4000);
const p1 = await b.ev(`({ lang: document.documentElement.lang, text: document.body.innerText.slice(0, 400) })`);
const PANEL = { es: 'Avisos de aporte', en: 'Contribution claims', de: 'Beitragsmeldungen', fr: 'Déclarations de contribution' };
check('panel abre en el idioma elegido en la app (FR)', p1.lang === 'fr' && p1.text.includes(PANEL.fr), p1.text.slice(0, 160));
for (const L of LANGS) {
  await b.ev(`document.querySelector('[data-plang=${L}]')?.click(); 1`); await sleep(1200);
  const t = await b.ev(`document.body.innerText`);
  const ok = t.includes(PANEL[L]) && Object.entries(PANEL).every(([k, v]) => k === L || !t.includes(v));
  (results['Panel de administración'] ||= []).push(ok);
  check(`Panel · ${L.toUpperCase()} sin recargar`, ok, t.slice(0, 160));
}
await b.send('Page.reload'); await sleep(4000);
check('panel: al recargar conserva el último idioma (ES)', (await b.ev(`document.body.innerText`)).includes(PANEL.es));
await b.close();

console.log('\nPor pantalla (EN, DE, FR, ES):');
for (const [k, v] of Object.entries(results)) console.log(`  ${k.padEnd(32)} ${v.map((x) => (x ? 'ok' : 'FALLA')).join(' ')}`);
summary();
process.exit(0);
