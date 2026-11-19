export type PlayerDirection = 'down' | 'up' | 'left' | 'right';

export const CHARACTER_DIRECTIONS: readonly PlayerDirection[] = ['down', 'up', 'left', 'right'];

/**
 * Layout of every painted character frame (public/assets/characters/<id>):
 * 256 x 320 px, feet at (footX, footY), the figure `figure` px tall.
 */
export const CHARACTER_FRAME = { w: 256, h: 320, footX: 128, footY: 308, figure: 280 } as const;

/** Walk-cycle frames per direction; index 0 of every list is the standing pose. */
export const WALK_FRAMES = 8;

export const characterFrameKey = (id: string, direction: PlayerDirection, frame: number) =>
  `char-${id}-${direction}-${frame}`;

/** The full-resolution image a frame texture is downsampled from. */
export const characterSourceKey = (frameKey: string) => `${frameKey}-source`;

const framesFor = (id: string, direction: PlayerDirection): readonly string[] =>
  Array.from({ length: WALK_FRAMES + 1 }, (_, frame) => characterFrameKey(id, direction, frame));

export const PLAYER_TEXTURES: Record<PlayerDirection, readonly string[]> = {
  down: framesFor('player', 'down'),
  up: framesFor('player', 'up'),
  left: framesFor('player', 'left'),
  right: framesFor('player', 'right'),
};

/**
 * Painted frames of one character (public/assets/characters/<id>):
 * <direction>-<0..WALK_FRAMES>.webp, where 0 is the standing pose.
 */
export function characterFrameAssets(id: string): Array<{ key: string; url: string }> {
  return CHARACTER_DIRECTIONS.flatMap(direction => Array.from({ length: WALK_FRAMES + 1 }, (_, frame) => ({
    key: characterSourceKey(characterFrameKey(id, direction, frame)),
    url: `assets/characters/${id}/${direction}-${frame}.webp`,
  })));
}

export const PLAYER_TEXTURE_ASSETS: ReadonlyArray<{ key: string; url: string }> = [
  ...characterFrameAssets('player'),
  // Full-body illustration: loading and death screens.
  { key: 'player-battle', url: 'assets/characters/player/full.webp' },
  // Three-quarter battle stance, turned toward the opponent.
  { key: 'player-battle-stance', url: 'assets/characters/player/battle.webp' },
];
