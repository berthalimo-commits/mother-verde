// Browser test: the exact amount is TEXT with 4 decimals (trailing zero kept),
// language decimal separator on screen, DOT when copied; texts in 4 languages,
// live and after reload; panel + CSV; dev preview shows a reserved amount.
import fs from 'fs';
import path from 'path';
import { check, sleep, sql, browser, summary, OUT } from './browser.mjs';
const ADMIN = 'b0000001-0000-4000-8000-000000000000', NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const LANGS = ['es', 'en', 'de', 'fr'];
const SHOWN = { es: '20,0040', en: '20.0040', de: '20,0040', fr: '20,0040' };
const WHY = {
  es: '¿Por qué el monto lleva decimales? Esos decimales son tu código personal: nos permiten reconocer que el pago es tuyo. Se suman una sola vez al total. Si no los envías exactos, tu aporte pasa a revisión manual y tarda más.',
  en: "Why does the amount have decimals? Those decimals are your personal code: they let us recognize that the payment is yours. They are added only once to the total. If you don't send them exactly, your contribution goes to manual review and takes longer.",
  de: 'Warum hat der Betrag Dezimalstellen? Diese Dezimalstellen sind dein persönlicher Code: Sie zeigen uns, dass die Zahlung von dir ist. Sie werden nur einmal zum Gesamtbetrag addiert. Wenn du sie nicht genau sendest, wird dein Beitrag manuell geprüft und dauert länger.',
  fr: "Pourquoi le montant comporte-t-il des décimales ? Ces décimales sont ton code personnel : elles nous permettent de reconnaître que le paiement est le tien. Elles s'ajoutent une seule fois au total. Si tu ne les envoies pas exactement, ta contribution passe en vérification manuelle et prend plus de temps.",
};
const PERFLOR = { es: '10 USDC por flor, más un código decimal único que verás al reservar.', en: '10 USDC per flower, plus a unique decimal code you’ll see when you reserve.', de: '10 USDC pro Blüte, plus ein einmaliger Dezimalcode, den du beim Reservieren siehst.', fr: '10 USDC par fleur, plus un code décimal unique que tu verras en réservant.' };
const lang = (b, L) => b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`).then(() => sleep(500));
const spyClipboard = `navigator.clipboard.writeText = async (t) => { window.__copied = t; }; 1`;

// ---------------------------------------------------------------- real account, real reservation
let b = await browser(NEWBIE, 'aal1', 390);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); showScreen('desbloquear'); 1`); await sleep(600);
for (const L of LANGS) { await lang(b, L); check(`antes de reservar · ${L.toUpperCase()}: «${PERFLOR[L]}»`, (await b.ev(`document.getElementById('dsPorFlor')?.innerText`)) === PERFLOR[L]); }
await lang(b, 'es');
await b.ev(`document.querySelector('.ds-slot[data-n="2"]').click(); 1`); await sleep(200);
await b.ev(`document.getElementById('dsReservarBtn').click(); 1`); await sleep(1500);
// force a code with a trailing zero (20.0040) to check it is never shown as 20.004
await sql(`update support_claims set amount_units = 20004000 where user_id = '${NEWBIE}' and status = 'awaiting_payment'`);
await b.send('Page.reload'); await sleep(6000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); showScreen('desbloquear'); ${spyClipboard}`); await sleep(800);
for (const L of LANGS) {
  await lang(b, L); await b.ev(spyClipboard);
  const x = await b.ev(`({ shown: document.getElementById('dsAmount')?.textContent, why: document.querySelector('.ds-why')?.innerText })`);
  await b.ev(`window.__copied = null; document.getElementById('dsCopyAmount').click(); 1`); await sleep(200);
  const copied = await b.ev(`window.__copied`);
  check(`Desbloquear · ${L.toUpperCase()} sin recargar: monto «${SHOWN[L]}» (4 decimales), copia «20.0040» con punto`, x.shown === SHOWN[L] && copied === '20.0040', JSON.stringify({ ...x, copied }).slice(0, 160));
  check(`Desbloquear · ${L.toUpperCase()}: «¿Por qué el monto lleva decimales?» exacto, bajo el paso 1`, x.why === WHY[L] && (await b.ev(`!!document.querySelector('.ds-steps li:first-child .ds-why')`)), x.why);
}
await lang(b, 'de');
await b.send('Page.reload'); await sleep(6000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; showScreen('desbloquear'); 1`); await sleep(800);
check('al recargar conserva DE y el monto sigue «20,0040»', (await b.ev(`document.documentElement.lang`)) === 'de' && (await b.ev(`document.getElementById('dsAmount')?.textContent`)) === '20,0040');
await b.shot('amount-desbloquear-de');
// send the TXID -> pending notice with the amount
await lang(b, 'es');
await b.ev(`document.getElementById('dsClaimTx').value = '0x' + 'ef'.repeat(32); document.getElementById('dsClaimForm').requestSubmit(); 1`); await sleep(2000);
for (const L of ['en', 'es']) { await lang(b, L); check(`aviso pendiente · ${L.toUpperCase()}: muestra «${SHOWN[L]} USDC»`, (await b.ev(`document.querySelector('.ds-claim-pending')?.innerText`))?.includes(`${SHOWN[L]} USDC`)); }
await b.close();

// ---------------------------------------------------------------- panel + CSV
const DL = path.join(OUT, 'downloads-amount'); fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
b = await browser(ADMIN, 'aal2', 1100);
await b.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
await b.send('Page.navigate', { url: 'http://localhost:5174/panel-mv.html' }); await b.waitFor(/Cuentas en total|Accounts in total|Konten|Comptes/, 15000);
await b.ev(`document.querySelector('[data-plang=es]').click(); 1`); await sleep(800);
await b.ev(`document.querySelector('#ptabs button[data-t=claims]').click(); 1`);
let t = await b.waitFor(/nueva@example\.org/, 15000);
check('panel ES: «20,0040 USDC»', /20,0040 USDC/.test(t));
await b.ev(`document.querySelector('[data-plang=en]').click(); 1`); await sleep(1500);
check('panel EN (sin recargar): «20.0040 USDC»', /20\.0040 USDC/.test(await b.ev(`document.body.innerText`)));
await b.ev(`document.querySelector('[data-export=claims]').click(); 1`);
let f = null; for (let i = 0; i < 20 && !f; i++) { await sleep(400); f = fs.readdirSync(DL).find((x) => x.includes('claims')); }
const csv = f ? fs.readFileSync(path.join(DL, f), 'utf8') : '';
check('CSV de avisos: «20.0040» con 4 decimales y punto', /,20\.0040,/.test(csv), csv.split('\r\n').slice(0, 3).join(' | '));
await b.ev(`document.querySelector('[data-plang=es]').click(); 1`);
await b.close();

// ---------------------------------------------------------------- dev preview
b = await browser(null, null, 390);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; (() => { const s = document.getElementById('mvDpState'); s.value = 'expired'; s.onchange(); const c = document.getElementById('mvDpClaim'); c.value = 'awaiting_payment'; c.onchange(); })(); showScreen('desbloquear'); ${spyClipboard}`); await sleep(800);
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(400); await b.ev(spyClipboard);
await b.ev(`document.getElementById('dsCopyAmount').click(); 1`); await sleep(200);
check('vista previa: monto ya reservado «20,0040» con su botón de copiar («20.0040»)', (await b.ev(`document.getElementById('dsAmount')?.textContent`)) === '20,0040' && (await b.ev(`window.__copied`)) === '20.0040');
await b.shot('amount-preview');
await b.close();
summary();
process.exit(0);
