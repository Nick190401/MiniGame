import Phaser from 'phaser';
import { BOSS_DEFINITION } from './Enemy';
import type { BossPhase } from '../../types/game.types';

export const BOSS_PHASES: BossPhase[] = [
  { hpThreshold: 0.60, attackMultiplier: 1.0, label: 'Phase I' },
  { hpThreshold: 0.30, attackMultiplier: 1.35, label: 'Phase II' },
  { hpThreshold: 0.00, attackMultiplier: 1.7, label: 'Phase III' },
];

export class Boss extends Phaser.Physics.Arcade.Sprite {
  readonly bossData = BOSS_DEFINITION;
  private currentPhaseIndex = 0;
  private pulseTween?: Phaser.Tweens.Tween;
  private auraGraphics!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'boss-gatekeeper');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.setDepth(4);
    this.setScale(2.5);

    // Aura background effect
    this.auraGraphics = scene.add.graphics();
    this.auraGraphics.setDepth(3);
    this.updateAura();

    // Pulse tween
    this.pulseTween = scene.tweens.add({
      targets: this,
      scaleX: 2.7,
      scaleY: 2.3,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Floating animation
    scene.tweens.add({
      targets: this,
      y: y - 8,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  getCurrentPhase(): BossPhase {
    return BOSS_PHASES[this.currentPhaseIndex];
  }

  checkPhaseTransition(currentHp: number, maxHp: number): boolean {
    const hpFraction = currentHp / maxHp;
    let newPhaseIndex = 0;

    if (hpFraction <= BOSS_PHASES[2].hpThreshold) {
      newPhaseIndex = 2;
    } else if (hpFraction <= BOSS_PHASES[1].hpThreshold) {
      newPhaseIndex = 1;
    } else {
      newPhaseIndex = 0;
    }

    if (newPhaseIndex > this.currentPhaseIndex) {
      this.currentPhaseIndex = newPhaseIndex;
      this.onPhaseChange(newPhaseIndex);
      return true; // Phase changed
    }
    return false;
  }

  private onPhaseChange(phaseIndex: number): void {
    // Change texture per phase
    const textureKeys = ['boss-gatekeeper', 'boss-gatekeeper-phase2', 'boss-gatekeeper-phase3'];
    this.setTexture(textureKeys[phaseIndex]);

    // Speed up pulse
    this.pulseTween?.stop();
    const duration = 1200 - phaseIndex * 300;
    this.pulseTween = this.scene.tweens.add({
      targets: this,
      scaleX: 2.8 + phaseIndex * 0.1,
      scaleY: 2.4 + phaseIndex * 0.1,
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Screen flash
    this.scene.cameras.main.flash(300, 255, 0, 0);
    this.scene.cameras.main.shake(200, 0.005);

    this.updateAura();
  }

  private updateAura(): void {
    this.auraGraphics.clear();
    const colors = [0x8800ff, 0xff00ff, 0xff0000];
    const color = colors[this.currentPhaseIndex];
    const alpha = 0.2 + this.currentPhaseIndex * 0.1;

    this.auraGraphics.fillStyle(color, alpha);
    this.auraGraphics.fillCircle(this.x, this.y, 40 + this.currentPhaseIndex * 10);
  }

  defeat(): void {
    this.pulseTween?.stop();
    this.auraGraphics.destroy();

    this.scene.cameras.main.flash(500, 255, 255, 255);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 5,
      scaleY: 5,
      duration: 800,
      ease: 'Power3',
      onComplete: () => {
        this.destroy();
      },
    });
  }
}
