import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

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
export default defineConfig(({ command }) => {
  const preview = command === 'serve' || process.env.VERCEL_GIT_COMMIT_REF === 'dev' || process.env.MV_DEV_PREVIEW === '1';
  return {
    define: { 'import.meta.env.VITE_MV_PREVIEW': JSON.stringify(preview ? '1' : '0') },
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
