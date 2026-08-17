import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Nothing to load — all assets generated programmatically
  }

  create(): void {
    AudioManager.init(this.game);
    this.scene.start('PreloadScene');
  }
}
