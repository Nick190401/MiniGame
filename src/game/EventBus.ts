import EventEmitter from 'eventemitter3';

/**
 * Singleton EventEmitter used as a bridge between Phaser scenes and React components.
 * Phaser scenes emit events; React components subscribe and update accordingly.
 *
 * This is the same emitter Phaser itself uses internally, imported directly so
 * that the React side of the app — which lives on this bus — does not drag the
 * 1.5 MB engine into the initial page load just to listen for events.
 */
export const EventBus = new EventEmitter();

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

/** Arena/controls split as fractions of the canvas height, so the DOM overlay
 *  lands on the same rows the scene reserved for it at any aspect ratio. */
export interface BattleLayoutPayload {
  arena: number;
  messageTop: number;
  messageHeight: number;
  menuTop: number;
}

export interface BattleUiPayload {
  isBoss: boolean;
  phase: string;
  /** The controls fade out while the defeat plays. */
  fading: boolean;
  layout: BattleLayoutPayload;
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
  /** False when the zone is only restated (after a battle): no new banner. */
  replay?: boolean;
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
  /** Name of the opponent that won, when known. */
  defeatedBy?: string;
  isBoss?: boolean;
}

export interface AttackUsedPayload {
  attackId: string;
  name: string;
  isPlayer: boolean;
}

export interface ImpactPayload {
  isPlayer: boolean;
}

/** Sent as a heal begins; it starts the heal sound. An NPC heal restores HP on the sound's peak, 1.4 s later. */
export interface HealPayload {
  amount: number;
  source: 'npc' | 'respawn';
}

/** A note held up in the reading view (components/NoteReader.tsx). */
export interface NotePayload {
  /** The heading written across the top. */
  title: string;
  lines: string[];
  signature: string;
  /** Added later, in other ink. */
  postscript?: string;
}

/** A sound effect played in a room (an AudioLibrary SFX key). */
export interface RoomSoundPayload {
  key: string;
  volume?: number;
  rate?: number;
}

// ---- Event constants ----
export const EVENTS = {
  XP_GAINED: 'xp-gained',
  LEVEL_UP: 'level-up',
  BATTLE_START: 'battle-start',
  ENCOUNTER: 'encounter',
  BATTLE_END: 'battle-end',
  BATTLE_UI_STATE: 'battle-ui-state',
  BATTLE_UI_REQUEST: 'battle-ui-request',
  BATTLE_UI_ACTION: 'battle-ui-action',
  CUTSCENE_STATE: 'cutscene-state',
  UI_NOTICE: 'ui-notice',
  UI_NOTICE_CLEAR: 'ui-notice-clear',
  ZONE_UI_STATE: 'zone-ui-state',
  ZONE_UI_REQUEST: 'zone-ui-request',
  LOADING_UI_STATE: 'loading-ui-state',
  DEATH_UI_STATE: 'death-ui-state',
  DEATH_UI_ACTION: 'death-ui-action',
  BOSS_DEFEATED: 'boss-defeated',
  BOSS_SUMMONING: 'boss-summoning',
  BONUS_SONG_UNLOCKED: 'bonus-song-unlocked',
  REWARD_UI_STATE: 'reward-ui-state',
  PAUSE_MENU_OPEN: 'pause-menu-open',
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
  /** A move ended early (its target fell mid-combo): fade its sound out over the given ms. */
  ATTACK_SOUND_CUT: 'attack-sound-cut',
  IMPACT: 'battle-impact',
  BOSS_PHASE_CHANGED: 'boss-phase-changed',
  HEAL: 'heal',
  ENEMY_DEFEATED: 'enemy-defeated',
  FOOTSTEPS: 'footsteps',
  /** Inside a building (true, plus the share of the music volume heard through its walls) or back outside (false). */
  INTERIOR_STATE: 'interior-state',
  /** A sound cue in a room (RoomSoundPayload). */
  ROOM_SOUND: 'room-sound',
  /** Quincy's record player: the needle goes down (true) or is lifted (false). */
  RECORD_PLAYER: 'record-player',
  /** The record stopped by itself: it ended, or the browser refused to play it. */
  RECORD_PLAYER_STOPPED: 'record-player-stopped',
  /** A note opens in the reading view (NotePayload) or closes (null). */
  NOTE_UI_STATE: 'note-ui-state',
  /** The reading view was tapped: the scene puts the note down. */
  NOTE_UI_ACTION: 'note-ui-action',
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
