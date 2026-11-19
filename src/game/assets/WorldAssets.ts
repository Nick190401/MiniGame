/**
 * Runtime artwork shared by the game loader and the production build.
 *
 * The overworld is painted at load time (see src/game/art); the battle arenas
 * and opponents are painted images, loaded under the keys the battle scene,
 * the boss and the dialogue boxes use.
 */
export const WORLD_IMAGE_ASSETS: ReadonlyArray<{ key: string; url: string }> = [
  { key: 'battle-bg-normal', url: 'assets/battle/arena-forest.webp' },
  { key: 'battle-bg-boss', url: 'assets/battle/arena-core.webp' },
  { key: 'staticnoise-battle', url: 'assets/battle/static-noise.webp' },
  { key: 'brokensignal-battle', url: 'assets/battle/broken-signal.webp' },
  { key: 'silence-battle', url: 'assets/battle/silence.webp' },
  { key: 'boss-gatekeeper-battle-phase1', url: 'assets/battle/gatekeeper-phase1.webp' },
  { key: 'boss-gatekeeper-battle-phase2', url: 'assets/battle/gatekeeper-phase2.webp' },
  { key: 'boss-gatekeeper-battle-phase3', url: 'assets/battle/gatekeeper-phase3.webp' },
];

export const WORLD_TILESET_ASSETS: ReadonlyArray<{
  key: string;
  url: string;
  frameConfig: { frameWidth: number; frameHeight: number };
}> = [];
