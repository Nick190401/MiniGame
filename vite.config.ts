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
    // Phaser is a game engine in one file — there is no meaningful way to
    // split it further, and it is deliberately its own chunk so it caches
    // across deploys and only downloads once the player starts a game. The
    // limit is raised past it so the warning stays useful for our own code.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
