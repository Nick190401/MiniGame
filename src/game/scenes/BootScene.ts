import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Nothing to load — all assets generated programmatically
  }

  create(): void {
    this.scene.start('PreloadScene');
  }
}
