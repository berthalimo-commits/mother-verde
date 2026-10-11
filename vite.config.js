import { defineConfig } from 'vite';
import { resolve } from 'path';

// Two pages: the app (index.html) and the hidden admin panel (panel-mv.html).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        panel: resolve(__dirname, 'panel-mv.html'),
      },
    },
  },
});
