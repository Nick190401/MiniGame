import { create } from 'zustand';
import type { Attack, GamePhase } from '../types/game.types';
import { ATTACKS, getAttacksForLevel } from '../game/systems/AttackSystem';
import { getLevelFromXP, getMaxHpForLevel } from '../game/systems/XPSystem';
import { FRAGMENT_COUNT, clearSave, readSave, serializeSave, writeSave, type SaveData } from './save';

export { FRAGMENT_COUNT };

interface GameState {
  // Player identity
  playerName: string;

  // Stats
  xp: number;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;

  // Progress
  unlockedAttacks: Attack[];
  inventory: string[];
  defeatedEnemies: string[];
  /** Spawn indices of the sound fragments picked up so far. */
  fragmentsFound: number[];
  /** One-time conversations and cutscenes already played. */
  seenDialogs: string[];
  bossDefeated: boolean;
  bonusSongUnlocked: boolean;
  gateOpen: boolean;

  // UI state
  gamePhase: GamePhase;

  // Actions
  setPlayerName: (name: string) => void;
  addXp: (amount: number) => void;
  takeDamage: (amount: number) => void;
  restoreHp: (amount: number) => void;
  defeatEnemy: (enemyId: string) => void;
  defeatBoss: () => void;
  unlockBonusSong: () => void;
  openGate: () => void;
  setGamePhase: (phase: GamePhase) => void;
  addToInventory: (item: string) => void;
  collectFragment: (index: number) => void;
  markSeen: (key: string) => void;
  /** A fresh journey under this name; it replaces any saved one. */
  startJourney: (name: string) => void;
  /** Picks the saved journey up again. False when there is no usable save. */
  continueJourney: () => boolean;
  resetGame: () => void;
}

const INITIAL_STATE = {
  playerName: '',
  xp: 0,
  level: 1,
  hp: 30,
  maxHp: 30,
  mp: 20,
  maxMp: 20,
  unlockedAttacks: [ATTACKS['bass-drop']],
  inventory: [],
  defeatedEnemies: [],
  fragmentsFound: [] as number[],
  seenDialogs: [] as string[],
  bossDefeated: false,
  bonusSongUnlocked: false,
  gateOpen: false,
  gamePhase: 'title' as GamePhase,
};

/** The game state a save stands for: numbers derived from XP are rebuilt, and a continued journey starts rested. */
function journeyFromSave(save: SaveData) {
  const level = getLevelFromXP(save.xp);
  const maxHp = getMaxHpForLevel(level);
  const maxMp = INITIAL_STATE.maxMp + (level - 1) * 5;
  return {
    playerName: save.playerName,
    xp: save.xp,
    level,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    unlockedAttacks: getAttacksForLevel(level),
    fragmentsFound: save.fragmentsFound,
    seenDialogs: save.seenDialogs,
    defeatedEnemies: save.defeatedEnemies,
    gateOpen: save.gateOpen,
    bossDefeated: save.bossDefeated,
    bonusSongUnlocked: save.bonusSongUnlocked,
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  ...INITIAL_STATE,

  setPlayerName: (name: string) => {
    set({ playerName: name });
  },

  addXp: (amount: number) => {
    const { xp, level } = get();
    const newXp = xp + amount;
    const newLevel = getLevelFromXP(newXp);

    if (newLevel > level) {
      // Level up!
      const newAttacks = getAttacksForLevel(newLevel);
      const maxHp = getMaxHpForLevel(newLevel);
      const hpBonus = maxHp - getMaxHpForLevel(level);
      set({
        xp: newXp,
        level: newLevel,
        unlockedAttacks: newAttacks,
        maxHp,
        hp: Math.min(get().hp + hpBonus, maxHp),
        maxMp: INITIAL_STATE.maxMp + (newLevel - 1) * 5,
      });
    } else {
      set({ xp: newXp });
    }
  },

  takeDamage: (amount: number) => {
    const { hp } = get();
    set({ hp: Math.max(0, hp - amount) });
  },

  restoreHp: (amount: number) => {
    const { hp, maxHp } = get();
    set({ hp: Math.min(maxHp, hp + amount) });
  },

  defeatEnemy: (enemyId: string) => {
    const { defeatedEnemies } = get();
    if (!defeatedEnemies.includes(enemyId)) {
      set({ defeatedEnemies: [...defeatedEnemies, enemyId] });
    }
  },

  defeatBoss: () => {
    set({ bossDefeated: true });
  },

  unlockBonusSong: () => {
    set({ bonusSongUnlocked: true, gamePhase: 'reward' });
  },

  openGate: () => {
    set({ gateOpen: true });
  },

  setGamePhase: (phase: GamePhase) => {
    set({ gamePhase: phase });
  },

  collectFragment: (index: number) => set(state => (
    !Number.isInteger(index) || index < 0 || index >= FRAGMENT_COUNT || state.fragmentsFound.includes(index)
      ? state
      : { fragmentsFound: [...state.fragmentsFound, index].sort((a, b) => a - b) }
  )),

  markSeen: (key: string) => set(state => (
    state.seenDialogs.includes(key) ? state : { seenDialogs: [...state.seenDialogs, key] }
  )),

  startJourney: (name: string) => {
    clearSave();
    set({ ...INITIAL_STATE, unlockedAttacks: [ATTACKS['bass-drop']], playerName: name, gamePhase: 'world' });
  },

  // One update, so the world reads the whole journey when it is built.
  continueJourney: () => {
    const save = readSave();
    if (!save) return false;
    set({ ...INITIAL_STATE, ...journeyFromSave(save), gamePhase: 'world' });
    return true;
  },

  addToInventory: (item: string) => {
    const { inventory } = get();
    set({ inventory: [...inventory, item] });
  },

  resetGame: () => {
    set({ ...INITIAL_STATE, unlockedAttacks: [ATTACKS['bass-drop']] });
  },
}));

// Every change to a journey in progress is saved at once. The title screen and
// the editor hold no journey: saving there would overwrite the real one.
let lastSaved = '';
useGameStore.subscribe(state => {
  if (state.gamePhase === 'title' || state.gamePhase === 'editor' || !state.playerName) return;
  const serialized = serializeSave({
    playerName: state.playerName,
    xp: state.xp,
    fragmentsFound: state.fragmentsFound,
    gateOpen: state.gateOpen,
    bossDefeated: state.bossDefeated,
    bonusSongUnlocked: state.bonusSongUnlocked,
    seenDialogs: state.seenDialogs,
    defeatedEnemies: state.defeatedEnemies,
  });
  if (serialized === lastSaved) return;
  if (writeSave(serialized)) lastSaved = serialized;
});
