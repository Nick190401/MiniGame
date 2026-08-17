import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // No client-side router — disable the SPA HTML fallback so missing static
  // assets (e.g. audio files not added yet) 404 cleanly instead of silently
  // resolving to index.html, which Phaser would then fail to decode as audio.
  appType: 'mpa',
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
