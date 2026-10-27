// Browser test: changing the number of flowers AFTER «Ver mi monto».
// 20 flowers -> amount -> 3 flowers: the old instructions (amount, address,
// QR, steps, form) go away, «Ver mi monto» comes back next to the flowers with
// a note about the old amount; asking again gives the 3-flower amount and the
// database cancels the old reservation (only then: going back to 20 shows the
// same amount, nothing new is created). 4 languages, phone, dev preview.
import { check, sleep, sql, browser, summary } from './browser.mjs';
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const LANGS = ['es', 'en', 'de', 'fr'];
const BTN = { es: 'Ver mi monto', en: 'Show my amount', de: 'Meinen Betrag anzeigen', fr: 'Voir mon montant' };
const NOTE = {
  es: /^Tenías reservado 200,00\d\d USDC para 20 flores\. Si ya lo enviaste, vuelve a 20 flores para registrar el código de la transacción\. Si pides un monto nuevo, el anterior se anula\.$/,
  en: /^You had 200\.00\d\d USDC reserved for 20 flowers\. If you already sent it, go back to 20 flowers to register the transaction code\. If you ask for a new amount, the previous one is cancelled\.$/,
  de: /^Du hattest 200,00\d\d USDC für 20 Blüten reserviert\. Wenn du ihn schon gesendet hast, wähle wieder 20 Blüten, um den Transaktionscode einzutragen\. Wenn du einen neuen Betrag anforderst, wird der vorherige storniert\.$/,
  fr: /^Tu avais réservé 200,00\d\d USDC pour 20 fleurs\. Si tu l’as déjà envoyé, reviens à 20 fleurs pour enregistrer le code de la transaction\. Si tu demandes un nouveau montant, le précédent est annulé\.$/,
};
const lang = (b, L) => b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`).then(() => sleep(500));
const pick = (b, n) => b.ev(`document.querySelector('.ds-slot[data-n="${n}"]').click(); 1`).then(() => sleep(300));
const view = (b) => b.ev(`(() => {
  const btn = document.getElementById('dsReservarBtn'), garden = document.getElementById('dsGarden');
  return { btn: btn?.textContent || null, primary: !!btn?.classList.contains('btn-primary'),
    gap: btn ? Math.round(btn.getBoundingClientRect().top - garden.getBoundingClientRect().bottom) : null,
    amount: document.getElementById('dsAmount')?.textContent || null, qr: !!document.getElementById('dsQr'), steps: !!document.querySelector('.ds-steps'),
    form: !!document.getElementById('dsClaimForm'), note: document.getElementById('dsCambioNota')?.innerText || null,
    total: document.getElementById('dsTotal')?.innerText, overflow: document.documentElement.scrollWidth > innerWidth };
})()`);
const rows = () => sql(`select flowers, amount_units, status from support_claims where user_id = '${NEWBIE}' order by id`);

// ---------------------------------------------------------------- real account (fake Supabase), phone
await sql(`delete from support_claims where user_id = '${NEWBIE}'`);
let b = await browser(NEWBIE, 'aal1', 390);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); showScreen('desbloquear'); 1`); await sleep(600);
await pick(b, 20);
const gap0 = (await view(b)).gap;
await b.ev(`document.getElementById('dsReservarBtn').click(); 1`); await sleep(1500);
let v = await view(b);
const old = (await rows())[0];
check('20 flores -> «Ver mi monto»: monto 200,00xx con dirección, QR, pasos y formulario; una reserva guardada', /^200,00\d\d$/.test(v.amount) && v.qr && v.steps && v.form
  && old?.flowers === 20 && old.status === 'awaiting_payment', JSON.stringify({ v, old }));

