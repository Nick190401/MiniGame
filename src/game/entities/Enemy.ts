import Phaser from 'phaser';
import type { EnemyData } from '../../types/game.types';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  enemyData: EnemyData;
  defeated = false;

  private pulseTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, data: EnemyData) {
    super(scene, x, y, data.textureKey);
    this.enemyData = data;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body — no movement

    this.setDepth(4);
    this.setScale(1.5);

    // Idle pulse tween
    this.pulseTween = scene.tweens.add({
      targets: this,
      scaleX: 1.7,
      scaleY: 1.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Shadow underneath
    const shadow = scene.add.ellipse(x, y + 10, 18, 6, 0x000000, 0.35);
    shadow.setDepth(3);
  }

  defeat(): void {
    this.defeated = true;
    this.pulseTween?.stop();

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      },
    });
  }
}

// ── Enemy definitions ──────────────────────────────────────────────────────

export const ENEMY_DEFINITIONS: EnemyData[] = [
  {
    id: 'static-noise',
    name: 'Static Noise',
    maxHp: 28,
    xpReward: 15,
    textureKey: 'enemy-static-noise',
    isBoss: false,
    color: 0x49dfbf,
    attacks: [
      { name: 'White Noise', damage: 6 },
      { name: 'Frequency Jab', damage: 9 },
    ],
  },
  {
    id: 'broken-signal',
    name: 'Broken Signal',
    maxHp: 38,
    xpReward: 20,
    textureKey: 'enemy-broken-signal',
    isBoss: false,
    color: 0xff6b3d,
    attacks: [
      { name: 'Signal Burst', damage: 8 },
      { name: 'Distortion', damage: 12 },
    ],
  },
  {
    id: 'silence',
    name: 'Silence',
    maxHp: 48,
    xpReward: 25,
    textureKey: 'enemy-silence',
    isBoss: false,
    color: 0xff5c66,
    attacks: [
      { name: 'Void Touch', damage: 10 },
      { name: 'Mute', damage: 15 },
      { name: 'Dead Air', damage: 8 },
    ],
  },
];

export const BOSS_DEFINITION: EnemyData = {
  id: 'gatekeeper',
  name: 'The Gatekeeper',
  maxHp: 150,
  xpReward: 80,
  textureKey: 'boss-gatekeeper',
  isBoss: true,
  color: 0xd7ff4a,
  attacks: [
    { name: 'Silence Wave', damage: 10 },
    { name: 'Void Crush', damage: 15 },
    { name: 'Gate Slam', damage: 20 },
    { name: 'Frequency Lock', damage: 13 },
  ],
};
