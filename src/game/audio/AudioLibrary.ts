/**
 * Central manifest of every audio asset the game knows about.
 *
 * This is pure data — no Phaser calls here. PreloadScene reads it to queue
 * `this.load.audio(...)` calls, and AudioManager reads it to resolve which
 * key to play for a given game event. Drop real files at the listed paths
 * under `public/assets/audio/` and they start working automatically; until
 * then, missing files are skipped silently (see PreloadScene + AudioManager).
 *
 * To add a new track or sound: add an entry here, drop the file at its
 * `url`, done — no changes needed anywhere else.
 */

export interface AudioAsset {
  key: string;
  url: string;
}

const track = (key: string, url: string): AudioAsset => ({ key, url: `assets/audio/${url}` });

// ---- Music -----------------------------------------------------------------

export const MUSIC = {
  // Overworld default — the one track that's actually in the repo right now
  // (copied from /sounds/sound_quest.mp3). Every zone falls back to this
  // until it gets its own file below.
  overworldDefault: track('music-overworld-default', 'music/overworld/default.mp3'),

  // One slot per zone (WorldScene's ZONES titles map to these in
  // ZONE_TRACK_BY_TITLE below) — not loaded from real files yet. Drop a file
  // at the given path and flip that zone's entry in ZONE_TRACK_BY_TITLE from
  // `overworldDefault.key` to e.g. `echoVillage.key` to activate it.
  echoVillage: track('music-echo-village', 'music/overworld/echo-village.mp3'),
  signalPath: track('music-signal-path', 'music/overworld/signal-path.mp3'),
  neonJunction: track('music-neon-junction', 'music/overworld/neon-junction.mp3'),
  fadingPath: track('music-fading-path', 'music/overworld/fading-path.mp3'),
  resonantCave: track('music-resonant-cave', 'music/overworld/resonant-cave.mp3'),
  voidCave: track('music-void-cave', 'music/overworld/void-cave.mp3'),
  livingCore: track('music-living-core', 'music/overworld/living-core.mp3'),
  theCore: track('music-the-core', 'music/overworld/the-core.mp3'),

  // Battle
  battle: track('music-battle', 'music/battle/battle-theme.mp3'),
  bossPhase1: track('music-boss-phase1', 'music/battle/boss-phase1.mp3'),
  bossPhase2: track('music-boss-phase2', 'music/battle/boss-phase2.mp3'),
  bossPhase3: track('music-boss-phase3', 'music/battle/boss-phase3.mp3'),

  // Story beats
  death: track('music-death', 'music/death/death-theme.mp3'),
} as const;

export const BOSS_PHASE_MUSIC = [MUSIC.bossPhase1.key, MUSIC.bossPhase2.key, MUSIC.bossPhase3.key];

/**
 * WorldScene zone title → overworld track. All zones share the one theme
 * that actually exists today; repoint a zone at its own `MUSIC.xyz.key`
 * once that zone's file has been dropped in (see MUSIC above).
 */
const ZONE_TRACK_BY_TITLE: Record<string, string> = {
  'Echo Village': MUSIC.overworldDefault.key,
  'Signal Path': MUSIC.overworldDefault.key,
  'Neon Junction': MUSIC.overworldDefault.key,
  'Fading Path': MUSIC.overworldDefault.key,
  'Resonant Cave': MUSIC.overworldDefault.key,
  'Void Cave': MUSIC.overworldDefault.key,
  'The Living Core': MUSIC.overworldDefault.key,
  'The Core': MUSIC.overworldDefault.key,
};

export function trackForZone(zoneTitle: string): string {
  return ZONE_TRACK_BY_TITLE[zoneTitle] ?? MUSIC.overworldDefault.key;
}

// ---- SFX --------------------------------------------------------------------

