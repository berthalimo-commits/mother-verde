// Shared helpers for the browser tests (headless Chrome via the DevTools protocol).
import { spawn } from 'child_process'; import fs from 'fs'; import os from 'os'; import path from 'path';
const OUT = new URL('./out', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'); fs.mkdirSync(OUT, { recursive: true });
const ADMIN = 'b0000001-0000-4000-8000-000000000000', PAYER = 'b0000002-0000-4000-8000-000000000000';
export let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export { failures, check, sleep, OUT, ADMIN, PAYER };
export const sql = async (q) => (await fetch('http://localhost:54322/__sql?q=' + encodeURIComponent(q))).json();
export const mail = async () => (await fetch('http://localhost:54322/__mail')).json();
export const summary = () => console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
export async function browser(uid, aal, w = 420) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-panel-'));
  const port = 9600 + Math.floor(Math.random() * 150);
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let target; for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = {}; const events = []; ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } else if (d.method) { events.push(d); if (events.length > 5000) events.shift(); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 600 });
  const sess = { access_token: `u:${uid}:${aal}`, refresh_token: `r:${uid}:${aal}`, token_type: 'bearer', expires_in: 360000, expires_at: Math.floor(Date.now() / 1000) + 360000, user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'x', app_metadata: {}, user_metadata: {}, created_at: '' } };
  if (uid) await send('Page.addScriptToEvaluateOnNewDocument', { source: `if (location.port === '5174' && !sessionStorage.getItem('seeded')) { localStorage.setItem('sb-localhost-auth-token', ${JSON.stringify(JSON.stringify(sess))}); sessionStorage.setItem('seeded', '1'); }` });
  const shot = async (label) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(`${OUT}/${label}.png`, Buffer.from(r.result.data, 'base64')); };
  const text = () => ev('document.getElementById("app").innerText');
  const waitFor = async (re, ms = 8000) => { for (let t = 0; t < ms; t += 250) { const s = await text(); if (re.test(s)) return s; await sleep(250); } return await text(); };
  const close = async () => { ws.close(); chrome.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} };
  return { send, ev, shot, text, waitFor, close, events };
}

// Game v2 (phases 6-7): a new run starts by preparing the tent and germinating.
// startGame() does it like a person would, with a neutral equipment (the
// effects of each piece are tested on their own) and an ideal germination, so
// a test lands on week 1 of the seedling with health 100, as before phase 6.
export const NEUTRAL_SETUP = [['sistema', 'maceta'], ['carpa', 'mediana'], ['luz', 'led'], ['sustrato', 'tierra'], ['maceta', 'plastico'],
  ['maceta_tam', 'grande'], ['riego_tipo', 'mano'], ['medir', 'si']];
export async function startGame(b, setup = NEUTRAL_SETUP, germ = [['metodo', 'taco'], ['temperatura', 'templada'], ['humedad', 'humedo']]) {
  const fill = (form, pairs, go) => b.ev(`(() => { for (const [d, o] of ${JSON.stringify(pairs)}) document.querySelector('label[for="${form}-' + d + '-' + o + '"]')?.click(); document.getElementById('${go}')?.click(); return 1; })()`);
  if (await b.ev(`!!document.getElementById('jgStart')`)) await b.ev(`document.getElementById('jgStart').click(); 1`);
  else if (await b.ev(`!!document.getElementById('jgSetupForm')`)) await fill('jgSetupForm', setup, 'jgSetupGo');
  for (let i = 0; i < 40 && !(await b.ev(`!!document.getElementById('jgGermForm') || !!document.getElementById('jgNext')`)); i++) await sleep(150);
  if (await b.ev(`!!document.getElementById('jgGermForm')`)) await fill('jgGermForm', germ, 'jgGermGo');
  for (let i = 0; i < 40 && !(await b.ev(`!!document.getElementById('jgNext')`)); i++) await sleep(150);
}
