export const PLAYER_BUST_URL = 'assets/characters/player/bust.webp';

/** Health band for the meter colour; the numbers beside it carry the same news. */
export function hpLevel(hp: number, maxHp: number): 'ok' | 'mid' | 'low' {
  const ratio = hp / Math.max(1, maxHp);
  return ratio <= 0.25 ? 'low' : ratio <= 0.5 ? 'mid' : 'ok';
}

export function percent(value: number, max: number): string {
  return `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`;
}
