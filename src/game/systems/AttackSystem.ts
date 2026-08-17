import type { Attack } from '../../types/game.types';

export const ATTACKS: Record<string, Attack> = {
  'bass-drop': {
    id: 'bass-drop',
    name: 'Bass Drop',
    damage: 18,
    description: 'A deep sonic hit that rattles the soul.',
    color: 0xff7a2b,
    unlockLevel: 1,
  },
  'echo-wave': {
    id: 'echo-wave',
    name: 'Echo Wave',
    damage: 14,
    description: 'Two rippling waves of sound. Hits twice.',
    color: 0x6ea8d8,
    unlockLevel: 2,
  },
  'hook-impact': {
    id: 'hook-impact',
    name: 'Hook Impact',
    damage: 28,
    description: 'A sharp melodic hook strikes deep.',
    color: 0xe8b465,
    unlockLevel: 3,
  },
  'reverb-strike': {
    id: 'reverb-strike',
    name: 'Reverb Strike',
    damage: 38,
    description: 'Ultimate resonance — pure sound made weapon.',
    color: 0xf0362c,
    unlockLevel: 4,
  },
};

export const ATTACK_ORDER = ['bass-drop', 'echo-wave', 'hook-impact', 'reverb-strike'];

export function getAttacksForLevel(level: number): Attack[] {
  return ATTACK_ORDER
    .map(id => ATTACKS[id])
    .filter(attack => attack.unlockLevel <= level);
}

export function applyDamageVariance(baseDamage: number): number {
  const variance = 0.15;
  const factor = 1 - variance + Math.random() * variance * 2;
  return Math.max(1, Math.round(baseDamage * factor));
}
