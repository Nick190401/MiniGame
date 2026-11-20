import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { EventBus, EVENTS } from '../EventBus';
import { bootPrefetchProgress, onBootPrefetchProgress, prefetchBootAssets } from '../assets/BootPrefetch';
import { DOWNLOAD_SHARE } from './PreloadScene';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Nothing to load — all assets generated programmatically
  }

  create(): void {
    AudioManager.init(this.game);
    // The title screen usually has the loading screen's files in memory by
    // now; otherwise finish that download here instead of starting a second one.
    const report = (progress: number) => EventBus.emit(EVENTS.LOADING_UI_STATE, {
      step: 0, total: 6, label: 'Downloading art and sound', progress: Math.round(progress * DOWNLOAD_SHARE),
    });
    report(bootPrefetchProgress());
    const stop = onBootPrefetchProgress(report);
    void prefetchBootAssets().then(() => {
      stop();
      if (this.sys.isActive()) this.scene.start('PreloadScene');
    });
  }
}
