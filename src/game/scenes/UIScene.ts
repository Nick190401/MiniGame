import Phaser from 'phaser';
import { EventBus, EVENTS } from '../EventBus';
import { useGameStore } from '../../store/gameStore';
import { getXPProgress, getXPForNextLevel, getXPForCurrentLevel } from '../systems/XPSystem';

export class UIScene extends Phaser.Scene {
  private levelText!: Phaser.GameObjects.Text;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;
  private levelUpText!: Phaser.GameObjects.Text;

  private readonly BAR_W = 100;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    const pad = 8;
    const barH = 8;

    // ── HP Bar ────────────────────────────────────────────────────────────
    this.add.text(pad, pad, 'HP', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#e03030',
    }).setScrollFactor(0).setDepth(50);

    const hpBg = this.add.rectangle(pad + 18 + this.BAR_W / 2, pad + 4, this.BAR_W, barH, 0x220000);
    hpBg.setScrollFactor(0).setDepth(49);

    this.hpBarFill = this.add.rectangle(pad + 18, pad, this.BAR_W, barH, 0xe03030);
    this.hpBarFill.setOrigin(0, 0).setScrollFactor(0).setDepth(50);

    this.hpText = this.add.text(pad + 18 + this.BAR_W + 4, pad, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#f0f0f0',
    }).setScrollFactor(0).setDepth(50);

    // ── XP Bar ────────────────────────────────────────────────────────────
    this.add.text(pad, pad + 14, 'XP', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#4080ff',
    }).setScrollFactor(0).setDepth(50);

    const xpBg = this.add.rectangle(pad + 18 + this.BAR_W / 2, pad + 18, this.BAR_W, barH, 0x001122);
    xpBg.setScrollFactor(0).setDepth(49);

    this.xpBarFill = this.add.rectangle(pad + 18, pad + 14, this.BAR_W, barH, 0x4080ff);
    this.xpBarFill.setOrigin(0, 0).setScrollFactor(0).setDepth(50);

    this.xpText = this.add.text(pad + 18 + this.BAR_W + 4, pad + 14, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#f0f0f0',
    }).setScrollFactor(0).setDepth(50);

    // ── Level badge ───────────────────────────────────────────────────────
    const levelBg = this.add.rectangle(pad + 18 + this.BAR_W + 50, pad + 10, 44, 22, 0x1a0a2e);
    levelBg.setScrollFactor(0).setDepth(49);
    this.add.rectangle(pad + 18 + this.BAR_W + 50, pad + 10, 46, 24, 0xffd700, 0)
      .setStrokeStyle(1, 0xffd700)
      .setScrollFactor(0)
      .setDepth(49);

    this.levelText = this.add.text(pad + 18 + this.BAR_W + 50, pad + 10, 'LV 1', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#ffd700',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(50);

    // ── Level up notification ─────────────────────────────────────────────
    this.levelUpText = this.add.text(this.scale.width / 2, 50, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#ffd700',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setAlpha(0);

    // ── Event listeners ───────────────────────────────────────────────────
    EventBus.on(EVENTS.XP_GAINED, this.refreshStats, this);
    EventBus.on(EVENTS.LEVEL_UP, this.onLevelUp, this);
    EventBus.on(EVENTS.HP_CHANGED, this.refreshStats, this);

    // Initial refresh
    this.refreshStats();
  }

  private refreshStats(): void {
    const store = useGameStore.getState();
    const { hp, maxHp, xp, level } = store;

    // HP bar
    const hpFrac = Math.max(0, hp / maxHp);
    this.hpBarFill.setSize(this.BAR_W * hpFrac, 8);
    const hpColor = hpFrac > 0.5 ? 0x40c040 : hpFrac > 0.25 ? 0xe0a030 : 0xe03030;
    this.hpBarFill.setFillStyle(hpColor);
    this.hpText.setText(`${hp}/${maxHp}`);

    // XP bar
    const xpFrac = getXPProgress(xp, level);
    this.xpBarFill.setSize(this.BAR_W * xpFrac, 8);
    const xpCurrent = xp - getXPForCurrentLevel(level);
    const xpNeeded = getXPForNextLevel(level) - getXPForCurrentLevel(level);
    this.xpText.setText(`${xpCurrent}/${xpNeeded}`);

    // Level
    this.levelText.setText(`LV ${level}`);
  }

  private onLevelUp(newLevel: number): void {
    this.levelText.setText(`LV ${newLevel}`);
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

    this.refreshStats();
  }

  shutdown(): void {
    EventBus.off(EVENTS.XP_GAINED, this.refreshStats, this);
    EventBus.off(EVENTS.LEVEL_UP, this.onLevelUp, this);
    EventBus.off(EVENTS.HP_CHANGED, this.refreshStats, this);
  }
}
