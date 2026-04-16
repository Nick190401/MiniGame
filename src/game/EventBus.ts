import Phaser from 'phaser';

/**
 * Singleton EventEmitter used as a bridge between Phaser scenes and React components.
 * Phaser scenes emit events; React components subscribe and update accordingly.
 */
export const EventBus = new Phaser.Events.EventEmitter();

// ---- Event constants ----
export const EVENTS = {
  XP_GAINED: 'xp-gained',
  LEVEL_UP: 'level-up',
  BATTLE_START: 'battle-start',
  BATTLE_END: 'battle-end',
  BOSS_DEFEATED: 'boss-defeated',
  BONUS_SONG_UNLOCKED: 'bonus-song-unlocked',
  DIALOG: 'dialog',
  DIALOG_CLEAR: 'dialog-clear',
  ITEM_COLLECTED: 'item-collected',
  GATE_BLOCKED: 'gate-blocked',
  GATE_OPEN: 'gate-open',
  PLAYER_DIED: 'player-died',
  RESPAWN: 'respawn',
  SCENE_READY: 'scene-ready',
  HP_CHANGED: 'hp-changed',
} as const;
