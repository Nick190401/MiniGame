export type PlayerDirection = 'down' | 'up' | 'left' | 'right';

/** Walk-cycle frames per direction; index 0 of every list is the standing pose. */
export const WALK_FRAMES = 8;

export const characterFrameKey = (id: string, direction: PlayerDirection, frame: number) =>
  `char-${id}-${direction}-${frame}`;

const framesFor = (id: string, direction: PlayerDirection): readonly string[] =>
  Array.from({ length: WALK_FRAMES + 1 }, (_, frame) => characterFrameKey(id, direction, frame));

/** Painted at load time by art/characters (no image files). */
export const PLAYER_TEXTURES: Record<PlayerDirection, readonly string[]> = {
  down: framesFor('player', 'down'),
  up: framesFor('player', 'up'),
  left: framesFor('player', 'left'),
  right: framesFor('player', 'right'),
};

/** The overworld player is generated, so the build ships no frame images. */
export const PLAYER_TEXTURE_ASSETS: ReadonlyArray<{ key: string; url: string }> = [];
