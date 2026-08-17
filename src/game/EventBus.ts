import Phaser from 'phaser';

/**
 * Singleton EventEmitter used as a bridge between Phaser scenes and React components.
 * Phaser scenes emit events; React components subscribe and update accordingly.
 */
export const EventBus = new Phaser.Events.EventEmitter();

export interface DialogPayload {
  text: string;
  speaker: string;
  accent: string;
  portrait?: 'elder' | 'guard' | 'musician' | 'gatekeeper';
}

export interface BattleAttackPayload {
  id: string;
  name: string;
  description: string;
  accent: string;
  unlocked: boolean;
  key: number;
  unlockLevel: number;
}

export interface BattleUiPayload {
  isBoss: boolean;
  phase: string;
  enemy: { name: string; hp: number; maxHp: number; accent: string };
  player: { name: string; hp: number; maxHp: number; level: number };
  message: string;
  messageReady: boolean;
  turnStatus: string;
  turnAccent: string;
  inputEnabled: boolean;
  attacks: BattleAttackPayload[];
}

export interface NoticePayload {
  eyebrow?: string;
  title: string;
  detail?: string;
  accent?: string;
  tone?: 'info' | 'success' | 'danger' | 'combat';
  variant?: 'compact' | 'hero';
  duration?: number;
}

export interface ZoneUiPayload {
  title: string;
  meta: string;
  accent: string;
}

export interface LoadingUiPayload {
  step: number;
  total: number;
  label: string;
  progress: number;
  ready?: boolean;
}

export interface DeathUiPayload {
  ready: boolean;
  reconnecting: boolean;
}

export interface AttackUsedPayload {
  attackId: string;
  name: string;
  isPlayer: boolean;
}

export interface ImpactPayload {
  isPlayer: boolean;
}

export interface HealPayload {
  amount: number;
  source: 'npc' | 'respawn';
}

// ---- Event constants ----
export const EVENTS = {
  XP_GAINED: 'xp-gained',
  LEVEL_UP: 'level-up',
  BATTLE_START: 'battle-start',
  BATTLE_END: 'battle-end',
  BATTLE_UI_STATE: 'battle-ui-state',
  BATTLE_UI_REQUEST: 'battle-ui-request',
  BATTLE_UI_ACTION: 'battle-ui-action',
  UI_NOTICE: 'ui-notice',
  UI_NOTICE_CLEAR: 'ui-notice-clear',
  ZONE_UI_STATE: 'zone-ui-state',
  ZONE_UI_REQUEST: 'zone-ui-request',
  LOADING_UI_STATE: 'loading-ui-state',
  DEATH_UI_STATE: 'death-ui-state',
  DEATH_UI_ACTION: 'death-ui-action',
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
  // Audio hooks — scenes narrate what happened, AudioManager decides what to play
  ATTACK_USED: 'attack-used',
  IMPACT: 'battle-impact',
  BOSS_PHASE_CHANGED: 'boss-phase-changed',
  HEAL: 'heal',
  // Map editor — canvas events
  EDITOR_READY:         'editor-ready',
  EDITOR_HOVER:         'editor-hover',
  EDITOR_UNDO_STATE:    'editor-undo-state',
  EDITOR_TILE_PLACED:   'editor-tile-placed',
  EDITOR_TILE_PICKED:   'editor-tile-picked',
  EDITOR_GRID_CHANGED:  'editor-grid-changed',
  EDITOR_VIEWPORT:      'editor-viewport',
  EDITOR_SELECTION:     'editor-selection',
  EDITOR_TOOL_CHANGED:  'editor-tool-changed',
  EDITOR_BRUSH_SIZE:    'editor-brush-size',
  EDITOR_CLIPBOARD:     'editor-clipboard',
} as const;
