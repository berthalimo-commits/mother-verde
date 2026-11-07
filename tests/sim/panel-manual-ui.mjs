// Browser test — manual contributions (Bertha's decision 2026-11-03): the
// admin (AAL2) records a PayPal contribution in the panel, sees the duplicate
// warning, records anyway with a reason, voids one (nothing deleted), sees it
// in the user's file; Desbloquear says «¿No usas USDC? Escríbenos a …» in the
// 4 languages. Needs Vite on 5174 + a fresh fakeserver (run-all starts it).
import { check, sleep, sql, browser, summary, ADMIN } from './browser.mjs';

const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const b = await browser(ADMIN, 'aal1', 1280);
const bodyWait = async (re, ms = 10000) => { let t = ''; for (let i = 0; i < ms; i += 250) { t = await b.ev('document.body.innerText'); if (re.test(t)) return t; await sleep(250); } return t; };
await b.send('Page.navigate', { url: 'http://localhost:5174/panel-mv.html' });
await b.waitFor(/Activa la verificación|Escribe el código/);
await b.ev(`document.getElementById('code').value='123456'; document.getElementById('go').click(); 1`);
await b.waitFor(/Avisos de aporte/);
await b.ev(`document.querySelector('#ptabs button[data-t=manual]').click(); 1`);
let s = await bodyWait(/Todavía no hay aportes manuales/);
check('pestaña «Aportes manuales» con el botón «Registrar aporte manual» y la lista vacía', /Aportes manuales/.test(s) && /Todavía no hay aportes manuales/.test(s));
await b.ev(`document.getElementById('manOpen').click(); 1`);
check('el formulario pide correo, medio, monto pagado, moneda, comisión opcional, referencia, fecha y flores',
  await b.ev(`['manE','manM','manA','manC','manFee','manR','manD','manFl'].every((id) => { const e = document.getElementById(id); return e && !e.closest('[hidden]') && document.querySelector('label[for="' + id + '"]'); })`));
