import type Phaser from 'phaser';
import { WORLD_IMAGE_ASSETS, WORLD_TILESET_ASSETS } from './WorldAssets';
import { PLAYER_TEXTURE_ASSETS } from './PlayerTextures';
import { NPC_TEXTURE_ASSETS } from './NpcTextures';
import { PAINTED_WORLD_ART } from './WorldArt';
import {
  ALL_MUSIC_ASSETS, ALL_SFX_ASSETS, ATTACK_SFX_BY_ENEMY_NAME, ATTACK_SFX_BY_ID, BOSS_PHASE_MUSIC, MUSIC, SFX,
} from '../audio/AudioLibrary';

/**
 * What the loading screen waits for, and what streams in behind the world.
 *
 * The loading screen only waits for the art the world shows at once and the
 * few small sounds of the first minutes. Everything else (the music, the
 * battle and boss art, the battle sounds) downloads in StreamScene while the
 * player is already walking. Encounters and the boss fight wait for their
 * group; anything that still fails to load falls back as before.
 */

export interface StreamAsset {
  key: string;
  url: string;
  kind: 'image' | 'audio';
}

export type StreamGroup = 'battle' | 'boss';

/** Audio slots without a file in this build are skipped. */
const AVAILABLE_AUDIO = new Set(
  Object.keys(import.meta.glob('/public/assets/audio/**/*.{mp3,ogg,wav}')).map(path => path.replace('/public/', '')),
);
const AUDIO_BY_KEY = new Map([...ALL_MUSIC_ASSETS, ...ALL_SFX_ASSETS].map(asset => [asset.key, asset]));
const IMAGE_BY_KEY = new Map(WORLD_IMAGE_ASSETS.map(asset => [asset.key, asset]));

const audio = (...keys: string[]): StreamAsset[] => keys.flatMap((key) => {
  const asset = AUDIO_BY_KEY.get(key);
  return asset && AVAILABLE_AUDIO.has(asset.url) ? [{ key, url: asset.url, kind: 'audio' as const }] : [];
});
const images = (...keys: string[]): StreamAsset[] => keys.flatMap((key) => {
  const asset = IMAGE_BY_KEY.get(key);
  return asset ? [{ key, url: asset.url, kind: 'image' as const }] : [];
});
const unique = (assets: StreamAsset[]) => [...new Map(assets.map(asset => [asset.key, asset])).values()];

/** Painted art the world needs when it opens: everything but the battle art, plus the boss's first form, which the world builds the boss from. */
export const BOOT_IMAGES = WORLD_IMAGE_ASSETS
  .filter(asset => !asset.url.startsWith('assets/battle/') || asset.key === 'boss-gatekeeper-battle-phase1');

/** Small sounds of the first minutes: dialogue, footsteps on paths, Krys's heal, the gate, the first pickups. */
export const BOOT_AUDIO = audio(
  SFX.uiClick.key, SFX.dialogBlip.key, SFX.uiConfirm.key, SFX.footstepsGround.key,
  // A continued journey can reach the gate at level 2 before any battle streams in.
  SFX.heal.key, SFX.gateBlocked.key, SFX.gateOpen.key, SFX.itemPickup.key, SFX.levelUp.key,
);

/** Every file the loading screen waits for (PreloadScene loads exactly these). */
export const BOOT_URLS: readonly string[] = [...new Set([
  ...BOOT_IMAGES, ...PLAYER_TEXTURE_ASSETS, ...NPC_TEXTURE_ASSETS, ...WORLD_TILESET_ASSETS, ...PAINTED_WORLD_ART, ...BOOT_AUDIO,
].map(asset => asset.url))];

const BATTLE = unique([
  ...images('battle-bg-normal', 'staticnoise-battle', 'brokensignal-battle', 'silence-battle'),
  ...audio(
    SFX.encounter.key, MUSIC.battle.key,
    SFX.attackBassDrop.key, ...Object.values(ATTACK_SFX_BY_ID),
    SFX.enemyAttack.key, ...Object.values(ATTACK_SFX_BY_ENEMY_NAME),
    SFX.playerHit.key, SFX.enemyHit.key, SFX.victory.key, SFX.enemyDefeated.key,
    // A lost battle leads straight to the death screen.
    MUSIC.death.key,
  ),
]);

const BOSS = unique([
  ...images('battle-bg-boss', 'boss-gatekeeper-battle-phase2', 'boss-gatekeeper-battle-phase3'),
  ...audio(SFX.bossAppeared.key, SFX.bossPhaseChange.key, SFX.bossPhaseFinal.key, SFX.bossDefeated.key, ...BOSS_PHASE_MUSIC),
]);

const GROUPS: Record<StreamGroup, StreamAsset[]> = { battle: BATTLE, boss: BOSS };

/**
 * Download order behind the world. The title theme keeps playing until the
 * overworld track arrives, so the grass footsteps and battles come first. Room paintings are not
 * streamed: each loads when the hero nears its door (InteriorStream.ts).
 */
export const STREAM_ASSETS: StreamAsset[] = (() => {
  const ordered = unique([
    ...audio(SFX.footstepsGrass.key),
    ...BATTLE,
    ...audio(MUSIC.overworldDefault.key, MUSIC.cave.key, SFX.respawn.key),
    ...BOSS,
  ]);
  const listed = new Set([...ordered, ...BOOT_AUDIO].map(asset => asset.key));
  BOOT_IMAGES.forEach(asset => listed.add(asset.key));
  // Anything not placed above still loads, last. The battle intro track is unused.
  const rest = [
    ...images(...WORLD_IMAGE_ASSETS.map(asset => asset.key)),
    ...audio(...[...ALL_MUSIC_ASSETS, ...ALL_SFX_ASSETS].map(asset => asset.key)),
  ].filter(asset => !listed.has(asset.key) && asset.key !== MUSIC.battleIntro.key);
  return unique([...ordered, ...rest]);
})();

// ── Progress, shared through the game registry ───────────────────────────

const STATE_KEY = 'asset-stream';

export interface StreamState {
  /** Keys that arrived or failed. */
  settled: Set<string>;
  /** The whole stream has finished. */
  done: boolean;
}

export function beginStream(scene: Phaser.Scene): StreamState {
  const state: StreamState = { settled: new Set(), done: false };
  scene.registry.set(STATE_KEY, state);
  return state;
}

export function streamState(scene: Phaser.Scene): StreamState | undefined {
  return scene.registry.get(STATE_KEY) as StreamState | undefined;
}

export function isAssetLoaded(scene: Phaser.Scene, asset: StreamAsset): boolean {
  return asset.kind === 'image' ? scene.textures.exists(asset.key) : scene.cache.audio.has(asset.key);
}

/**
 * True once every file of the group has arrived or failed. Fails open: a
 * missing file never holds the game back, since art and sound have fallbacks.
 */
export function isStreamGroupReady(scene: Phaser.Scene, group: StreamGroup): boolean {
  const state = streamState(scene);
  if (!state || state.done) return true;
  return GROUPS[group].every(asset => state.settled.has(asset.key) || isAssetLoaded(scene, asset));
}