await pick(b, 3);
v = await view(b);
check('cambio a 3: desaparecen el monto viejo, la dirección, el QR, los pasos y el formulario', !v.amount && !v.qr && !v.steps && !v.form, JSON.stringify(v));
check('…vuelve el botón «Ver mi monto» (principal) y ya no hay botón escondido «Cambiar a…»', v.btn === 'Ver mi monto' && v.primary && !(await b.ev(`document.body.innerText.includes('Cambiar a')`)));
check('…el botón está en el mismo lugar que la primera vez (no 2.000 px más abajo)', v.gap !== null && Math.abs(v.gap - gap0) < 200, v.gap + ' vs ' + gap0);
check('…el total dice 3 flores · 30 USDC y el aviso recuerda el monto viejo', /3 flores · 30 USDC/.test(v.total) && NOTE.es.test(v.note || ''), v.note);
check('solo tocar las flores no cambia nada en la base (la reserva de 20 sigue abierta)', JSON.stringify(await rows()) === JSON.stringify([old]));
for (const L of LANGS) {
  await lang(b, L);
  v = await view(b);
  check(`${L.toUpperCase()}: botón «${BTN[L]}» y aviso del monto anterior traducidos, sin desborde`, v.btn === BTN[L] && NOTE[L].test(v.note || '') && !v.overflow, JSON.stringify({ btn: v.btn, note: v.note }));
  if (L !== 'es') await b.shot(`flowers-change-${L}`);
}
await lang(b, 'es');
await b.shot('flowers-change-es');

await pick(b, 20);
v = await view(b);
check('volver a 20 sin pedir nada: reaparece el mismo monto, sin crear reservas', v.amount === amountOf(old) && v.form && (await rows()).length === 1, JSON.stringify(v));
await pick(b, 3);
await b.ev(`document.getElementById('dsReservarBtn').click(); 1`); await sleep(1500);
v = await view(b);
const after = await rows();
check(`pedir el monto con 3 flores -> monto nuevo de 3 flores (${v.amount}) con sus indicaciones`, /^30,00\d\d$/.test(v.amount) && v.qr && v.steps && v.form && !v.note, JSON.stringify(v));
check('en la base: la reserva de 20 queda «cancelada» y la de 3 «esperando pago» con ese monto', after.length === 2
  && after[0].flowers === 20 && after[0].status === 'canceled' && after[1].flowers === 3 && after[1].status === 'awaiting_payment' && amountOf(after[1]) === v.amount, JSON.stringify(after));
check('el panel de aportes ya no ve la de 20 como abierta', (await sql(`select count(*)::int as n from support_claims where user_id = '${NEWBIE}' and status in ('awaiting_payment','submitted','manual_review')`))[0].n === 1);
await b.send('Page.reload'); await sleep(6000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); showScreen('desbloquear'); 1`); await sleep(800);
v = await view(b);
check('al recargar: 3 flores y el monto nuevo', /3 flores/.test(v.total) && v.amount === amountOf(after[1]));
await b.close();

// ---------------------------------------------------------------- dev preview (simulated, no database)
b = await browser(null, null, 390);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; (() => { const s = document.getElementById('mvDpState'); s.value = 'expired'; s.onchange(); const c = document.getElementById('mvDpClaim'); c.value = ''; c.onchange(); })(); showScreen('desbloquear'); 1`); await sleep(600);
await pick(b, 20);
await b.ev(`document.getElementById('dsReservarBtn').click(); 1`); await sleep(800);
await pick(b, 3);
v = await view(b);
const okChange = v.btn === 'Ver mi monto' && !v.amount;
await b.ev(`document.getElementById('dsReservarBtn').click(); 1`); await sleep(800);
v = await view(b);
check('vista previa: el mismo comportamiento (20 -> 3 -> «Ver mi monto» -> 30,00xx)', okChange && /^30,00\d\d$/.test(v.amount), JSON.stringify(v));
await b.close();

function amountOf(r) { const s = String(r.amount_units).padStart(7, '0'); return `${s.slice(0, -6)},${s.slice(-6, -2)}`; }
summary();
