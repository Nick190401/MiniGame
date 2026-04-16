import { create } from 'zustand';
import type { Attack, GamePhase } from '../types/game.types';
import { ATTACKS, getAttacksForLevel } from '../game/systems/AttackSystem';
import { getLevelFromXP } from '../game/systems/XPSystem';

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
  bossDefeated: false,
  bonusSongUnlocked: false,
  gateOpen: false,
  gamePhase: 'start' as GamePhase,
};

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
      const hpBonus = (newLevel - level) * 10;
      set({
        xp: newXp,
        level: newLevel,
        unlockedAttacks: newAttacks,
        maxHp: INITIAL_STATE.maxHp + (newLevel - 1) * 10,
        hp: Math.min(get().hp + hpBonus, INITIAL_STATE.maxHp + (newLevel - 1) * 10),
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

  addToInventory: (item: string) => {
    const { inventory } = get();
    set({ inventory: [...inventory, item] });
  },

  resetGame: () => {
    set({ ...INITIAL_STATE, unlockedAttacks: [ATTACKS['bass-drop']] });
  },
}));
