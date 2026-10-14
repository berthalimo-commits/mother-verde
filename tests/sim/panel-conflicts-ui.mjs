// Browser test — panel: late-payment mark, reason history kept by "Comprobar
// en Base", and TXID conflicts side by side, resolved only with a reason
// (migration 20261014120000). fakeserver.mjs seeds PAYER with a submitted
// claim whose transfer (0xabab…) exists on the simulated Base chain.
import { check, sleep, sql, browser, summary, ADMIN, PAYER } from './browser.mjs';

const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const TX = '0x' + 'ab'.repeat(32);
// NEWBIE: an expired reservation of the SAME amount, then a late claim with PAYER's public TXID
const payer = (await sql(`select id, amount_units from support_claims where user_id = '${PAYER}'`))[0];
await sql(`insert into support_claims (user_id, flowers, amount_units, status, created_at, expires_at)
           values ('${NEWBIE}', 2, ${payer.amount_units}, 'expired', now() - interval '5 days', now() - interval '2 days')`);
const late = (await sql(`select id from support_claims where user_id = '${NEWBIE}'`))[0];
await sql(`select public.svc_submit_late_claim(${late.id}, '${NEWBIE}', '${TX}', '{"late": true}'::jsonb)`);

const b = await browser(ADMIN, 'aal1', 1280);
const bodyWait = async (re, ms = 10000) => { let t = ''; for (let i = 0; i < ms; i += 250) { t = await b.ev('document.body.innerText'); if (re.test(t)) return t; await sleep(250); } return t; };
await b.send('Page.navigate', { url: 'http://localhost:5174/panel-mv.html' });
await b.waitFor(/Activa la verificación|Escribe el código/);
await b.ev(`document.getElementById('code').value='123456'; document.getElementById('go').click(); 1`);
await b.waitFor(/Avisos de aporte/);
await b.ev(`document.querySelector('#ptabs button[data-t=claims]').click(); 1`);
let s = await bodyWait(/Conflictos por resolver/i);
check('arriba: «Conflictos por resolver (2)» (mismo TXID y mismo monto) con los dos avisos lado a lado', /Conflictos por resolver \(2\)/i.test(s) && /mismo monto que otro aviso/i.test(s) && /Mismo TXID en dos avisos/i.test(s) && /nueva@example\.org/.test(s) && /aportante@example\.org/.test(s), s.slice(0, 500));
check('el aviso tardío lleva la marca «Pago tardío / reserva vencida»', await b.ev(`!!document.querySelector('[data-late="1"]')`) && /Pago tardío \/ reserva vencida/.test(s));
check('los dos avisos llevan «Conflicto abierto» y no se pueden activar', await b.ev(`document.querySelectorAll('[data-conflict-open="1"]').length`) === 2);
check('historial de motivos visible (pago tardío, conflicto)', await b.ev(`[...document.querySelectorAll('details.history')].some((d) => /pago tardío/.test(d.textContent) && /conflicto_txid/.test(d.textContent))`));
await b.shot('panel-conflicto');

// "Comprobar en Base" on the payer's claim keeps its earlier reasons
const payerCard = `[...document.querySelectorAll('#view .card')].find((c) => c.querySelector('[data-act="check"][data-id="${payer.id}"]'))`;
await b.ev(`document.querySelector('[data-act="check"][data-id="${payer.id}"]').click(); 1`);
await sleep(2500);
const reason = (await sql(`select review_reason, jsonb_array_length(review_history) n from support_claims where id = ${payer.id}`))[0];
check('«Comprobar en Base» no borra el motivo anterior y suma al historial', /revision_manual/.test(reason.review_reason) && reason.n >= 2, JSON.stringify(reason));

// approving while the conflict is open: refused
await b.ev(`(() => { const t = document.getElementById('r${payer.id}'); t.value = 'Comprobado en Basescan'; document.querySelector('[data-act="manual"][data-id="${payer.id}"]').click(); })(); 1`);
await sleep(1500);
check('activar con el conflicto abierto -> «resuélvelo primero»', /conflicto abierto/.test(await b.ev(`document.getElementById('m${payer.id}')?.textContent || document.body.innerText`)));
await sleep(2500);

// resolve: reason too short, then with a reason in favour of the payer
const kids = (await sql(`select id from support_claim_conflicts where status = 'open' order by id`)).map((x) => x.id);
const kid = kids[0];
await b.ev(`document.getElementById('kr${kid}').value = 'corto'; document.querySelector('[data-resolve="${kid}"][data-winner="${payer.id}"]').click(); 1`);
await sleep(500);
check('resolver con un motivo corto -> pide al menos 10 caracteres', /al menos 10 caracteres/.test(await b.ev(`document.getElementById('km${kid}').textContent`)));
await b.ev(`document.getElementById('kr${kid}').value = 'El pago es de la aportante: reservó antes y pagó a tiempo'; document.querySelector('[data-resolve="${kid}"][data-winner="${payer.id}"]').click(); 1`);
s = await bodyWait(/Conflicto resuelto/i);
check('tras resolver uno, el recuadro dice que queda 1', /Conflictos por resolver \(1\)/i.test(s));
await b.ev(`document.getElementById('kr${kids[1]}').value = 'Mismo caso: el monto es de la aportante'; document.querySelector('[data-resolve="${kids[1]}"][data-winner="${payer.id}"]').click(); 1`);
for (let i = 0; i < 40; i++) { s = await b.ev('document.body.innerText'); if (!/Conflictos por resolver/i.test(s)) break; await sleep(250); }
const after = await sql(`select (select count(*)::int from support_claim_conflicts where status = 'open') k, (select status from support_claims where id = ${late.id}) l,
  (select count(*)::int from admin_audit_log where action = 'claim_conflict_resolved') a`);
check('resueltos los dos: desaparece el recuadro, el aviso tardío queda rechazado y todo queda en el registro', /Conflicto resuelto/i.test(s) && !/Conflictos por resolver/i.test(s) && after[0].k === 0 && after[0].l === 'rejected' && after[0].a === 2, JSON.stringify(after));
const hist = {};
for (const L of ['en', 'de', 'fr', 'es']) {
  await b.ev(`document.querySelector('#plang button[data-plang=${L}]').click(); 1`); await sleep(1500);
  hist[L] = await b.ev(`document.querySelector('details.history summary')?.textContent || ''`);
}
check('el historial de motivos sale en los 4 idiomas', /Reason history/.test(hist.en) && /Verlauf der Gründe/.test(hist.de) && /Historique des motifs/.test(hist.fr) && /Historial de motivos/.test(hist.es), JSON.stringify(hist));
await b.close();
summary();
