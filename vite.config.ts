import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ command, mode }) => {
  // Use /eya3D/ base path for static GitHub Pages build, and '/' for local dev / Cloud Run server
  const isStaticBuild = process.env.npm_lifecycle_event === 'build:static' || process.env.npm_lifecycle_event === 'predeploy' || process.env.GITHUB_PAGES === 'true';
  const base = process.env.BASE_URL || (isStaticBuild ? '/eya3D/' : '/');

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
