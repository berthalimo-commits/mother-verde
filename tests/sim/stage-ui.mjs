// Part B — which database each environment uses (vite.config.js) and the
// «STAGING · pruebas» badge. Real builds with the variables Vercel would give:
// a non-production environment pointing to production, Production pointing
// elsewhere, or a missing variable STOPS the build with a clear message; the
// badge shows on the web and the panel only for staging, in 4 languages.
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import { check, sleep, browser, summary } from './browser.mjs';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PROD = JSON.parse(fs.readFileSync(ROOT + 'supabase/projects.json', 'utf8')).production.ref;
const PROD_URL = `https://${PROD}.supabase.co`;
const STAGING_URL = 'https://abcdefghijklmnopqrst.supabase.co'; // any other project
const clean = (o) => { const e = { ...process.env }; for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VERCEL_ENV', 'MV_STAGE', 'MV_ALLOW_PRODUCTION_DB']) delete e[k]; return { ...e, ...o }; };
const build = (env) => {
  const r = spawnSync('npx vite build', { cwd: ROOT, shell: true, encoding: 'utf8', env: clean(env) });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
};

console.log('1. Qué base usa cada entorno');
let r = build({ VERCEL_ENV: 'preview', VITE_SUPABASE_URL: PROD_URL, VITE_SUPABASE_ANON_KEY: 'x' });
check('Preview (cualquier rama: dev, juego…) apuntando a PRODUCCIÓN -> la compilación se detiene con un mensaje claro', !r.ok && /NO es producción y apunta a la base de PRODUCCIÓN/.test(r.out), r.out.slice(-300));
r = build({ VERCEL_ENV: 'development', VITE_SUPABASE_URL: PROD_URL, VITE_SUPABASE_ANON_KEY: 'x' });
check('Development de Vercel apuntando a producción -> detenida', !r.ok && /PRODUCCIÓN/.test(r.out));
r = build({ VITE_SUPABASE_URL: PROD_URL, VITE_SUPABASE_ANON_KEY: 'x' });
check('compilación local apuntando a producción -> detenida (salvo MV_ALLOW_PRODUCTION_DB=1 a mano)', !r.ok && /PRODUCCIÓN/.test(r.out));
r = build({ VERCEL_ENV: 'production', VITE_SUPABASE_URL: STAGING_URL, VITE_SUPABASE_ANON_KEY: 'x' });
check('Production apuntando a otra base (staging) -> detenida', !r.ok && /Production debe usar el proyecto de PRODUCCIÓN/.test(r.out));
r = build({ VERCEL_ENV: 'preview', VITE_SUPABASE_ANON_KEY: 'x' });
check('falta VITE_SUPABASE_URL -> detenida, diciendo cuál falta (no una web que falla en silencio)', !r.ok && /Falta VITE_SUPABASE_URL/.test(r.out));
r = build({ VERCEL_ENV: 'preview', VITE_SUPABASE_URL: STAGING_URL });
check('falta VITE_SUPABASE_ANON_KEY -> detenida, diciendo cuál falta', !r.ok && /Falta VITE_SUPABASE_ANON_KEY/.test(r.out));
r = build({ VERCEL_ENV: 'production', VITE_SUPABASE_URL: PROD_URL, VITE_SUPABASE_ANON_KEY: 'x' });
const prodJs = r.ok ? fs.readdirSync(ROOT + 'dist/assets').filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(ROOT + 'dist/assets/' + f, 'utf8')).join('\n') : '';
check('Production con la base de producción -> compila, y sin la marca de staging activa', r.ok && !/"staging"\s*!==|stage\s*!==\s*"staging"/.test('') && /"production"/.test(prodJs), r.out.slice(-200));
r = build({ VERCEL_ENV: 'preview', VITE_SUPABASE_URL: STAGING_URL, VITE_SUPABASE_ANON_KEY: 'x' });
check('Preview con otra base (staging) -> compila', r.ok, r.out.slice(-200));

console.log('2. Aviso «STAGING · pruebas»');
r = build({ VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'anon', MV_STAGE: 'staging' });
check('compilación de prueba como staging (contra la base simulada)', r.ok);
const srv = spawn(process.execPath, ['static-headers.mjs'], { cwd: ROOT + 'tests/sim', stdio: 'ignore' });
for (let i = 0; i < 40; i++) { await sleep(250); try { if ((await fetch('http://localhost:5175/')).ok) break; } catch {} }
const b = await browser(null, null, 390);
await b.send('Page.navigate', { url: 'http://localhost:5175/' }); await sleep(4500);
const badge = () => b.ev(`(() => { const e = document.getElementById('mvStageBadge'); if (!e) return null; const r = e.getBoundingClientRect(); return { t: e.textContent, w: r.width > 0, title: document.title }; })()`);
let x = await badge();
check('web: aviso visible «STAGING · pruebas» y el título de la pestaña empieza por [STAGING]', x && x.t === 'STAGING · pruebas' && x.w && /^\[STAGING\] /.test(x.title), JSON.stringify(x));
const langs = {};
for (const L of ['en', 'de', 'fr', 'es']) { await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(300); langs[L] = (await badge())?.t; }
check('web: el aviso sigue el idioma (EN, DE, FR, ES)', langs.en === 'STAGING · testing' && langs.de === 'STAGING · Tests' && langs.fr === 'STAGING · tests' && langs.es === 'STAGING · pruebas', JSON.stringify(langs));
await b.close();
const p = await browser(null, null, 1200);
await p.send('Page.navigate', { url: 'http://localhost:5175/panel-mv.html' }); await sleep(3500);
x = await p.ev(`document.getElementById('mvStageBadge')?.textContent`);
check('panel: el mismo aviso', x === 'STAGING · pruebas', x);
await p.close();
srv.kill();
r = build({ VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'anon' });
const localJs = fs.readdirSync(ROOT + 'dist/assets').filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(ROOT + 'dist/assets/' + f, 'utf8')).join('\n');
check('con la base simulada (y en producción) el aviso no aparece: la etapa es «local» / «production»', r.ok && /"local"/.test(localJs));
summary();
process.exit(0);
