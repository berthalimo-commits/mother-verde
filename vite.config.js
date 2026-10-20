import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// WHICH DATABASE (Part B, staging). Vercel gives each environment its own
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (Production → production project,
// Preview → mother-verde-staging). This check makes a mistake impossible to
// ship: the build STOPS, with a clear message, when
//   - a variable is missing (instead of a site that fails silently);
//   - any environment that is not Vercel Production (Preview, every branch
//     including dev and juego, the local server, a local build) points to the
//     production project (supabase/projects.json) — unless MV_ALLOW_PRODUCTION_DB=1
//     is set by hand for a one-off local check;
//   - Vercel Production points to anything but the production project;
//   - Preview points to a project other than staging, when staging's ref is
//     written in supabase/projects.json.
// It also tells the app where it is (import.meta.env.VITE_MV_STAGE: production,
// staging or local) so staging shows the «STAGING · pruebas» badge.
function supabaseTarget(mode, command) {
  // On Vercel only its Environment Variables count (a stray .env file never fills a gap).
  const env = process.env.VERCEL_ENV ? {} : loadEnv(mode, __dirname, 'VITE_');
  const url = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '';
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? '';
  const projects = JSON.parse(fs.readFileSync(resolve(__dirname, 'supabase/projects.json'), 'utf8'));
  const where = process.env.VERCEL_ENV || (command === 'serve' ? 'local (vite)' : 'local (build)');
  const stop = (msg) => { throw new Error(`\n\n[mother-verde] ${msg}\n  Entorno: ${where}. Variables: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (docs/staging.md, paso B.1).\n`); };
  const missing = [!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_ANON_KEY'].filter(Boolean);
  if (missing.length) stop(`Falta ${missing.join(' y ')}: la web no sabría a qué base conectarse. Créala en Vercel → Settings → Environment Variables para este entorno.`);
  let host = '';
  try { host = new URL(url).host; } catch (e) { stop(`VITE_SUPABASE_URL no es una dirección válida.`); }
  const isProd = host === `${projects.production.ref}.supabase.co`;
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (process.env.VERCEL_ENV === 'production' && !isProd) stop('Production debe usar el proyecto de PRODUCCIÓN (mother-verde, Fráncfort) y esta compilación apunta a otro.');
  if (process.env.VERCEL_ENV !== 'production' && isProd && process.env.MV_ALLOW_PRODUCTION_DB !== '1') {
    stop('Este entorno NO es producción y apunta a la base de PRODUCCIÓN. En Vercel, Preview debe usar mother-verde-staging. Compilación detenida para no tocar datos reales.');
  }
  if (process.env.VERCEL_ENV === 'preview' && projects.staging.ref && host !== `${projects.staging.ref}.supabase.co`) stop('Preview debe usar el proyecto mother-verde-staging.');
  const forced = process.env.MV_STAGE; // tests only: never accepted for production
  const stage = forced && !isProd ? forced : isProd ? 'production' : isLocal ? 'local' : 'staging';
  return { stage };
}

// DEV PREVIEW (fake access states + sample data, never writes anything).
// On ONLY when: running the local dev server, the Vercel build of branch
// "dev" (VERCEL_GIT_COMMIT_REF is set by Vercel at build time), or
// MV_DEV_PREVIEW=1 by hand. The production build (branch main) has it OFF:
//   - import.meta.env.VITE_MV_PREVIEW is the constant "0", so the state
//     selector (src/devPreview.js) and the panel demo (src/adminDemo.js) are
//     not even emitted;
//   - every block between /* @mv-preview-start */ and /* @mv-preview-end */
//     is cut out of dist/main.js (public/main.js isn't processed by Vite, so
//     this plugin does it after the build, and fails the build if any is left).
export default defineConfig(({ command, mode }) => {
  const preview = command === 'serve' || process.env.VERCEL_GIT_COMMIT_REF === 'dev' || process.env.MV_DEV_PREVIEW === '1';
  const { stage } = supabaseTarget(mode, command);
  return {
    define: { 'import.meta.env.VITE_MV_PREVIEW': JSON.stringify(preview ? '1' : '0'), 'import.meta.env.VITE_MV_STAGE': JSON.stringify(stage) },
    plugins: [{
      name: 'mv-dev-preview',
      transformIndexHtml(html) {
        return preview ? html.replace('<html lang="es"', '<html lang="es" data-mv-preview="1"') : html;
      },
      closeBundle() {
        if (preview || command !== 'build') return;
        const file = resolve(__dirname, 'dist/main.js');
        let s = fs.readFileSync(file, 'utf8');
        const blocks = (s.match(/\/\* @mv-preview-start \*\/[\s\S]*?\/\* @mv-preview-end \*\//g) || []).length;
        s = s.replace(/\/\* @mv-preview-start \*\/[\s\S]*?\/\* @mv-preview-end \*\//g, '/* (preview removed in the production build) */');
        if (!blocks || /@mv-preview-start|window\.mvAccessPreview\b|window\.mvClaimPreview\b|dataset\.mvPreview/.test(s)) {
          throw new Error('mv-dev-preview: preview code still present in dist/main.js');
        }
        fs.writeFileSync(file, s);
      },
    }],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          panel: resolve(__dirname, 'panel-mv.html'),
        },
      },
    },
  };
});
