export type NpcId = 'professor' | 'guard' | 'musician';
export type NpcDirection = 'down' | 'up' | 'left' | 'right';

const createDirectionFrames = (
  npc: NpcId,
  direction: NpcDirection,
): readonly string[] => Array.from(
  { length: 4 },
  (_, frame) => `npc-${npc}-${direction}-${frame}`,
);

export const NPC_TEXTURES: Record<NpcId, Record<NpcDirection, readonly string[]>> = {
  professor: {
    down: createDirectionFrames('professor', 'down'),
    up: createDirectionFrames('professor', 'up'),
    left: createDirectionFrames('professor', 'left'),
    right: createDirectionFrames('professor', 'right'),
  },
  guard: {
    down: createDirectionFrames('guard', 'down'),
    up: createDirectionFrames('guard', 'up'),
    left: createDirectionFrames('guard', 'left'),
    right: createDirectionFrames('guard', 'right'),
  },
  musician: {
    down: createDirectionFrames('musician', 'down'),
    up: createDirectionFrames('musician', 'up'),
    left: createDirectionFrames('musician', 'left'),
    right: createDirectionFrames('musician', 'right'),
  },
};

export const NPC_TEXTURE_ASSETS = (Object.entries(NPC_TEXTURES) as Array<
  [NpcId, Record<NpcDirection, readonly string[]>]
>).flatMap(([npc, directions]) => (
  Object.values(directions).flat().map(key => ({
    key,
    url: `assets/npc/overworld/${npc === 'professor' ? 'professor-v4' : npc}/${key}.png`,
  }))
));
