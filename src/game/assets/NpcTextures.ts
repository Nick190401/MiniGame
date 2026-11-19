import { characterFrameKey, WALK_FRAMES } from './PlayerTextures';

export type NpcId = 'professor' | 'guard' | 'musician';
export type NpcDirection = 'down' | 'up' | 'left' | 'right';

const framesFor = (npc: NpcId, direction: NpcDirection): readonly string[] =>
  Array.from({ length: WALK_FRAMES + 1 }, (_, frame) => characterFrameKey(npc, direction, frame));

const directions = (npc: NpcId): Record<NpcDirection, readonly string[]> => ({
  down: framesFor(npc, 'down'),
  up: framesFor(npc, 'up'),
  left: framesFor(npc, 'left'),
  right: framesFor(npc, 'right'),
});

/** Index 0 is the standing pose, 1..WALK_FRAMES the walk cycle. Painted at load time. */
export const NPC_TEXTURES: Record<NpcId, Record<NpcDirection, readonly string[]>> = {
  professor: directions('professor'),
  guard: directions('guard'),
  musician: directions('musician'),
};

/** NPC frames are generated, so the build ships no frame images. */
export const NPC_TEXTURE_ASSETS: ReadonlyArray<{ key: string; url: string }> = [];
