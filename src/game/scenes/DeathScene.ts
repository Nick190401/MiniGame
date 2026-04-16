import Phaser from 'phaser';
import { useGameStore } from '../../store/gameStore';
import { EventBus, EVENTS } from '../EventBus';

/**
 * Full-screen death overlay — retro RPG "Game Over" with animation.
 * Launched over WorldScene when the player dies in battle.
 */
export class DeathScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DeathScene' });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Full-screen dark overlay ──────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0);
    bg.fillRect(0, 0, W, H);
    bg.setAlpha(0);

    this.tweens.add({
      targets: bg,
      alpha: 1,
      duration: 800,
      ease: 'Power2',
      onUpdate: () => {
        bg.clear();
        bg.fillStyle(0x000000, bg.alpha * 0.92);
        bg.fillRect(0, 0, W, H);
      },
    });

    // ── Falling music note particles ─────────────────────────────
    const noteChars = ['♪', '♫', '♩', '♬'];
    for (let i = 0; i < 14; i++) {
      const note = this.add.text(
        Phaser.Math.Between(40, W - 40),
        -20 - Phaser.Math.Between(0, 200),
        noteChars[i % 4],
        {
          fontFamily: 'serif',
          fontSize: `${Phaser.Math.Between(10, 18)}px`,
          color: '#aa3344',
        }
      ).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: note,
        alpha: { from: 0, to: 0.3 + Math.random() * 0.3 },
        y: H + 40,
        x: note.x + Phaser.Math.Between(-60, 60),
        angle: Phaser.Math.Between(-180, 180),
        duration: 3000 + Math.random() * 2000,
        delay: 400 + i * 150,
        ease: 'Sine.easeIn',
      });
    }

    // ── Horizontal scan line glitch ──────────────────────────────
    for (let i = 0; i < 5; i++) {
      const line = this.add.graphics();
      const ly = Phaser.Math.Between(60, H - 60);
      line.fillStyle(0xff2244, 0.15);
      line.fillRect(0, ly, W, 2);
      line.setAlpha(0);

      this.tweens.add({
        targets: line,
        alpha: { from: 0, to: 0.6 },
        duration: 120,
        delay: 800 + i * 200,
        yoyo: true,
        repeat: 2,
        onComplete: () => line.destroy(),
      });
    }

    // ── "THE SOUND FADES..." text ────────────────────────────────
    const fadeText = this.add.text(W / 2, H * 0.28, 'THE SOUND FADES...', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#882233',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: fadeText,
      alpha: 0.8,
      duration: 1200,
      delay: 600,
      ease: 'Power2',
    });

    // ── GAME OVER title ──────────────────────────────────────────
    const titleText = this.add.text(W / 2, H * 0.44, 'GAME OVER', {
      fontFamily: '"Press Start 2P"',
      fontSize: '22px',
      color: '#cc1133',
    }).setOrigin(0.5).setAlpha(0).setScale(2.5);

    this.tweens.add({
      targets: titleText,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 900,
      delay: 1000,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Subtle glow pulse on title
        this.tweens.add({
          targets: titleText,
          alpha: 0.6,
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    // ── Red vignette edges ───────────────────────────────────────
    const vignette = this.add.graphics();
    vignette.setAlpha(0);
    // Top
    vignette.fillGradientStyle(0x880011, 0x880011, 0x000000, 0x000000, 0.5, 0.5, 0, 0);
    vignette.fillRect(0, 0, W, 60);
    // Bottom
    vignette.fillGradientStyle(0x000000, 0x000000, 0x880011, 0x880011, 0, 0, 0.5, 0.5);
    vignette.fillRect(0, H - 60, W, 60);

    this.tweens.add({
      targets: vignette,
      alpha: 1,
      duration: 1500,
      delay: 800,
    });

    // ── Subtitle line ────────────────────────────────────────────
    const subText = this.add.text(W / 2, H * 0.56, 'The silence swallows everything.', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#665566',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: subText,
      alpha: 0.8,
      duration: 800,
      delay: 1800,
    });

    // ── "Try Again" button ───────────────────────────────────────
    const btnY = H * 0.72;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x1a0a2e, 0.9);
    btnBg.fillRoundedRect(W / 2 - 80, btnY - 14, 160, 28, 4);
    btnBg.lineStyle(1, 0xcc1133, 0.8);
    btnBg.strokeRoundedRect(W / 2 - 80, btnY - 14, 160, 28, 4);
    btnBg.setAlpha(0);

    const btnText = this.add.text(W / 2, btnY, '▸ TRY AGAIN', {
      fontFamily: '"Press Start 2P"',
      fontSize: '9px',
      color: '#ffd700',
    }).setOrigin(0.5).setAlpha(0);

    // Fade in button
    this.tweens.add({
      targets: [btnBg, btnText],
      alpha: 1,
      duration: 600,
      delay: 2600,
      onComplete: () => {
        // Pulse the button border
        this.tweens.add({
          targets: btnBg,
          alpha: 0.5,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    // ── Make button interactive ──────────────────────────────────
    const hitZone = this.add.zone(W / 2, btnY, 180, 36).setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      btnText.setColor('#ffffff');
      btnBg.clear();
      btnBg.fillStyle(0x2a1040, 0.95);
      btnBg.fillRoundedRect(W / 2 - 80, btnY - 14, 160, 28, 4);
      btnBg.lineStyle(2, 0xffd700, 1);
      btnBg.strokeRoundedRect(W / 2 - 80, btnY - 14, 160, 28, 4);
    });

    hitZone.on('pointerout', () => {
      btnText.setColor('#ffd700');
      btnBg.clear();
      btnBg.fillStyle(0x1a0a2e, 0.9);
      btnBg.fillRoundedRect(W / 2 - 80, btnY - 14, 160, 28, 4);
      btnBg.lineStyle(1, 0xcc1133, 0.8);
      btnBg.strokeRoundedRect(W / 2 - 80, btnY - 14, 160, 28, 4);
    });

    hitZone.on('pointerdown', () => {
      this.respawn();
    });

    // ── Also allow keyboard ──────────────────────────────────────
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-SPACE', () => this.respawn());
      this.input.keyboard.once('keydown-ENTER', () => this.respawn());
    }

    // ── Hint text ────────────────────────────────────────────────
    const hintText = this.add.text(W / 2, H * 0.88, 'PRESS SPACE OR CLICK', {
      fontFamily: '"Press Start 2P"',
      fontSize: '5px',
      color: '#444444',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: hintText,
      alpha: 0.6,
      duration: 600,
      delay: 3200,
      onComplete: () => {
        this.tweens.add({
          targets: hintText,
          alpha: 0.2,
          duration: 1000,
          yoyo: true,
          repeat: -1,
        });
      },
    });
  }

  private respawn(): void {
    // Flash white on transition
    this.cameras.main.flash(400, 255, 255, 255);

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      // Restore player HP
      useGameStore.getState().restoreHp(useGameStore.getState().maxHp);

      // Tell WorldScene to respawn
      EventBus.emit(EVENTS.RESPAWN);

      this.scene.stop('DeathScene');
    });
  }
}
