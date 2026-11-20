import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { WorldScene } from './scenes/WorldScene';
import { InteriorScene } from './scenes/InteriorScene';
import { BattleScene } from './scenes/BattleScene';
import { UIScene } from './scenes/UIScene';
import { DeathScene } from './scenes/DeathScene';
import { StreamScene } from './scenes/StreamScene';
import { RENDER_SCALE, installHiDpiText } from './render/RenderScale';
import { IS_IOS } from '../platform';

installHiDpiText();

export const gameConfig: Phaser.Types.Core.GameConfig = {
  // The terrain, water and lighting passes are GPU shaders.
  type: Phaser.WEBGL,
  parent: 'game-container',
  backgroundColor: '#050908',
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  render: {
    // Multisampling the full-size canvas costs ~100 MB on a phone; iOS counts it against the page.
    antialiasGL: !IS_IOS,
    powerPreference: 'high-performance',
  },
  // The game never uses per-object Pre FX, whose render targets Phaser builds
  // up front (≈260 MB on a phone at render scale 2). Camera Post FX stay on.
  disablePreFX: IS_IOS,
  // Every finished download is decoded at once; iOS gets fewer at a time to
  // keep the peak low. Elsewhere the key stays absent (Phaser's defaults).
  ...(IS_IOS ? { loader: { maxParallelDownloads: 6 } } : {}),
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, PreloadScene, WorldScene, InteriorScene, UIScene, BattleScene, DeathScene, StreamScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 640 * RENDER_SCALE,
    height: 480 * RENDER_SCALE,
    min: {
      width: 320,
      height: 240,
    },
    max: {
      width: 1920,
      height: 1440,
    },
  },
  input: {
    activePointers: 3,
  },
};
