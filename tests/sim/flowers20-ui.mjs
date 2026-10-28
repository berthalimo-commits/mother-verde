// Browser test: Desbloquear with 1–20 flowers — layout (5×4 phone, 10×2 wide),
// 200.00xx reserved amount, "copy exact amount" and the exact-amount warning, 4 languages.
import { check, sleep, sql, browser, summary, OUT } from './browser.mjs';
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const L = { es: 'Envía exactamente este monto', en: 'Send exactly this amount', de: 'Sende genau diesen Betrag', fr: 'Envoie exactement ce montant' };
const COPY = { es: 'Copiar monto exacto', en: 'Copy exact amount', de: 'Genauen Betrag kopieren', fr: 'Copier le montant exact' };

for (const [w, cols, label] of [[390, 5, 'móvil'], [1280, 10, 'pantalla grande']]) {
  const b = await browser(NEWBIE, 'aal1', w);
  await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
  await b.ev(`document.getElementById('ageGateModal').style.display='none'; showScreen('desbloquear'); 1`);
  for (let i = 0; i < 20 && !(await b.ev(`!!document.getElementById('dsGarden')`)); i++) await sleep(300);
  const startOn = w === 390 ? 1 : 20; // the wide-screen pass reuses the 20-flower reservation made on the phone
  const g = await b.ev(`(() => { const el = document.getElementById('dsGarden'); return { slots: el.querySelectorAll('.ds-slot').length, cols: getComputedStyle(el).gridTemplateColumns.split(' ').length, on: el.querySelectorAll('.ds-slot.on').length }; })()`);
  check(`${label}: 20 lugares en ${cols} columnas × ${20 / cols} filas, ${startOn} elegido(s) al empezar`, g.slots === 20 && g.cols === cols && g.on === startOn, JSON.stringify(g));
  await b.ev(`document.querySelector('.ds-slot[data-n="20"]').click(); 1`); await sleep(300);
  const t = await b.ev(`({ on: document.querySelectorAll('.ds-slot.on').length, total: document.getElementById('dsTotal').innerText, mas: document.getElementById('dsMas').disabled })`);
  check(`${label}: tocar el lugar 20 -> 20 flores · 200 USDC, botón + desactivado`, t.on === 20 && /20/.test(t.total) && /200/.test(t.total) && t.mas === true, JSON.stringify(t));
  if (w === 390) {
    await b.ev(`document.getElementById('dsReservarBtn').click(); 1`); await sleep(1500);
  }
  const amt = await b.ev(`document.getElementById('dsAmount')?.textContent`);
  const db = await sql(`select amount_units from support_claims where user_id = '${NEWBIE}' and status = 'awaiting_payment'`);
  check(`${label}: monto reservado de 20 flores = 200,00xx, igual en pantalla y en la base (${amt})`, /^200,00\d\d$/.test(amt || '') && db.length === 1 && String(db[0].amount_units).replace(/^(\d+)(\d{4})00$/, '$1,$2') === amt, JSON.stringify(db));
  for (const lang of ['es', 'en', 'de', 'fr']) {
    await b.ev(`document.querySelector('#langSwitch button[data-lang=${lang}]').click(); 1`); await sleep(400);
    const x = await b.ev(`({ warn: document.querySelector('.ds-amount-warn')?.innerText || '', copy: document.getElementById('dsCopyAmount')?.innerText || '', amt: document.getElementById('dsAmount')?.textContent, over: document.documentElement.scrollWidth > innerWidth })`);
    check(`${label} · ${lang.toUpperCase()}: aviso de monto exacto + «${COPY[lang]}», sin desbordar`, x.warn.startsWith(L[lang]) && x.copy === COPY[lang] && x.amt === (lang === 'en' ? amt.replace(',', '.') : amt) && !x.over, JSON.stringify(x));
    if (lang === 'es' || lang === 'de') await b.shot(`flores20-${w}-${lang}`);
  }
  await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`);
  await b.close();
}
summary();
process.exit(0);