export const SFX = {
  // Player attacks — keyed by Attack.id from AttackSystem.ts (ATTACK_SFX_BY_ID below).
  attackBassDrop: track('sfx-attack-bass-drop', 'sfx/attacks/bass-drop.wav'),
  attackEchoWave: track('sfx-attack-echo-wave', 'sfx/attacks/echo-wave.wav'),
  attackHookImpact: track('sfx-attack-hook-impact', 'sfx/attacks/hook-impact.wav'),
  attackReverbStrike: track('sfx-attack-reverb-strike', 'sfx/attacks/reverb-strike.wav'),
  attackGeneric: track('sfx-attack-generic', 'sfx/attacks/generic.mp3'),

  // Enemy attacks — generic fallback plus specific ones keyed by EnemyAttack.name
  // (see ATTACK_SFX_BY_ENEMY_NAME below). Only Silence's "Void Touch" has a
  // dedicated sound so far; every other enemy attack uses the generic one.
  enemyAttack: track('sfx-enemy-attack', 'sfx/attacks/enemy-attack.mp3'),
  enemyVoidTouch: track('sfx-enemy-void-touch', 'sfx/attacks/void-touch.wav'),

  playerHit: track('sfx-player-hit', 'sfx/attacks/player-hit.mp3'),
  enemyHit: track('sfx-enemy-hit', 'sfx/attacks/enemy-hit.mp3'),

  // Battle beats
  bossPhaseChange: track('sfx-boss-phase-change', 'sfx/battle/boss-phase-change.mp3'),
  bossDefeated: track('sfx-boss-defeated', 'sfx/battle/boss-defeated.mp3'),
  enemyDefeated: track('sfx-enemy-defeated', 'sfx/battle/enemy-defeated.mp3'),

  // World / progression
  levelUp: track('sfx-level-up', 'sfx/world/level-up.mp3'),
  itemPickup: track('sfx-item-pickup', 'sfx/world/collect_disc.wav'),
  gateOpen: track('sfx-gate-open', 'sfx/world/gate-open.mp3'),
  gateBlocked: track('sfx-gate-blocked', 'sfx/world/gate-blocked.mp3'),
  heal: track('sfx-heal', 'sfx/world/heal.wav'),
  respawn: track('sfx-respawn', 'sfx/world/respawn.mp3'),

  // Footsteps — looped for as long as the player is walking, swapped by the
  // surface underfoot (see FOOTSTEP_SFX_BY_SURFACE).
  footstepsGround: track('sfx-footsteps-ground', 'sfx/world/footsteps_minimalistic.wav'),
  footstepsGrass: track('sfx-footsteps-grass', 'sfx/world/walking_in_grass.wav'),

  // UI
  dialogBlip: track('sfx-dialog-blip', 'sfx/ui/dialog-blip.mp3'),
  uiClick: track('sfx-ui-click', 'sfx/ui/click.mp3'),
  uiConfirm: track('sfx-ui-confirm', 'sfx/ui/confirm.mp3'),
} as const;

/** Attack.id (see AttackSystem.ts ATTACKS) → sfx key. Unknown ids fall back to attackGeneric. */
export const ATTACK_SFX_BY_ID: Record<string, string> = {
  'bass-drop': SFX.attackBassDrop.key,
  'echo-wave': SFX.attackEchoWave.key,
  'hook-impact': SFX.attackHookImpact.key,
  'reverb-strike': SFX.attackReverbStrike.key,
};

/** EnemyAttack.name (see Enemy.ts / Boss.ts) → sfx key. Unknown names fall back to enemyAttack. */
export const ATTACK_SFX_BY_ENEMY_NAME: Record<string, string> = {
  'Void Touch': SFX.enemyVoidTouch.key,
};

/** What the player is walking on; `none` means standing still. */
export type FootstepSurface = 'none' | 'ground' | 'grass';

export const FOOTSTEP_SFX_BY_SURFACE: Record<Exclude<FootstepSurface, 'none'>, string> = {
  ground: SFX.footstepsGround.key,
  grass: SFX.footstepsGrass.key,
};

/** Footsteps sit under the music rather than on top of it. */
export const FOOTSTEP_VOLUME = 0.4;

export const ALL_MUSIC_ASSETS: AudioAsset[] = Object.values(MUSIC);
export const ALL_SFX_ASSETS: AudioAsset[] = Object.values(SFX);

/** Lets AudioManager play a cue before Phaser exists (title screen menus). */
export const SFX_URL_BY_KEY: Record<string, string> = Object.fromEntries(
  ALL_SFX_ASSETS.map(asset => [asset.key, asset.url]),
);
