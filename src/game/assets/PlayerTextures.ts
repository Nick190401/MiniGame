export type PlayerDirection = 'down' | 'up' | 'left' | 'right';

export const PLAYER_TEXTURES: Record<PlayerDirection, readonly string[]> = {
  down: [
    'player-overworld-down-0',
    'player-overworld-down-1',
    'player-overworld-down-2',
    'player-overworld-down-3',
  ],
  up: [
    'player-overworld-up-0',
    'player-overworld-up-1',
    'player-overworld-up-2',
    'player-overworld-up-3',
  ],
  left: [
    'player-overworld-left-0',
    'player-overworld-left-1',
    'player-overworld-left-2',
    'player-overworld-left-3',
  ],
  right: [
    'player-overworld-right-0',
    'player-overworld-right-1',
    'player-overworld-right-2',
    'player-overworld-right-3',
  ],
};

export const PLAYER_TEXTURE_ASSETS = Object.values(PLAYER_TEXTURES)
  .flat()
  .map(key => ({
    key,
    url: `assets/player/overworld/${key.replace('player-overworld-', 'player-')}.png`,
  }));