check('…y explica la regla (10 por flor sobre lo PAGADO)', /10 por flor sobre lo PAGADO/.test(await b.ev(`document.getElementById('manForm').innerText`)));
const fill = (o) => b.ev(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; };
  set('manE', ${JSON.stringify(o.e)}); set('manM', ${JSON.stringify(o.m || 'paypal')}); set('manA', ${JSON.stringify(String(o.a))}); set('manC', ${JSON.stringify(o.c || 'USD')});
  set('manFee', ${JSON.stringify(o.fee ?? '')}); set('manR', ${JSON.stringify(o.r || 'PayPal 5TY8 · acordado por correo')}); set('manFl', ${JSON.stringify(String(o.fl || 1))});
  document.getElementById('manForce').checked = ${!!o.force}; set('manFR', ${JSON.stringify(o.fr || '')});
  document.getElementById('manGo').click(); return 1; })()`);
const msg = async () => { await sleep(1200); return b.ev(`document.getElementById('manMsg').textContent`); };

await fill({ e: 'nueva@example.org', a: 9.5 });
check('9,50 USD por 1 flor -> «Lo pagado no llega a 10 por flor» y no guarda', /no llega a 10 por flor/.test(await msg()) && (await sql(`select count(*)::int n from manual_contributions`))[0].n === 0);
await fill({ e: 'nadie@example.org', a: 10 });
check('correo sin cuenta -> «La persona tiene que registrarse primero»', /registrarse primero/.test(await msg()));
await fill({ e: 'nueva@example.org', a: 10, fee: '0.59' });
check('PayPal 10 USD (comisión 0,59) -> «acceso completo activado para nueva@example.org»', /acceso completo activado para nueva@example\.org/.test(await msg()));
const p1 = (await sql(`select subscription_status s, public.is_premium('${NEWBIE}') p from profiles where id = '${NEWBIE}'`))[0];
check('…en la base: «supporter» y acceso completo (el mismo camino que un aporte USDC)', p1.s === 'supporter' && p1.p === true, JSON.stringify(p1));
s = await bodyWait(/activo/);
check('…aparece en la lista: medio, pagado, comisión, flores, estado «activo»', await b.ev(`(() => { const r = document.querySelector('#manL tr[data-manual]'); return !!r && /PayPal/.test(r.innerText) && /10 USD/.test(r.innerText) && /0.59 USD/.test(r.innerText) && /activo/.test(r.innerText); })()`));
await b.shot('panel-manual-guardado');

await fill({ e: 'nueva@example.org', m: 'cashapp', a: 20, fl: 2, r: 'CashApp $mv segundo' });
await sleep(1200);
check('segundo aporte para la misma cuenta -> aviso «ya tiene un aporte manual activo» y no guarda',
  await b.ev(`!document.getElementById('manDup').hidden && /aporte manual activo/.test(document.getElementById('manDupT').textContent)`) && (await sql(`select count(*)::int n from manual_contributions`))[0].n === 1);
await b.shot('panel-manual-duplicado');
await fill({ e: 'nueva@example.org', m: 'cashapp', a: 20, fl: 2, r: 'CashApp $mv segundo', force: true });
check('«Registrar de todos modos» sin motivo -> pide el motivo', /motivo/i.test(await msg()));
await fill({ e: 'nueva@example.org', m: 'cashapp', a: 20, fl: 2, r: 'CashApp $mv segundo', force: true, fr: 'segundo aporte voluntario' });
check('…con motivo -> guardado (2 en la lista)', /acceso completo activado/.test(await msg()) && (await sql(`select count(*)::int n from manual_contributions`))[0].n === 2);

// void the CashApp one (the newest, first row)
await sleep(800);
const firstId = await b.ev(`document.querySelector('#manL tr[data-manual]').dataset.manual`);
await b.ev(`document.querySelector('[data-mvoid="${firstId}"]').click(); document.getElementById('mvi${firstId}').value = 'no'; document.querySelector('[data-mvoidok="${firstId}"]').click(); 1`);
await sleep(1000);
check('anular sin motivo suficiente -> lo pide, no anula', /motivo/i.test(await b.ev(`document.getElementById('mvm${firstId}').textContent`)) && (await sql(`select count(voided_at)::int v from manual_contributions`))[0].v === 0);
await b.ev(`document.getElementById('mvi${firstId}').value = 'CashApp no llegó'; document.querySelector('[data-mvoidok="${firstId}"]').click(); 1`);
await sleep(1500);
check('anular con motivo -> fila «anulado» con quién y por qué; la otra sigue activa; el acceso sigue',
  await b.ev(`(() => { const r = document.querySelector('#manL tr[data-manual="${firstId}"]'); return r.dataset.voided === '1' && /anulado/.test(r.innerText) && /CashApp no llegó/.test(r.innerText) && /hello@motherverdeny\\.com/.test(r.innerText); })()`)
  && (await sql(`select count(*)::int n from manual_contributions`))[0].n === 2 && (await sql(`select subscription_status s from profiles where id = '${NEWBIE}'`))[0].s === 'supporter');
const log = await sql(`select action from admin_audit_log where action like 'manual_contribution_%' order by id`);
check('el Registro tiene 2 altas y 1 anulación', log.filter((l) => l.action === 'manual_contribution_recorded').length === 2 && log.filter((l) => l.action === 'manual_contribution_voided').length === 1);
await b.shot('panel-manual-anulado');

// the user's file
await b.ev(`document.querySelector('#ptabs button[data-t=users]').click(); 1`);
await bodyWait(/nueva@example\.org/);
await sleep(1000);
await b.ev(`document.querySelector('[data-file="${NEWBIE}"]')?.click(); 1`);
s = await bodyWait(/Ficha|Aportes manuales/);
await sleep(1500);
check('la ficha de la cuenta muestra sus 2 aportes manuales (uno anulado)', await b.ev(`(() => { const box = document.getElementById('ufManual'); return !!box && box.querySelectorAll('tr[data-manual]').length === 2 && box.querySelectorAll('tr[data-voided="1"]').length === 1; })()`));

// the panel in the 4 languages
await b.ev(`document.getElementById('usBack').click(); 1`); await sleep(800);
const tabs = {};
for (const L of ['en', 'de', 'fr', 'es']) { await b.ev(`document.querySelector('#plang button[data-plang=${L}]').click(); 1`); await sleep(400); tabs[L] = await b.ev(`document.querySelector('#ptabs button[data-t=manual]').textContent`); }
check('la pestaña en los 4 idiomas', tabs.en === 'Manual contributions' && tabs.de === 'Manuelle Beiträge' && tabs.fr === 'Contributions manuelles' && tabs.es === 'Aportes manuales', JSON.stringify(tabs));
await b.close();

// Desbloquear: «¿No usas USDC? Escríbenos a hello@motherverdeny.com» in 4 languages
const WANT = { es: '¿No usas USDC? Escríbenos a hello@motherverdeny.com', en: 'Don’t use USDC? Write to us at hello@motherverdeny.com',
  de: 'Du nutzt kein USDC? Schreib uns an hello@motherverdeny.com', fr: 'Tu n’utilises pas l’USDC ? Écris-nous à hello@motherverdeny.com' };
const PAYER2 = 'b0000002-0000-4000-8000-000000000000';
const u = await browser(PAYER2, 'aal1', 390);
await u.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await u.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); showScreen('desbloquear'); 1`); await sleep(800);
const got = {};
for (const L of ['en', 'de', 'fr', 'es']) {
  await u.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(600);
  got[L] = await u.ev(`document.getElementById('dsNoUsdc')?.innerText`);
}
check('Desbloquear dice «¿No usas USDC? Escríbenos a hello@motherverdeny.com» en los 4 idiomas', Object.keys(WANT).every((L) => got[L] === WANT[L]), JSON.stringify(got));
check('…con el correo como enlace mailto', await u.ev(`document.querySelector('#dsNoUsdc a[href^="mailto:hello@motherverdeny.com"]') !== null`));
await u.shot('desbloquear-no-usdc');
await u.close();
summary();
process.exit(0);
