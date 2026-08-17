import Phaser from 'phaser';
import { BOSS_DEFINITION } from './Enemy';
import type { BossPhase } from '../../types/game.types';

export const BOSS_PHASES: BossPhase[] = [
  { hpThreshold: 1.00, attackMultiplier: 0.85, label: 'Phase I' },
  { hpThreshold: 0.75, attackMultiplier: 1.0, label: 'Phase II' },
  { hpThreshold: 0.25, attackMultiplier: 1.25, label: 'Phase III' },
];

export class Boss extends Phaser.Physics.Arcade.Sprite {
  readonly bossData = BOSS_DEFINITION;
  private currentPhaseIndex = 0;
  private pulseTween?: Phaser.Tweens.Tween;
  private auraGraphics!: Phaser.GameObjects.Graphics;
  private readonly usesBattleArt: boolean;
  private readonly baseScale: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const usesBattleArt = scene.textures.exists('boss-gatekeeper-battle-phase1');
    super(scene, x, y, usesBattleArt ? 'boss-gatekeeper-battle-phase1' : 'boss-gatekeeper');
    this.usesBattleArt = usesBattleArt;
    this.baseScale = usesBattleArt ? 0.066 : 2.5;
    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.setDepth(4);
    this.setScale(this.baseScale);
    if (usesBattleArt) this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    // Aura background effect
    this.auraGraphics = scene.add.graphics();
    this.auraGraphics.setDepth(3);
    this.updateAura();

    // Pulse tween
    this.pulseTween = scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 1.06,
      scaleY: this.baseScale * 0.96,
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
    const textureKeys = this.usesBattleArt
      ? ['boss-gatekeeper-battle-phase1', 'boss-gatekeeper-battle-phase2', 'boss-gatekeeper-battle-phase3']
      : ['boss-gatekeeper', 'boss-gatekeeper-phase2', 'boss-gatekeeper-phase3'];
    this.setTexture(textureKeys[phaseIndex]);

    // Speed up pulse
    this.pulseTween?.stop();
    const duration = 1200 - phaseIndex * 300;
    this.pulseTween = this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * (1.07 + phaseIndex * 0.025),
      scaleY: this.baseScale * (0.97 + phaseIndex * 0.02),
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
    const colors = [0x6ea8d8, 0xe8b465, 0xf0362c];
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
      scaleX: this.scaleX * 1.8,
      scaleY: this.scaleY * 1.8,
      duration: 800,
      ease: 'Power3',
      onComplete: () => {
        this.destroy();
      },
    });
  }
}
