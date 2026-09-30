/** Runtime artwork shared by the game loader and the production build. */
export const WORLD_IMAGE_ASSETS = [
  { key: 'player-battle', url: 'assets/player_model.webp?v=mr-readable-2' },
  { key: 'npc-elder-muse-v4', url: 'assets/npc-elder-muse-v4.webp' },
  { key: 'npc-junction-guard-v3', url: 'assets/npc-junction-guard-v4.png' },
  { key: 'npc-wandering-musician-v3', url: 'assets/npc-wandering-musician-v4.png' },
  { key: 'silence-battle', url: 'assets/silence_model.webp' },
  { key: 'staticnoise-battle', url: 'assets/static-noice.webp' },
  { key: 'brokensignal-battle', url: 'assets/brokensignal_model.webp' },
  { key: 'boss-gatekeeper-battle-phase1', url: 'assets/boss-gatekeeper-phase1-v2.webp' },
  { key: 'boss-gatekeeper-battle-phase2', url: 'assets/boss-gatekeeper-phase2-v2.webp' },
  { key: 'boss-gatekeeper-battle-phase3', url: 'assets/boss-gatekeeper-phase3-v2.webp' },
  { key: 'battle-bg-normal', url: 'assets/battle-bg-normal.webp' },
  { key: 'battle-bg-boss', url: 'assets/battle-bg-boss.webp' },
] as const;

const TOWN_GRAPHICS = 'assets/tilesets/town_rpg_pack/town_rpg_pack/graphics';

export const WORLD_TILESET_ASSETS = [
  {
    key: 'town-rpg-atlas',
    url: `${TOWN_GRAPHICS}/transparent-bg-tiles.png`,
    frameConfig: { frameWidth: 16, frameHeight: 16 },
  },
  {
    key: 'town-grass-a',
    url: `${TOWN_GRAPHICS}/grass-tile.png`,
    frameConfig: { frameWidth: 16, frameHeight: 16 },
  },
  {
    key: 'town-grass-b',
    url: `${TOWN_GRAPHICS}/grass-tile-2.png`,
    frameConfig: { frameWidth: 16, frameHeight: 16 },
  },
  {
    key: 'town-grass-c',
    url: `${TOWN_GRAPHICS}/grass-tile-3.png`,
    frameConfig: { frameWidth: 16, frameHeight: 16 },
  },
] as const;
