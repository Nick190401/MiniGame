import { characterFrameAssets, characterFrameKey, WALK_FRAMES } from './PlayerTextures';

export type NpcId = 'professor' | 'guard' | 'musician';
export type NpcDirection = 'down' | 'up' | 'left' | 'right';

export const NPC_IDS: readonly NpcId[] = ['professor', 'guard', 'musician'];

const framesFor = (npc: NpcId, direction: NpcDirection): readonly string[] =>
  Array.from({ length: WALK_FRAMES + 1 }, (_, frame) => characterFrameKey(npc, direction, frame));

const directions = (npc: NpcId): Record<NpcDirection, readonly string[]> => ({
  down: framesFor(npc, 'down'),
  up: framesFor(npc, 'up'),
  left: framesFor(npc, 'left'),
  right: framesFor(npc, 'right'),
});

/** Index 0 is the standing pose, 1..WALK_FRAMES the walk cycle. */
export const NPC_TEXTURES: Record<NpcId, Record<NpcDirection, readonly string[]>> = {
  professor: directions('professor'),
  guard: directions('guard'),
  musician: directions('musician'),
};

export const NPC_TEXTURE_ASSETS: ReadonlyArray<{ key: string; url: string }> = [
  ...NPC_IDS.flatMap(characterFrameAssets),
  // Head-and-shoulders portraits (256 x 308) for the dialogue boxes.
  ...NPC_IDS.map(id => ({ key: `portrait-${id}`, url: `assets/characters/${id}/bust.webp` })),
];
