// D.2: every screen, 4 languages, every access state — search all page text
// (including hidden sub-sections) for old-model terms and prices.
// Runs against the local simulation (localhost:5174 -> fake Supabase).
import { spawn } from 'child_process'; import fs from 'fs'; import os from 'os'; import path from 'path';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BANNED = /(?<![\d.,])(7[.,]10|7[.,]99|19[.,]99)(?![\d])|payment[\s_-]?nerds|stripe|app\s?store|google\s?play|suscrip|suscrib|subscri|\bAbos?\b|Abo-|abonnier|abonnement|abonn[eé]|(prueba|trial|essai|Test\w*)[^.\n]{0,12}\b(3|tres|three|drei|trois)\b[ -]?(d[ií]as|days?|Tage|jours)/gi;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-scan-'));
const port = 9750 + Math.floor(Math.random() * 100);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let target; for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = {}; const errors = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.split('\n')[0] || d.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await ev(`document.getElementById('ageGateModal').style.display='none'; 1`);
const screens = await ev(`[...document.querySelectorAll('section.screen')].map(s => s.id)`);
const hits = []; let checked = 0;
for (const lang of ['es', 'en', 'de', 'fr']) {
  await ev(`document.querySelector('#langSwitch button[data-lang=${lang}]').click(); 1`); await sleep(400);
  for (const st of ['visitor', 'unconfirmed', 'trial', 'expired', 'no_trial', 'granted', 'revoked', 'supporter']) {
    await ev(`mvAccessPreview(${st === 'visitor' ? 'null' : `'${st}'`}); 1`);
    for (const cl of [null, 'awaiting_payment', 'submitted', 'rejected']) {
      if (cl && st !== 'expired') continue;
      await ev(`mvClaimPreview(${cl ? `'${cl}'` : 'null'}); 1`);
      for (const scr of screens) {
        await ev(`showScreen('${scr}'); 1`);
        const text = await ev(`document.body.innerText + '\\n' + document.body.textContent + '\\n' + document.title + ' ' + [...document.querySelectorAll('meta[content]')].map(m => m.content).join(' ') + ' ' + [...document.querySelectorAll('[placeholder],[title],[aria-label],[alt]')].map(e => [e.placeholder, e.title, e.getAttribute('aria-label'), e.alt].join(' ')).join(' ')`);
        checked++;
        let m; BANNED.lastIndex = 0;
        while ((m = BANNED.exec(text))) hits.push(`${lang} ${st} ${cl || '-'} ${scr}: …${text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}…`);
      }
    }
  }
}
const uniq = [...new Set(hits.map((h) => h.replace(/^\S+ \S+ \S+ \S+: /, '')))];
console.log(`pantallas: ${screens.length} · combinaciones revisadas (idioma × estado × pantalla): ${checked}`);
console.log(`coincidencias distintas: ${uniq.length}`); uniq.slice(0, 30).forEach((u) => console.log('  ', u));
console.log(`errores de JavaScript en la página: ${errors.length}`); [...new Set(errors)].slice(0, 10).forEach((e) => console.log('  ', e));
ws.close(); chrome.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
