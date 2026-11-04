// Browser test (independent review): when the server refuses a game step
// with «bad_state», the game says so honestly («No pudimos guardar este paso
// en tu cuenta…»), never «Guardado en este dispositivo…», and does NOT retry
// on its own (no resend when the connection comes back, no timer). A normal
// connection problem still says «guardado en este dispositivo» and resends.
// Needs Vite on 5174 + fakeserver.
import { check, sleep, sql, browser, summary, startGame } from './browser.mjs';
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours', trial_started_at = now() where id = '${NEWBIE}'`);
await sql(`delete from game_progress where user_id = '${NEWBIE}'`);
const b = await browser(NEWBIE, 'aal1', 390);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); goMore('juego'); 1`);
for (let i = 0; i < 30; i++) { if (await b.ev(`!!document.getElementById('jgBubble')`)) break; await sleep(200); }
await startGame(b);
await sleep(1500); // let the start's own save finish first
// the server refuses every save from now on (counts the calls)
await b.ev(`(() => { const sb = window.mvSupabase, orig = sb.rpc.bind(sb); window.__saves = 0; window.__mode = 'bad';
  sb.rpc = (fn, args) => { if (fn !== 'game_save') return orig(fn, args); window.__saves++;
    return Promise.resolve(window.__mode === 'bad' ? { data: null, error: { message: 'bad_state' } } : { data: null, error: { message: 'Failed to fetch' } }); };
  return 1; })()`);
const sync = () => b.ev(`document.getElementById('jgSync')?.textContent || ''`);
const waitSync = async (re) => { for (let i = 0; i < 25 && !re.test(await sync()); i++) await sleep(200); };
await b.ev(`document.getElementById('jgNext').click(); 1`); await waitSync(/No pudimos/);
let s = await sync();
check('rechazo «bad_state»: lo dice con claridad', /No pudimos guardar este paso en tu cuenta/.test(s) && /hello@motherverdeny\.com/.test(s), s);
check('…y NO dice «Guardado en este dispositivo»', !/Guardado en este dispositivo/.test(s), s);
const n1 = await b.ev('window.__saves');
await b.ev(`window.dispatchEvent(new Event('online')); 1`); await sleep(1500);
check('…no reintenta solo (ni al volver la conexión)', (await b.ev('window.__saves')) === n1, `${n1} -> ${await b.ev('window.__saves')}`);
await b.ev(`document.querySelector('#langSwitch button[data-lang=en]').click(); 1`); await sleep(300);
check('…en inglés también', /couldn't save this step to your account/.test(await sync()), await sync());
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(300);
// a real connection problem keeps the old behaviour
await b.ev(`window.__mode = 'net'; 1`);
if (await b.ev(`!!document.getElementById('jgNext')`)) await b.ev(`document.getElementById('jgNext').click(); 1`); else await b.ev(`document.querySelector('#juegoRoot button.btn-primary')?.click(); 1`);
await waitSync(/Guardado en este dispositivo/); s = await sync();
const n2 = await b.ev('window.__saves');
await b.ev(`window.dispatchEvent(new Event('online')); 1`); await sleep(1200);
check('sin conexión (otro error): «Guardado en este dispositivo» y reenvía al volver la conexión', /Guardado en este dispositivo/.test(s) && (await b.ev('window.__saves')) > n2, `${s} | ${n2} -> ${await b.ev('window.__saves')}`);
check('sin errores de JavaScript', b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
await b.close();
summary();
