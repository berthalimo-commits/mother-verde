// Browser test — one activation deadline (approved 15-10-2026): normal check
// says "hasta 24 horas"; manual review (late payment, conflict, different
// amount…) shows NO number of hours; never two deadlines at once. 4 languages.
// Uses the dev preview states (no database writes).
import fs from 'fs';
import { check, sleep, browser, summary } from './browser.mjs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const cfg = fs.readFileSync(APP + '/src/supportConfig.js', 'utf8');
check('NORMAL_REVIEW_HOURS = 24 y ya no existe VERIFY_MAX_HOURS', /NORMAL_REVIEW_HOURS: 24,/.test(cfg) && !/VERIFY_MAX_HOURS/.test(cfg + fs.readFileSync(APP + '/src/desbloquear.js', 'utf8') + fs.readFileSync(APP + '/public/main.js', 'utf8')));

const HOURS = /\b\d+\s*(horas|hours|Stunden|heures)\b/gi;
const UPTO = { es: /hasta 24 horas/, en: /up to 24 hours/, de: /bis zu 24 Stunden/, fr: /jusqu’à 24 heures/ };
const MANUAL = { es: /revisaremos manualmente y te escribiremos/, en: /review it manually and write to you/, de: /manuell und schreiben dir/, fr: /vérifierons manuellement et nous t’écrirons/ };
const b = await browser(null, null, 420);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); 1`);
const box = (sel) => b.ev(`document.querySelector('${sel}')?.innerText || ''`);
for (const L of ['es', 'en', 'de', 'fr']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(400);
  // normal check
  await b.ev(`mvAccessPreview('expired'); mvClaimPreview('submitted'); showScreen('desbloquear'); 1`); await sleep(500);
  let t = await box('#desbloquear .ds-claim-pending');
  check(`${L}: revisión normal -> «hasta 24 horas», un solo plazo`, UPTO[L].test(t) && (t.match(HOURS) || []).length === 1 && !MANUAL[L].test(t), t);
  await b.ev(`showScreen('acceso'); 1`); await sleep(400);
  t = await box('#acceso .acc-pending');
  check(`${L}: pantalla de bloqueo, mismo texto`, UPTO[L].test(t) && (t.match(HOURS) || []).length === 1, t);
  // manual review
  await b.ev(`mvClaimPreview('manual_review'); showScreen('desbloquear'); 1`); await sleep(500);
  t = await box('#desbloquear .ds-claim-pending');
  check(`${L}: revisión manual -> sin horas, solo «lo revisaremos manualmente…»`, MANUAL[L].test(t) && !HOURS.test(t), t);
  HOURS.lastIndex = 0;
  await b.ev(`showScreen('acceso'); 1`); await sleep(400);
  t = await box('#acceso .acc-pending');
  check(`${L}: pantalla de bloqueo en revisión manual -> sin horas`, MANUAL[L].test(t) && !(t.match(HOURS) || []).length, t);
  // late payment (manual review, own text): still no hours, one line
  await b.ev(`window.mvLatestClaim = { ...window.mvLatestClaim, late: true }; showScreen('desbloquear'); 1`); await sleep(500);
  t = await box('#desbloquear');
  const pend = await box('#desbloquear .ds-claim-pending');
  check(`${L}: pago tardío -> un solo mensaje, sin horas`, !(pend.match(HOURS) || []).length && !MANUAL[L].test(pend) && (t.match(/(\d+)\s*(horas|hours|Stunden|heures)/gi) || []).filter((x) => !/^24/.test(x)).length === 0, pend);
}
await b.close();
summary();
