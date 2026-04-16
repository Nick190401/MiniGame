import Phaser from 'phaser';
import { EventBus, EVENTS } from '../EventBus';

/**
 * Lightweight overlay scene — only handles in-world level-up flash text.
 * All persistent HUD (HP, XP, Level) is rendered by the React <HUD /> component.
 */
export class UIScene extends Phaser.Scene {
  private levelUpText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    this.levelUpText = this.add.text(this.scale.width / 2, 50, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#ffd700',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setAlpha(0);

    EventBus.on(EVENTS.LEVEL_UP, this.onLevelUp, this);
  }

  private onLevelUp(newLevel: number): void {
    this.levelUpText.setText(`★ LEVEL ${newLevel}! ★`);

    this.tweens.add({
      targets: this.levelUpText,
      alpha: 1,
      y: 60,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: this.levelUpText,
            alpha: 0,
            duration: 500,
          });
        });
      },
    });
  }

  shutdown(): void {
    EventBus.off(EVENTS.LEVEL_UP, this.onLevelUp, this);
  }
}
