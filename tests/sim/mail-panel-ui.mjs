// Browser test of the panel's e-mail signal: "Correos fallidos en las
// últimas 24 h" above every tab and in Resumen, and the list of sends in
// Registro (4 languages). Needs a fresh fakeserver.mjs and Vite on 5174.
import { check, sleep, sql, browser, summary } from './browser.mjs';
const ADMIN = 'b0000001-0000-4000-8000-000000000000';
const PANEL = 'http://localhost:5174/panel-mv.html';

let b = await browser(ADMIN, 'aal2', 1200);
await b.send('Page.navigate', { url: PANEL });
let t = await b.waitFor(/Cuentas en total/);
check('sin fallos: no hay aviso arriba y Resumen muestra 0', !(await b.ev(`!!document.getElementById('mailAlertCard')`)) && /Correos fallidos en las últimas 24 h\s*0/.test(t), t.slice(0, 300));

// one failed send (with an address inside the error) and one that went out, as the functions would log them
await sql(`select svc_mail_event('gift_code', false, 'smtp,resend', 4, 'smtp#1: 550 <alguien@example.org> mailbox unavailable', null, 'gift:99')`);
await sql(`select svc_mail_event('activation', true, 'resend', 3, 'smtp#1: 421 later', '${ADMIN}', 'claim:7')`);
await sql(`insert into mail_events (at, kind, ok, provider, attempts) values (now() - interval '25 hours', 'test', false, 'smtp', 2)`);
await b.send('Page.navigate', { url: PANEL });
t = await b.waitFor(/Correos fallidos en las últimas 24 h: 1/);
check('1 fallo en 24 h (el de hace 25 h no cuenta) -> aviso rojo arriba «… 24 h: 1. Míralos en Registro.»', /Correos fallidos en las últimas 24 h: 1\. Míralos en Registro\./.test(t) && await b.ev(`document.getElementById('mailAlertCard').classList.contains('bad')`), t.slice(0, 300));
check('…y en Resumen, en rojo', await b.ev(`document.querySelector('#sumMailFailed .big').textContent.trim() === '1' && document.querySelector('#sumMailFailed .big').classList.contains('bad')`));
await b.ev(`document.querySelector('#ptabs button[data-t=users]').click(); 1`); await sleep(800);
check('…el aviso sigue arriba en las otras pestañas', await b.ev(`!!document.getElementById('mailAlertCard')`));
await b.ev(`document.querySelector('#ptabs button[data-t=audit]').click(); 1`);
t = await b.waitFor(/Envíos de correo/);
const rows = await b.ev(`[...document.querySelectorAll('#mailList tr')].slice(1).map((r) => r.innerText.replace(/\\s+/g, ' '))`);
check('Registro: lista de envíos con tipo, resultado, salida, intentos y error', rows.some((r) => /Código de regalo FALLÓ smtp,resend 4/.test(r)) && rows.some((r) => /Activación enviado resend 3 hello@motherverdeny\.com/.test(r)), JSON.stringify(rows));
check('…la dirección que venía en el error no se guardó (sale <correo>)', !/alguien@example\.org/.test(t) && /<correo>/.test(t));
await b.shot('mail-panel-registro');
for (const [L, re] of [['en', /Failed e-mails in the last 24 h: 1\. See them in Log\./], ['de', /Fehlgeschlagene E-Mails in den letzten 24 h: 1\./], ['fr', /E-mails en échec au cours des dernières 24 h : 1\./]]) {
  await b.ev(`localStorage.setItem('mv-lang', '${L}'); 1`);
  await b.send('Page.navigate', { url: PANEL });
  check(`aviso en ${L}`, re.test(await b.waitFor(re)));
}
await b.ev(`localStorage.setItem('mv-lang', 'es'); 1`);
await b.close();
summary();
process.exit(0);
