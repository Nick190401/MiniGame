export const XP_THRESHOLDS = [0, 30, 70, 120, 999999];
export const MAX_LEVEL = 4;

export function getLevelFromXP(xp: number): number {
  let level = 1;
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return Math.min(level, MAX_LEVEL);
}

export function getXPForNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return XP_THRESHOLDS[MAX_LEVEL - 1];
  return XP_THRESHOLDS[level];
}

export function getXPForCurrentLevel(level: number): number {
  return XP_THRESHOLDS[level - 1];
}

/** Returns a 0–1 fraction of progress toward the next level. */
export function getXPProgress(xp: number, level: number): number {
  if (level >= MAX_LEVEL) return 1;
  const currentFloor = getXPForCurrentLevel(level);
  const nextCeil = getXPForNextLevel(level);
  const range = nextCeil - currentFloor;
  if (range <= 0) return 1;
  return Math.min(1, (xp - currentFloor) / range);
}
