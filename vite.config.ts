import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { runtimeAssetsPlugin } from './scripts/runtimeAssets';
import { PLAYER_TEXTURE_ASSETS } from './src/game/assets/PlayerTextures';
import { NPC_TEXTURE_ASSETS } from './src/game/assets/NpcTextures';
import { WORLD_IMAGE_ASSETS, WORLD_TILESET_ASSETS } from './src/game/assets/WorldAssets';
import { ALL_MUSIC_ASSETS, ALL_SFX_ASSETS } from './src/game/audio/AudioLibrary';

export default defineConfig({
  plugins: [react(), tailwindcss(), runtimeAssetsPlugin({
    required: [
      ...PLAYER_TEXTURE_ASSETS.map(asset => asset.url),
      ...NPC_TEXTURE_ASSETS.map(asset => asset.url),
      ...WORLD_IMAGE_ASSETS.map(asset => asset.url),
      ...WORLD_TILESET_ASSETS.map(asset => asset.url),
      '.htaccess',
      'assets/tilesets/town_rpg_pack/town_rpg_pack/license.txt',
    ],
    optional: [...ALL_MUSIC_ASSETS, ...ALL_SFX_ASSETS].map(asset => asset.url),
  })],
  // No client-side router — disable the SPA HTML fallback so missing static
  // assets (e.g. audio files not added yet) 404 cleanly instead of silently
  // resolving to index.html, which Phaser would then fail to decode as audio.
  appType: 'mpa',
  server: {
    port: 5173,
  },
  build: {
    // Ship the runtime manifest instead of archives, originals and unused art.
    copyPublicDir: false,
    // Keep the engine in its own cacheable chunk. App warms it during idle
    // time on the title screen, or loads it when the player starts a game.
    // The limit leaves the size warning useful for our own code.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React also needs this helper. Keeping it outside Phaser prevents
          // the initial page from importing and preloading the engine.
          if (id === '\0commonjsHelpers.js') return 'commonjs';
          if (id.includes('/node_modules/phaser/')) return 'phaser';
        },
      },
    },
  },
});
