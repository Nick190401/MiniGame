import Phaser from 'phaser';
import { TextureFactory } from '../utils/TextureFactory';
import { EventBus, EVENTS } from '../EventBus';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // Load tileset images (Puny World CC0)
    // Only tiles that work well as standalone repeating tiles.
    // Buildings, trees, tall grass, water, cave tiles stay programmatic.
    const tileImages = [
      'tile-grass', 'tile-grass-2',
      'tile-path', 'tile-path-2',
      'tile-flower', 'tile-flower-2',
    ];
    tileImages.forEach(key => {
      this.load.image(key, `assets/tiles/${key}.png`);
    });

    // Character art (used in battle scene)
    this.load.image('player-battle', 'assets/player_model.PNG');
    this.load.image('silence-battle', 'assets/silence_model.PNG');
    this.load.image('staticnoise-battle', 'assets/static-noice.PNG');
    this.load.image('brokensignal-battle', 'assets/brokensignal_model.PNG');
  }

  create(): void {
    const { width, height } = this.scale;

    // ── Loading screen ────────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor('#1a0a2e');

    // Title
    this.add.text(width / 2, height / 2 - 60, 'SOUND QUEST', {
      fontFamily: '"Press Start 2P"',
      fontSize: '20px',
      color: '#ffd700',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 30, 'Find the Lost Track', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Loading bar background
    const barBg = this.add.graphics();
    barBg.fillStyle(0x333355);
    barBg.fillRect(width / 2 - 150, height / 2 + 10, 300, 20);
    barBg.lineStyle(2, 0xffd700);
    barBg.strokeRect(width / 2 - 150, height / 2 + 10, 300, 20);

    // Loading bar fill
    const barFill = this.add.graphics();
    const loadingText = this.add.text(width / 2, height / 2 + 50, 'Generating world...', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#888888',
    }).setOrigin(0.5);

    // ── Generate all textures ─────────────────────────────────────────────
    // Simulate progressive loading with steps
    const steps = [
      { label: 'Loading tiles...', fn: () => TextureFactory.createTileTextures(this) },
      { label: 'Creating player...', fn: () => TextureFactory.createPlayerTextures(this) },
      { label: 'Summoning enemies...', fn: () => TextureFactory.createAllEnemyTextures(this) },
      { label: 'Awakening the boss...', fn: () => TextureFactory.createBossTextures(this) },
      { label: 'Hiding the track...', fn: () => TextureFactory.createItemTextures(this) },
      { label: 'Building UI...', fn: () => TextureFactory.createUITextures(this) },
    ];

    let step = 0;
    const total = steps.length;

    const runNextStep = () => {
      if (step >= total) {
        // Done — transition to world
        loadingText.setText('Ready.');
        barFill.clear();
        barFill.fillStyle(0xffd700);
        barFill.fillRect(width / 2 - 150, height / 2 + 10, 300, 20);

        this.time.delayedCall(400, () => {
          this.scene.start('WorldScene');
          EventBus.emit(EVENTS.SCENE_READY, 'WorldScene');
        });
        return;
      }

      const { label, fn } = steps[step];
      loadingText.setText(label);
      fn();
      step++;

      const progress = step / total;
      barFill.clear();
      barFill.fillStyle(0x4080ff);
      barFill.fillRect(width / 2 - 150, height / 2 + 10, 300 * progress, 20);
      barFill.fillStyle(0xffd700);
      barFill.fillRect(width / 2 - 150, height / 2 + 10, 300 * progress, 4);

      this.time.delayedCall(120, runNextStep);
    };

    this.time.delayedCall(300, runNextStep);
  }
}
