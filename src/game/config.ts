import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { WorldScene } from './scenes/WorldScene';
import { BattleScene } from './scenes/BattleScene';
import { UIScene } from './scenes/UIScene';
import { DeathScene } from './scenes/DeathScene';
import { RENDER_SCALE, installHiDpiText } from './render/RenderScale';

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
    antialiasGL: true,
    powerPreference: 'high-performance',
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, PreloadScene, WorldScene, UIScene, BattleScene, DeathScene],
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
