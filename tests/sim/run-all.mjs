// Runs every simulated test, one after another, and prints one line each.
// Database / function / template tests run directly; each browser test gets
// a fresh fakeserver.mjs (clean database). Vite must already be running on
// 5174 (see README). Usage: node tests/sim/run-all.mjs [name-filter]
import { spawn } from 'child_process';
const DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const plain = ['test.mjs', 'mail-db.mjs', 'signup-fix-attacks.mjs', 'a1-money.mjs', 'owner-account.mjs', 'game-db.mjs', 'game-engine.mjs', 'fn-e2e.mjs', 'mail-content.mjs'];
const browserTests = ['lang-live.mjs', 'app-ui.mjs', 'panel-ui.mjs', 'panel-users-ui.mjs', 'screens-scan.mjs', 'amount-ui.mjs', 'preview-ui.mjs',
  'flowers20-ui.mjs', 'flower-shots.mjs', 'mail-links-ui.mjs', 'mail-signup-ui.mjs', 'mail-flow-ui.mjs', 'mail-panel-ui.mjs', 'owner-ui.mjs', 'game-ui.mjs'];
const filter = process.argv[2] || '';
// screens-scan prints its own summary instead of "RESULTADO: …".
const verdict = (out) => (out.match(/RESULTADO: .*/g) || []).at(-1)
  ?? (/coincidencias distintas: 0/.test(out) && /errores de JavaScript en la página: 0/.test(out)
    ? 'RESULTADO: 0 textos viejos, 0 errores de JavaScript, 0 fallas' : 'SIN RESULTADO: ' + out.slice(-300));
const run = (file) => new Promise((res) => {
  const p = spawn(process.execPath, [file], { cwd: DIR });
  let out = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
  p.on('close', () => res(out));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fakeserver() {
  const p = spawn(process.execPath, ['fakeserver.mjs'], { cwd: DIR, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) { await sleep(500); try { if ((await fetch('http://localhost:54322/__auth')).ok) return p; } catch {} }
  throw new Error('fakeserver did not start');
}
// panel-ui continues where app-ui left the database (see README)
const shared = { 'panel-ui.mjs': 'app-ui.mjs' };
const results = [];
for (const f of plain.filter((f) => f.includes(filter))) {
  const out = await run(f);
  results.push([f, verdict(out)]);
  console.log(results.at(-1).join('  '));
}
let srv = null;
for (const f of browserTests.filter((f) => f.includes(filter))) {
  if (!shared[f] || !srv) { if (srv) { srv.kill(); await sleep(800); } srv = await fakeserver(); }
  const out = await run(f);
  results.push([f, verdict(out)]);
  console.log(results.at(-1).join('  '));
}
if (srv) srv.kill();
const bad = results.filter(([, r]) => !/ 0 fallas/.test(r));
console.log(`\n${results.length} pruebas, ${bad.length} con fallas${bad.length ? ': ' + bad.map(([f]) => f).join(', ') : ''}`);
process.exit(0);
