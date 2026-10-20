// Browser test: app contact fields + crypto-help line; panel Summary, Users,
// user file, e-mail buttons, CSV export (real downloaded file), languages.
// Against the fake Supabase (fakeserver.mjs) — start it fresh before this test.
import fs from 'fs';
import path from 'path';
import { check, sleep, sql, browser, summary, OUT } from './browser.mjs';
const ADMIN = 'b0000001-0000-4000-8000-000000000000', PAYER = 'b0000002-0000-4000-8000-000000000000', NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const DL = path.join(OUT, 'downloads');
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });

// test data: an accented name, a formula-looking name, a redeemed gift code
await sql(`insert into community_members (user_id, display_name, country) values ('${NEWBIE}', 'José Núñez', 'PE'), ('${PAYER}', '=HYPERLINK("http://malo.example","clic")', 'US')`);
await sql(`insert into gift_codes (code_hash, days, expires_at, created_label, status, used_by, used_at) values (encode(sha256('prueba'::bytea), 'hex'), 7, now() + interval '7 days', 'sql-editor', 'used', '${PAYER}', now())`);
await sql(`update profiles set subscription_status = 'supporter' where id = '${PAYER}'`);

// ---------------------------------------------------------------- app
let b = await browser(NEWBIE, 'aal1', 390);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); showScreen('desbloquear'); 1`); await sleep(600);
const HELP = { es: '¿Tienes dificultades con el pago en cripto? Escríbenos a hello@motherverdeny.com', en: 'Having trouble paying with crypto? Write to us at hello@motherverdeny.com', de: 'Schwierigkeiten bei der Zahlung mit Krypto? Schreibe uns an hello@motherverdeny.com', fr: 'Des difficultés pour payer en crypto ? Écris-nous à hello@motherverdeny.com' };
for (const L of ['en', 'de', 'fr', 'es']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(400);
  const h = await b.ev(`({ t: document.querySelector('.ds-help p')?.innerText, href: document.querySelector('.ds-help a')?.getAttribute('href') })`);
  check(`Desbloquear · ${L.toUpperCase()}: línea «dificultades con el pago en cripto» con enlace mailto`, h.t === HELP[L] && h.href === 'mailto:hello@motherverdeny.com?subject=Mother%20Verde', JSON.stringify(h));
}
await b.ev(`document.querySelector('.ds-slot[data-n="2"]').click(); 1`); await sleep(200);
await b.ev(`document.getElementById('dsReservarBtn').click(); 1`); await sleep(1500);
const NOTE = 'Solo para ayudarte con tu aporte si hace falta. Únicamente lo verá quien administra Mother Verde.';
check('formulario: «Nombre (opcional)», «WhatsApp o teléfono (opcional)» y la nota', await b.ev(`document.querySelector('label[for=dsContactName]').textContent === 'Nombre (opcional)' && document.querySelector('label[for=dsContactPhone]').textContent === 'WhatsApp o teléfono (opcional)' && document.body.innerText.includes(${JSON.stringify(NOTE)})`));
await b.ev(`document.getElementById('dsClaimTx').value = '0x' + 'cd'.repeat(32); document.getElementById('dsContactPhone').value = 'llámame'; document.getElementById('dsClaimForm').requestSubmit(); 1`); await sleep(500);
check('teléfono inválido -> aviso, no se envía', /Revisa el teléfono/.test(await b.ev(`document.getElementById('dsClaimMsg').innerText`)));
await b.ev(`document.getElementById('dsContactName').value = 'María López'; document.getElementById('dsContactPhone').value = '+51 987 654 321'; document.getElementById('dsClaimForm').requestSubmit(); 1`); await sleep(2000);
const row = (await sql(`select contact_name, contact_phone, status from support_claims where user_id = '${NEWBIE}' and status = 'submitted'`))[0];
check('aviso enviado con nombre y teléfono guardados', row?.contact_name === 'María López' && row.contact_phone === '+51 987 654 321', JSON.stringify(row));
await b.close();

// ---------------------------------------------------------------- panel
b = await browser(ADMIN, 'aal2', 1200);
await b.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
await b.send('Page.navigate', { url: 'http://localhost:5174/panel-mv.html' });
let t = await b.waitFor(/Cuentas en total/);
check('panel abre en «Resumen»: cuentas, altas, pruebas, accesos, avisos por estado, USDC', /Cuentas en total/.test(t) && /Altas en los últimos 7 días/.test(t) && /Pendientes/.test(t) && /USDC activado en total/.test(t), t.slice(0, 300));
const auditN = async (a) => (await sql(`select count(*)::int c from admin_audit_log where action = '${a}'`))[0].c;
await b.ev(`document.querySelector('#ptabs button[data-t=users]').click(); 1`);
t = await b.waitFor(/José Núñez/);
check('Usuarios: correo, nombre visible, país, idioma, estado, fechas y contacto', /nueva@example\.org/.test(t) && /José Núñez/.test(t) && /PE/.test(t) && /Prueba vencida/.test(t) && /\+51 987 654 321/.test(t), t.slice(0, 400));
const mail = await b.ev(`(() => { const a = [...document.querySelectorAll('a.mini-link')].find((x) => x.href.includes('nueva%40example.org')); return a ? a.getAttribute('href') : null; })()`);
check('botón «Escribir» = mailto con asunto «Mother Verde»; botón «Copiar correo» presente', mail === 'mailto:nueva%40example.org?subject=Mother%20Verde' && await b.ev(`!!document.querySelector('[data-copy="nueva@example.org"]')`), mail);
const viewedBefore = await auditN('user_viewed');
await b.ev(`document.getElementById('usQ').value = 'josé'; document.getElementById('usGo').click(); 1`); await sleep(800);
check('búsqueda por nombre (josé) -> 1 resultado; cargar listas NO se registra', (await b.ev(`document.querySelectorAll('#usList tr').length`)) === 2 && (await auditN('user_viewed')) === viewedBefore);
await b.ev(`document.getElementById('usQ').value = ''; document.getElementById('usS').value = 'acceso_completo'; document.getElementById('usGo').click(); 1`); await sleep(800);
check('filtro por estado «Acceso completo»', /Acceso completo/.test(await b.ev(`document.getElementById('usList').innerText`)) && !/Prueba vencida/.test(await b.ev(`document.getElementById('usList').innerText`)));
await b.ev(`document.getElementById('usS').value = ''; document.getElementById('usQ').value = 'nueva'; document.getElementById('usGo').click(); 1`); await sleep(800);
await b.ev(`document.querySelector('[data-file]').click(); 1`);
t = await b.waitFor(/Ficha de la cuenta/);
check('ficha: datos, contacto, avisos; nota de que no hay contenido privado', /Ficha de la cuenta/.test(t) && /María López/.test(t) && /Nunca Bitácora/.test(t));
check('abrir la ficha SÍ queda en el registro (user_viewed)', (await auditN('user_viewed')) === viewedBefore + 1);
await b.ev(`document.getElementById('usBack').click(); 1`); await sleep(800);

// export users (with the personal-data warning first)
const expBefore = await auditN('csv_export');
await b.ev(`document.getElementById('usQ').value = ''; document.getElementById('usGo').click(); 1`); await sleep(600);
await b.ev(`document.querySelector('[data-export=users]').click(); 1`); await sleep(300);
check('antes de exportar Usuarios: aviso de datos personales', (await b.ev(`document.getElementById('xm-users').innerText`)).includes('Este archivo contiene datos personales. Guárdalo en un lugar seguro y no lo compartas.'));
check('…y sin confirmar no se exporta nada', (await auditN('csv_export')) === expBefore);
await b.ev(`document.getElementById('piiGo').click(); 1`);
let file = null;
for (let i = 0; i < 20 && !file; i++) { await sleep(500); file = fs.readdirSync(DL).find((f) => f.startsWith('mother-verde-users-') && f.endsWith('.csv')); }
const bytes = file ? fs.readFileSync(path.join(DL, file)) : Buffer.alloc(0);
const text = bytes.toString('utf8');
check(`CSV descargado (${file}): empieza con BOM UTF-8 (EF BB BF)`, bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf);
check('CSV: acentos correctos (José Núñez, María López)', text.includes('"José Núñez"') && text.includes('"María López"'));
check('CSV: inyección de fórmulas neutralizada', text.includes(`"'=HYPERLINK(""http://malo.example"",""clic"")"`) && !/,"=HYPERLINK/.test(text));
check('CSV Usuarios: solo correo, nombre, país, idioma, estado, fechas y contacto', text.split('\r\n')[0] === '﻿email,display_name,country,language,access_state,created_utc,trial_ends_utc,access_until_utc,contact_name,contact_phone');
const ex = (await sql(`select actor_label, reason, details::text d from admin_audit_log where action = 'csv_export' order by at desc limit 1`))[0];
check('exportación registrada (quién, pestaña, filas) sin los datos', (await auditN('csv_export')) === expBefore + 1 && ex.actor_label === 'hello@motherverdeny.com' && ex.reason === 'users' && /"rows"/.test(ex.d) && !/@example|José|María|\+51/.test(ex.d), JSON.stringify(ex));
for (const tab of ['claims', 'gifts', 'audit']) {
  await b.ev(`document.querySelector('#ptabs button[data-t=${tab}]').click(); 1`); await sleep(1200);
  await b.ev(`document.querySelector('[data-export=${tab}]').click(); 1`);
  let f2 = null; for (let i = 0; i < 20 && !f2; i++) { await sleep(400); f2 = fs.readdirSync(DL).find((f) => f.startsWith(`mother-verde-${tab}-`)); }
  check(`exportar CSV en «${tab}» descarga el archivo`, !!f2);
}
await b.ev(`document.querySelector('#ptabs button[data-t=claims]').click(); 1`);
t = await b.waitFor(/María López/);
check('Avisos de aporte: nombre y teléfono de contacto + botones de correo', /Nombre de contacto: María López/.test(t) && /\+51 987 654 321/.test(t) && await b.ev(`!!document.querySelector('#view [data-copy]') && !!document.querySelector('#view a.mini-link')`));
await b.ev(`document.querySelector('#ptabs button[data-t=gifts]').click(); 1`); await sleep(1200);
check('Códigos de regalo: el código canjeado muestra el correo con «Copiar correo» y «Escribir»', await b.ev(`!!document.querySelector('#gl [data-copy="aportante@example.org"]') && !!document.querySelector('#gl a.mini-link[href^="mailto:aportante"]')`));

// languages: live + after reload
await b.ev(`document.querySelector('#ptabs button[data-t=users]').click(); 1`); await sleep(1200);
const LBL = { en: ['Users', 'Export CSV', 'Search by e-mail or name'], de: ['Nutzer', 'CSV exportieren', 'Nach E-Mail oder Name suchen'], fr: ['Utilisateurs', 'Exporter en CSV', 'Chercher par e-mail ou nom'], es: ['Usuarios', 'Exportar CSV', 'Buscar por correo o nombre'] };
for (const L of ['en', 'de', 'fr', 'es']) {
  await b.ev(`document.querySelector('[data-plang=${L}]').click(); 1`); await sleep(1500);
  const x = await b.ev(`({ tab: document.querySelector('#ptabs button[data-t=users]').innerText, exp: document.querySelector('[data-export=users]')?.innerText, ph: document.getElementById('usQ')?.placeholder })`);
  check(`panel · ${L.toUpperCase()}: pestaña Usuarios redibujada sin recargar`, x.tab === LBL[L][0] && x.exp === LBL[L][1] && x.ph === LBL[L][2], JSON.stringify(x));
}
await b.ev(`document.querySelector('[data-plang=de]').click(); 1`); await sleep(500);
await b.send('Page.reload'); t = await b.waitFor(/Konten insgesamt/);
check('panel: al recargar conserva el idioma (DE)', /Konten insgesamt/.test(t));
await b.ev(`document.querySelector('[data-plang=es]').click(); 1`); await sleep(400);
await b.close();

// ---------------------------------------------------------------- no payment apps anywhere
const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
// German «Zelle(n)» (cell) and «Revolution» are normal words: Zelle only counts
// next to a payment word, Revolut only as a whole word.
const ZELLE_PAY = /zelle.{0,40}(pago|pay|payment|zahl|paiement)|(pago|pay|payment|zahl|paiement).{0,40}zelle/i;
const APPS = /cash\s?app|paypal|venmo|\bWise\b|\brevolut\b|western union|moneygram|skrill|payoneer|stripe|coinbase|binance|apple pay|google pay|mercado\s?pago|\byape\b|\bplin\b|payment\s?nerds|paymentcloud/i;
const files = ['index.html', 'panel-mv.html', 'public/main.js', ...fs.readdirSync(APP + 'src').filter((f) => f.endsWith('.js')).map((f) => 'src/' + f),
  ...fs.readdirSync(APP + 'supabase/functions').map((d) => `supabase/functions/${d}/index.ts`).filter((f) => fs.existsSync(APP + f)),
  ...fs.readdirSync(APP + 'supabase/email-templates').filter((f) => f.endsWith('.html') || f.endsWith('.md')).map((f) => 'supabase/email-templates/' + f)];
const hits = [];
for (const f of files) fs.readFileSync(APP + f, 'utf8').split('\n').forEach((l, i) => { const m = l.match(APPS) || l.match(ZELLE_PAY); if (m) hits.push(`${f}:${i + 1} «${m[0]}»`); });
check(`ningún texto de la app, correos ni panel menciona apps de pago (${files.length} archivos)`, hits.length === 0, hits.slice(0, 10).join(' | '));
summary();
process.exit(0);
