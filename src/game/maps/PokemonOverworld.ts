export interface LandmarkCollider {
  row1: number;
  col1: number;
  row2: number;
  col2: number;
}

export interface LandmarkStamp {
  texture: string;
  col: number;
  row: number;
  width: number;
  height: number;
  tint?: number;
  flipX?: boolean;
  collision?: boolean;
  collisionFootprints?: LandmarkCollider[];
  roofRows?: number;
}

/**
 * Complete, purpose-built silhouettes give every settlement a readable skyline.
 * The buildings are painted in LandmarkArt and are kept separate from the
 * semantic collision grid below.
 */
export const OVERWORLD_LANDMARKS: LandmarkStamp[] = [
  // Echo Village: homes, research, healing and craft all look different.
  { texture: 'landmark-cottage', col: 4, row: 3, width: 7, height: 6 },
  { texture: 'landmark-professor-lab', col: 17, row: 1, width: 10, height: 7 },
  { texture: 'landmark-clinic', col: 45, row: 2, width: 8, height: 6 },
  { texture: 'landmark-inn', col: 7, row: 12, width: 8, height: 6 },
  { texture: 'landmark-workshop', col: 49, row: 12, width: 7, height: 5 },

  // Brookside gives the long route a small inhabited rest stop.
  { texture: 'landmark-riverside-hut', col: 46, row: 40, width: 7, height: 5 },

  // Neon Junction: one large civic landmark plus distinct support buildings.
  { texture: 'landmark-signal-station', col: 26, row: 57.75, width: 12, height: 5.25, roofRows: 1.5 },
  { texture: 'landmark-junction-inn', col: 6, row: 59.5, width: 6, height: 4.5, roofRows: 1.5 },
  { texture: 'landmark-junction-clinic', col: 51, row: 59.5, width: 6, height: 4.5, roofRows: 1.5 },
  { texture: 'landmark-junction-workshop', col: 7, row: 69.25, width: 5.25, height: 3.75, roofRows: 1.5 },
  { texture: 'landmark-guard-post', col: 51, row: 70.25, width: 5.25, height: 3.75, roofRows: 1.5 },

  // Whisper Grove acts as a quiet, history-rich transition before the gate.
  { texture: 'landmark-archive-shrine', col: 7, row: 78, width: 7, height: 7 },
  { texture: 'landmark-ranger-hut', col: 49, row: 82, width: 7, height: 5 },

  // Side masonry blocks movement; the six-tile passage beneath the lintel stays open.
  { texture: 'landmark-cave-mouth', col: 25, row: 110, width: 14, height: 6,
    collisionFootprints: [
      { row1: 2, col1: 1, row2: 2, col2: 3 },
      { row1: 2, col1: 10, row2: 2, col2: 12 },
      { row1: 3, col1: 0, row2: 5, col2: 3 },
      { row1: 3, col1: 10, row2: 5, col2: 13 },
    ],
  },
];

export const OVERWORLD_LANDMARK_COLLIDERS: LandmarkCollider[] = OVERWORLD_LANDMARKS.flatMap((landmark) => {
  if (landmark.collision === false) return [];
  if (landmark.collisionFootprints) {
    return landmark.collisionFootprints.map(({ row1, col1, row2, col2 }) => ({
      row1: landmark.row + row1, col1: landmark.col + col1,
      row2: landmark.row + row2, col2: landmark.col + col2,
    }));
  }
  return [{
    row1: Math.ceil(landmark.row + (landmark.roofRows ?? 2)),
    col1: Math.ceil(landmark.col),
    row2: Math.ceil(landmark.row + landmark.height) - 1,
    col2: Math.floor(landmark.col + landmark.width) - 1,
  }];
});
