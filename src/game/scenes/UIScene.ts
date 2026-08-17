import Phaser from 'phaser';
import { EventBus, EVENTS } from '../EventBus';

/**
 * Lightweight Phaser bridge for global interface events.
 * Visible information is rendered in React so it stays crisp at every scale.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    EventBus.on(EVENTS.LEVEL_UP, this.onLevelUp, this);
  }

  private onLevelUp(newLevel: number): void {
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: 'CHANNEL UPGRADE // COMPLETE',
      title: `Level ${String(newLevel).padStart(2, '0')} reached`,
      detail: 'Your signal is stronger. New tracks may now be available.',
      tone: 'success',
      duration: 2400,
    });
  }

  shutdown(): void {
    EventBus.off(EVENTS.LEVEL_UP, this.onLevelUp, this);
  }
}
