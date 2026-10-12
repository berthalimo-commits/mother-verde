// Browser test of /panel-mv.html against the fake Supabase (fakeserver.mjs).
import { check, sleep, sql, mail, browser, summary, OUT } from './browser.mjs';
import fs from 'fs';
const ADMIN = 'b0000001-0000-4000-8000-000000000000', PAYER = 'b0000002-0000-4000-8000-000000000000';

// 1) normal account
let b = await browser(PAYER, 'aal2');
await b.send('Page.navigate', { url: 'http://localhost:5174/panel-mv.html' });
check('cuenta normal (aunque tenga MFA) -> "no tiene acceso al panel"', /no tiene acceso al panel/.test(await b.waitFor(/acceso al panel|Avisos/)));
await b.close();

// 2) admin (hello@motherverdeny.com, 24 h trial over, no full access) without MFA -> enrollment -> panel
b = await browser(ADMIN, 'aal1');
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
const appState = await b.ev(`({ access: document.documentElement.dataset.access, locked: document.documentElement.classList.contains('mv-locked'), acceso: document.getElementById('acceso').classList.contains('active') })`);
check('en la app, la admin con la prueba terminada ve la pantalla de bloqueo (sin acceso completo)', appState.access === 'expired' && appState.locked && appState.acceso, JSON.stringify(appState));
await b.send('Page.navigate', { url: 'http://localhost:5174/panel-mv.html' });
let s = await b.waitFor(/Activa la verificación|Escribe el código/);
check('admin sin MFA -> pantalla para activar la verificación en dos pasos (QR + clave)', /Activa la verificación en dos pasos/.test(s) && /JBSWY3DPEHPK3PXP/.test(s), s.slice(0, 200));
await b.shot('panel-1-mfa');
await b.ev(`document.getElementById('code').value='000000'; document.getElementById('go').click(); 1`);
s = await b.waitFor(/incorrecto/);
check('código TOTP incorrecto -> rechazado, sin panel', /incorrecto/.test(s) && !/Avisos de aporte/.test(s));
await b.ev(`document.getElementById('code').value='123456'; document.getElementById('go').click(); 1`);
s = await b.waitFor(/Avisos de aporte/);
check('código correcto -> panel (sesión aal2)', /Avisos de aporte/.test(s) && /verificación en dos pasos ✓/.test(s));
s = await b.waitFor(/aportante@example.org/);
check('panel: aviso con correo, monto exacto, TXID, enlace a Basescan', /aportante@example\.org/.test(s) && /20\.00\d\d USDC/.test(s) && /0xabab/.test(s) && /Basescan/.test(s), s.slice(0, 400));
check('panel: "Verificación manual" (automática apagada)', /Verificación manual/.test(s));
check('"Activar acceso completo" deshabilitado antes de comprobar', await b.ev(`[...document.querySelectorAll('button[data-act=approve]')][0].disabled`) === true);
await b.shot('panel-2-avisos');
await b.ev(`document.querySelector('button[data-act=check]').click(); 1`);
s = await b.waitFor(/Monto exacto/);
check('"Comprobar en Base" -> lista de comprobaciones con ✓', (s.match(/✓/g) || []).length >= 9 && /Monto exacto/.test(s), s.slice(0, 600));
check('…y ahora "Activar acceso completo" está habilitado', await b.ev(`document.querySelector('button[data-act=approve]').disabled`) === false);
await b.shot('panel-3-comprobado');
await b.ev(`document.querySelector('button[data-act=manual]').click(); 1`);
await sleep(400);
check('activación manual sin motivo -> pide motivo', /motivo/.test(await b.ev(`document.querySelector('.msg').textContent`)));
await b.ev(`document.querySelector('button[data-act=approve]').click(); 1`);
s = await b.waitFor(/No hay nada aquí/);
const st = await sql(`select c.status, p.subscription_status from support_claims c join profiles p on p.id = c.user_id where c.id = 1`);
const m1 = (await mail()).find((m) => m.to === 'aportante@example.org');
check('"Activar acceso completo" -> approved + supporter + correo de activación (simulado)', st[0].status === 'approved' && st[0].subscription_status === 'supporter' && !!m1 && /Tu acceso completo está activo/.test(m1.text), JSON.stringify(st));

// gift codes
await b.ev(`document.querySelector('.tabs button[data-t=gifts]').click(); 1`);
await b.waitFor(/Enviar un código/);
await b.ev(`document.getElementById('ge').value='amiga@example.org'; document.getElementById('gs').click(); 1`);
s = await b.waitFor(/Enviado a amiga/);
check('enviar código -> "Enviado a amiga@example.org" y aparece en la lista como enviado', /Enviado a amiga@example\.org/.test(s) && /enviado/.test(s));
const gm = (await mail()).find((m) => m.to === 'amiga@example.org');
check('…un correo con el código y «Tengo un código de regalo»', !!gm && /Tengo un código de regalo/.test(gm.text) && /[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/.test(gm.text));
check('…el código NO aparece en el panel', !s.includes(gm.text.match(/[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/)[0]));
await b.ev(`document.getElementById('ge').value='x@mailinator.com'; document.getElementById('gs').click(); 1`);
s = await b.waitFor(/bloqueado|no parece/);
check('dominio desechable -> mensaje claro', /bloqueado/.test(s), s.slice(0, 300));
await b.ev(`document.querySelector('[data-void]').click(); 1`);
const vid = await b.ev(`document.querySelector('[data-voidok]').dataset.voidok`);
await b.ev(`document.getElementById('vi${vid}').value='Enviado por error'; document.querySelector('[data-voidok]').click(); 1`);
s = await b.waitFor(/anulado/);
check('anular código con motivo -> estado anulado', /anulado/.test(s) && /Enviado por error/.test(s));
const giftsBefore = (await sql(`select count(*)::int c from gift_codes`))[0].c;
await b.ev(`document.getElementById('gt').click(); 1`);
s = await b.waitFor(/Correo de prueba enviado/);
check('"Enviar correo de prueba a mi correo" -> a hello@motherverdeny.com, sin crear código', /hello@motherverdeny\.com/.test(s) && (await sql(`select count(*)::int c from gift_codes`))[0].c === giftsBefore);
await b.shot('panel-4-codigos');
await b.ev(`document.querySelector('.tabs button[data-t=audit]').click(); 1`);
s = await b.waitFor(/claim_approved/);
check('registro (solo lectura): aprobación, envío, anulación y prueba', ['claim_approved', 'gift_code_sent', 'gift_code_revoked', 'test_email_sent', 'activation_email_sent'].every((a) => s.includes(a)), s.slice(0, 500));
await b.shot('panel-5-registro');
const horiz = await b.ev('document.documentElement.scrollWidth > innerWidth');
check('sin desplazamiento horizontal a 420 px', horiz === false);
await b.close();

summary();
process.exit(0);
