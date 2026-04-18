export type GamePhase = 'start' | 'world' | 'battle' | 'reward' | 'download' | 'editor';

export type ZoneType = 'spawn' | 'route' | 'gate' | 'arena';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Attack {
  id: string;
  name: string;
  damage: number;
  description: string;
  color: number;         // Phaser hex color for animation
  unlockLevel: number;
}

export interface EnemyAttack {
  name: string;
  damage: number;
}

export interface EnemyData {
  id: string;
  name: string;
  maxHp: number;
  xpReward: number;
  attacks: EnemyAttack[];
  textureKey: string;
  isBoss: boolean;
  color: number;
}

export interface BossPhase {
  hpThreshold: number;   // fraction of maxHp (0.0 – 1.0)
  attackMultiplier: number;
  label: string;
}

export interface ItemData {
  id: string;
  name: string;
  xpValue: number;
  isReward: boolean;
}
