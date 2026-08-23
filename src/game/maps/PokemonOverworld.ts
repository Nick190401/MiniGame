import Phaser from 'phaser';

const TILE = 16;
const ATLAS_COLUMNS = 22;
const ATLAS_KEY = 'town-rpg-atlas';

type StampKind = 'tree' | 'ground' | 'prop';

interface AtlasStamp {
  col: number;
  row: number;
  sourceCol: number;
  sourceRow: number;
  width: number;
  height: number;
  kind: StampKind;
  tint?: number;
  flipX?: boolean;
}

interface LandmarkStamp {
  texture: string;
  col: number;
  row: number;
  width: number;
  height: number;
  tint?: number;
  flipX?: boolean;
  collision?: boolean;
}

export interface LandmarkCollider {
  row1: number;
  col1: number;
  row2: number;
  col2: number;
}

/**
 * Complete, purpose-built silhouettes give every settlement a readable skyline.
 * The buildings are generated with real alpha in WorldArtFactory and are kept
 * separate from the semantic collision grid below.
 */
const landmarks: LandmarkStamp[] = [
  // Echo Village: homes, research, healing and craft all look different.
  { texture: 'landmark-cottage', col: 4, row: 3, width: 7, height: 6 },
  { texture: 'landmark-professor-lab', col: 17, row: 1, width: 10, height: 7 },
  { texture: 'landmark-clinic', col: 45, row: 2, width: 8, height: 6 },
  { texture: 'landmark-inn', col: 7, row: 12, width: 8, height: 6 },
  { texture: 'landmark-workshop', col: 49, row: 12, width: 7, height: 5 },

  // Brookside gives the long route a small inhabited rest stop.
  { texture: 'landmark-riverside-hut', col: 46, row: 40, width: 7, height: 5 },

  // Neon Junction: one large civic landmark plus distinct support buildings.
  { texture: 'landmark-signal-station', col: 24, row: 56, width: 16, height: 7 },
  { texture: 'landmark-inn', col: 5, row: 58, width: 8, height: 6, tint: 0xc9d5ce },
  { texture: 'landmark-clinic', col: 50, row: 58, width: 8, height: 6, tint: 0xc7d9d8 },
  { texture: 'landmark-workshop', col: 6, row: 68, width: 7, height: 5, tint: 0xc0cbc2 },
  { texture: 'landmark-guard-post', col: 50, row: 69, width: 7, height: 5 },

  // Whisper Grove acts as a quiet, history-rich transition before the gate.
  { texture: 'landmark-archive-shrine', col: 7, row: 78, width: 7, height: 7 },
  { texture: 'landmark-ranger-hut', col: 49, row: 82, width: 7, height: 5 },

  // The cave mouth is scenery; the rock grid owns its collision and doorway.
  { texture: 'landmark-cave-mouth', col: 25, row: 110, width: 14, height: 6, collision: false },
];

const treeBands = (row: number, tint?: number): AtlasStamp[] => [
  { col: 0, row, sourceCol: 5, sourceRow: 1, width: 4, height: 7, kind: 'tree', tint },
  { col: 60, row, sourceCol: 5, sourceRow: 1, width: 4, height: 7, kind: 'tree', tint, flipX: true },
];

const atlasStamps: AtlasStamp[] = [
  // Irregular forest edges frame space without turning each zone into a box.
  ...treeBands(1), ...treeBands(8), ...treeBands(14),
  ...treeBands(21, 0xa8b79e), ...treeBands(28, 0xa1b095), ...treeBands(34, 0x97a889),
  ...treeBands(40, 0x9aafa1), ...treeBands(47, 0x91a497),
  ...treeBands(56, 0x879d93), ...treeBands(65, 0x81978e),
  ...treeBands(76, 0x789181), ...treeBands(83, 0x6f8879),
  ...treeBands(94, 0x778274), ...treeBands(101, 0x6d796e), ...treeBands(107, 0x626e65),

  // A few authored small props create memory anchors without visual confetti.
  { col: 14, row: 9, sourceCol: 8, sourceRow: 8, width: 1, height: 1, kind: 'prop' },
  { col: 41, row: 17, sourceCol: 6, sourceRow: 8, width: 1, height: 1, kind: 'prop' },
  { col: 12, row: 29, sourceCol: 5, sourceRow: 8, width: 1, height: 1, kind: 'prop' },
  { col: 51, row: 52, sourceCol: 8, sourceRow: 8, width: 1, height: 1, kind: 'prop', tint: 0xb8ccc2 },
  { col: 43, row: 68, sourceCol: 6, sourceRow: 8, width: 1, height: 1, kind: 'prop', tint: 0xc5d3cf },
  { col: 17, row: 84, sourceCol: 5, sourceRow: 8, width: 1, height: 1, kind: 'prop', tint: 0x91a695 },
  { col: 11, row: 103, sourceCol: 5, sourceRow: 8, width: 1, height: 1, kind: 'prop', tint: 0x879187 },
];

export const OVERWORLD_LANDMARK_COLLIDERS: LandmarkCollider[] = landmarks.flatMap((landmark) => {
  if (landmark.collision === false) return [];
  return [{
    row1: landmark.row + 2,
    col1: landmark.col,
    row2: landmark.row + landmark.height - 1,
    col2: landmark.col + landmark.width - 1,
  }];
});

const frameIndex = (col: number, row: number) => row * ATLAS_COLUMNS + col;

export function renderPokemonOverworld(
  scene: Phaser.Scene,
  decorative: Phaser.GameObjects.Group,
): void {
  atlasStamps.forEach((stamp) => {
    for (let sourceRowOffset = 0; sourceRowOffset < stamp.height; sourceRowOffset++) {
      for (let sourceColOffset = 0; sourceColOffset < stamp.width; sourceColOffset++) {
        const worldRow = stamp.row + sourceRowOffset;
        const worldCol = stamp.col + sourceColOffset;
        const sourceRow = stamp.sourceRow + sourceRowOffset;
        const mirroredOffset = stamp.flipX ? stamp.width - 1 - sourceColOffset : sourceColOffset;
        const sourceCol = stamp.sourceCol + mirroredOffset;
        const image = scene.add.image(
          worldCol * TILE + TILE / 2,
          worldRow * TILE + TILE / 2,
          ATLAS_KEY,
          frameIndex(sourceCol, sourceRow),
        );

        if (stamp.tint !== undefined) image.setTint(stamp.tint);
        if (stamp.flipX) image.setFlipX(true);

        if (stamp.kind === 'ground') image.setDepth(0.35);
        else if (stamp.kind === 'tree') image.setDepth(sourceRowOffset < stamp.height - 2 ? 5.7 : 3.2);
        else image.setDepth(3.1);

        decorative.add(image);
      }
    }
  });

  landmarks.forEach((landmark) => {
    const image = scene.add.image(
      landmark.col * TILE,
      landmark.row * TILE,
      landmark.texture,
    ).setOrigin(0, 0).setDepth(3.5);

    if (landmark.tint !== undefined) image.setTint(landmark.tint);
    if (landmark.flipX) image.setFlipX(true);
    decorative.add(image);
  });
}
