/**
 * The saved journey: only what cannot be derived. Level, HP and attacks are
 * rebuilt from XP on load, so a save never disagrees with the game's rules.
 * Storage is untrusted input (old versions, hand edits, other tabs): anything
 * that does not parse as a current save counts as no save at all.
 */

export const SAVE_KEY = 'sound-quest:save';
export const SAVE_VERSION = 1;

/** Sound fragments placed in the world. */
export const FRAGMENT_COUNT = 3;

const NAME_LIMIT = 16;
const XP_LIMIT = 1_000_000;
const LIST_LIMIT = 64;
const ITEM_LIMIT = 64;

export interface SaveData {
  playerName: string;
  xp: number;
  /** Which of the world's fragments were picked up, by spawn index. */
  fragmentsFound: number[];
  gateOpen: boolean;
  bossDefeated: boolean;
  bonusSongUnlocked: boolean;
  /** One-time conversations and cutscenes already played. */
  seenDialogs: string[];
  defeatedEnemies: string[];
}

const stringList = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= ITEM_LIMIT))].slice(0, LIST_LIMIT)
  : [];

const fragmentList = (value: unknown): number[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is number => Number.isInteger(item) && item >= 0 && item < FRAGMENT_COUNT))].sort((a, b) => a - b)
  : [];

/** A save rebuilt from stored text, or null when the text is not a current save. */
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!stored || typeof stored !== 'object') return null;
  const { version, data } = stored as { version?: unknown; data?: unknown };
  if (version !== SAVE_VERSION || !data || typeof data !== 'object') return null;
  const fields = data as Record<string, unknown>;

  const playerName = typeof fields.playerName === 'string' ? fields.playerName.trim().slice(0, NAME_LIMIT) : '';
  if (!playerName) return null;
  const xp = typeof fields.xp === 'number' && Number.isFinite(fields.xp)
    ? Math.min(XP_LIMIT, Math.max(0, Math.floor(fields.xp)))
    : 0;

  return {
    playerName,
    xp,
    fragmentsFound: fragmentList(fields.fragmentsFound),
    gateOpen: fields.gateOpen === true,
    bossDefeated: fields.bossDefeated === true,
    bonusSongUnlocked: fields.bonusSongUnlocked === true,
    seenDialogs: stringList(fields.seenDialogs),
    defeatedEnemies: stringList(fields.defeatedEnemies),
  };
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify({ version: SAVE_VERSION, data });
}

export function readSave(): SaveData | null {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

/** Writes the save; when storage is full or blocked the game simply plays on unsaved. */
export function writeSave(serialized: string): boolean {
  try {
    localStorage.setItem(SAVE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
