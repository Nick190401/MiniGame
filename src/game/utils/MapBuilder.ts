import Phaser from 'phaser';
import { OVERWORLD_LANDMARK_COLLIDERS } from '../maps/PokemonOverworld';
import { TILE_ID } from '../data/tileIds';
import { TILE_TYPE_MAP } from '../data/tileTypes';
import { createTerrainLayer, type TerrainLayer } from '../world/terrain/TerrainLayer';
import type { TerrainRegions } from '../world/terrain/TerrainMaps';
import { dressWorld } from '../world/WorldDressing';
import type { LightSource } from '../world/WorldLighting';

const TILE = 16;
const BROOK_BRIDGE = { top: 44, bottom: 49, left: 28, right: 35 } as const;

const {
  GRASS: _, PATH: P, WALL: W, ARENA: A, GATE: G, SIGN: S, WATER: R, TALL_GRASS: L,
  FLOWER: F, CAVE_FLOOR: C, CAVE_WALL: K, CRYSTAL: X, PILLAR: J, WALL_RUNE: V,
  SKULL: Q2, STALACTITE: N, LANDMARK: H, CAVE_WATER: I, CAVE_STAIRS: Z, BOULDER: E, PORTAL,
} = TILE_ID;

// ──────────────────────────────────────────────────────────────────────────────
//  Map: 64 columns × 164 rows  →  1024 × 2624 px
//
//  Zone layout
//  ───────────────────────────────────────────────────────────
//  Rows   1–20  : ECHO VILLAGE
//  Rows  21–39  : SIGNAL MEADOW
//  Rows  40–55  : BROOKSIDE CROSSING
//  Rows  56–75  : NEON JUNCTION
//  Rows  76–91  : WHISPER GROVE
//  Rows  92–93  : FREQUENCY GATE
//  Rows  94–112 : FADING HIGHLANDS
//  Rows 113–116 : CAVE APPROACH
//  Rows 117–149 : VOID CAVE
//  Rows 150–162 : THE CORE
//  Row  163     : Bottom border
// ──────────────────────────────────────────────────────────────────────────────

export const MAP_COLS = 64;
export const MAP_ROWS = 164;
export const SIGNAL_START_ROW = 21;
export const BROOK_START_ROW = 40;
export const JUNCTION_START_ROW = 56;
export const GROVE_START_ROW = 76;
export const GATE_START_ROW = 92;
export const FADING_START_ROW = 94;
export const CAVE_START_ROW = 117;
export const CORE_START_ROW = 150;
export const BOSS_CORE_ROW = 156;
export const BOSS_CORE_COL = 32;
export const GATE_CENTER_COL = 32;

/** Tiles that stop movement; the gate, portal and bridge rails are handled separately. */
const BLOCKING_TILES = new Set<number>([
  W, K, H, R, I, J, V, E,
  TILE_ID.TREE, TILE_ID.BUILDING_WALL, TILE_ID.STONE_WALL, TILE_ID.WALL_WINDOW, TILE_ID.STONE_WINDOW,
]);

export const TERRAIN_REGIONS: TerrainRegions = {
  cols: MAP_COLS,
  rows: MAP_ROWS,
  caveStartRow: 113,
  junctionRows: [JUNCTION_START_ROW, GROVE_START_ROW],
  bridge: BROOK_BRIDGE,
  gateRows: [GATE_START_ROW, GATE_START_ROW + 1],
  borderCols: 4,
};

export interface MapBuildResult {
  walls:      Phaser.Physics.Arcade.StaticGroup;
  decorative: Phaser.GameObjects.Group;
  terrain:    TerrainLayer;
  worldWidth:  number;
  worldHeight: number;
  spawnX: number;
  spawnY: number;
  // NPC world positions
  npcPos:  { x: number; y: number };
  npc2Pos: { x: number; y: number };
  npc3Pos: { x: number; y: number };
  // Sign world positions
  signPos:  { x: number; y: number };
  sign2Pos: { x: number; y: number };
  // Key world positions
  gatePos:    { x: number; y: number };
  bossPos:    { x: number; y: number };
  universePortals: Array<{ x: number; y: number }>;
  // Fragment pickup positions
  fragment1Pos: { x: number; y: number };
  fragment2Pos: { x: number; y: number };
  fragment3Pos: { x: number; y: number };
  // Tall-grass encounter rectangles
  tallGrassZones: Phaser.Geom.Rectangle[];
  // Y-sorted foreground tufts animated when the player pushes through grass
  tallGrassFrontTiles: Phaser.GameObjects.Image[];
  // Boss chamber rune graphics (for destruction after boss defeat)
  runeGraphics: Phaser.GameObjects.GameObject[];
  // Cave props that swap to a purified texture when the corruption is cleansed.
  caveSurfaceTiles: Phaser.GameObjects.Image[];
  // Ash, fissures and hostile lights that disappear during purification.
  caveCorruptionObjects: Phaser.GameObjects.GameObject[];
  // Underground light sources (crystals, braziers, portal, core).
  lights: LightSource[];
}

/**
 * Single authoritative world pass for the expanded map. The structure follows
 * classic creature-RPG composition: civic landmarks around a town green,
 * routes that alternate pressure and release, a settlement with multiple exits,
 * and a cave made from rooms connected by short, legible corridors.
 */
function applyExpandedWorldLayout(grid: number[][]): void {
  const set = (row: number, col: number, tile: number) => {
    if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) grid[row][col] = tile;
  };
  const fill = (row1: number, col1: number, row2: number, col2: number, tile: number) => {
    for (let row = row1; row <= row2; row++) {
      for (let col = col1; col <= col2; col++) set(row, col, tile);
    }
  };
  const hLine = (row: number, col1: number, col2: number, tile: number) => fill(row, col1, row, col2, tile);
  const paintRoad = (rows: Array<[number, number, number?]>) => {
    rows.forEach(([row, center, halfWidth = 2]) => fill(row, center - halfWidth, row, center + halfWidth, P));
  };
  const paintGrass = (rows: Array<[number, number, number]>) => {
    rows.forEach(([row, left, right]) => fill(row, left, row, right, L));
  };
  const ellipse = (centerCol: number, centerRow: number, radiusCol: number, radiusRow: number, tile: number) => {
    for (let row = centerRow - radiusRow; row <= centerRow + radiusRow; row++) {
      for (let col = centerCol - radiusCol; col <= centerCol + radiusCol; col++) {
        const dx = (col - centerCol) / radiusCol;
        const dy = (row - centerRow) / radiusRow;
        if (dx * dx + dy * dy <= 1) set(row, col, tile);
      }
    }
  };

  // Reset the complete world so no legacy strip or cave pass survives.
  fill(0, 0, MAP_ROWS - 1, MAP_COLS - 1, _);
  hLine(0, 0, MAP_COLS - 1, W);
  hLine(MAP_ROWS - 1, 0, MAP_COLS - 1, K);
  fill(1, 0, CAVE_START_ROW - 1, 3, H);
  fill(1, MAP_COLS - 4, CAVE_START_ROW - 1, MAP_COLS - 1, H);

  // ECHO VILLAGE — a town green, five functions and side streets.
  fill(8, 19, 9, 44, P);
  fill(17, 19, 18, 44, P);
  fill(8, 19, 18, 21, P);
  fill(8, 42, 18, 44, P);
  fill(9, 30, 20, 33, P);
  fill(7, 22, 10, 31, P);      // Professor's lab forecourt
  fill(8, 10, 10, 20, P);      // Cottage lane
  fill(8, 43, 10, 51, P);      // Clinic lane
  fill(15, 13, 17, 20, P);     // Inn lane
  fill(15, 44, 17, 52, P);     // Workshop lane
  fill(11, 36, 15, 42, R);     // Village pond
  set(11, 36, _); set(15, 42, _); set(12, 42, _);
  for (const [row, col] of [
    [2, 13], [5, 13], [10, 6], [11, 16], [13, 18], [18, 8],
    [5, 42], [9, 55], [14, 46], [18, 48], [19, 27], [19, 38],
  ] as Array<[number, number]>) set(row, col, F);
  set(18, 36, S);

  // SIGNAL MEADOW — an S-route with grass choices, ledges and two clearings.
  paintGrass([
    [21, 7, 24], [22, 6, 25], [23, 5, 24], [24, 6, 22], [25, 7, 21],
    [26, 5, 18], [27, 5, 18], [28, 6, 20], [29, 7, 22], [30, 8, 23],
    [31, 5, 15], [32, 5, 18], [33, 6, 20], [34, 8, 22], [35, 10, 24],
    [36, 8, 22], [37, 7, 20], [38, 8, 22], [39, 11, 25],
    [21, 40, 56], [22, 39, 57], [23, 40, 58], [24, 42, 57], [25, 43, 56],
    [26, 45, 59], [27, 43, 59], [28, 41, 57], [29, 39, 55], [30, 38, 54],
    [31, 45, 58], [32, 42, 58], [33, 40, 57], [34, 39, 55], [35, 38, 53],
    [36, 41, 56], [37, 43, 58], [38, 41, 57], [39, 39, 54],
  ]);
  paintRoad([
    [20, 32], [21, 32], [22, 31], [23, 29], [24, 27], [25, 25],
    [26, 23], [27, 22], [28, 23], [29, 25], [30, 28], [31, 31],
    [32, 34], [33, 36], [34, 38], [35, 39], [36, 38], [37, 36],
    [38, 34], [39, 32],
  ]);
  fill(28, 12, 30, 25, P);     // fragment clearing and optional detour
  fill(23, 35, 25, 45, P);     // east overlook
  hLine(31, 4, 16, W); hLine(31, 21, 27, W);
  hLine(34, 45, 51, W); hLine(34, 56, 59, W);
  set(25, 43, S);

  // BROOKSIDE CROSSING — a river landmark, bridge and inhabited side loop.
  fill(BROOK_START_ROW, 29, 44, 34, P);
  fill(45, 4, 48, 59, R);
  fill(BROOK_BRIDGE.top, BROOK_BRIDGE.left, BROOK_BRIDGE.bottom, BROOK_BRIDGE.right, P);
  paintRoad([
    [49, 32], [50, 35], [51, 39], [52, 43], [53, 42], [54, 38], [55, 34],
  ]);
  fill(42, 34, 44, 49, P);     // hut branch
  fill(51, 42, 53, 54, P);     // fragment riverbank pocket
  fill(49, 9, 51, 25, P);      // western picnic loop
  fill(50, 23, 53, 26, P);
  for (const [row, col] of [
    [41, 12], [42, 20], [43, 42], [44, 10], [44, 55], [49, 7],
    [50, 17], [51, 56], [53, 9], [54, 20], [54, 49],
  ] as Array<[number, number]>) set(row, col, F);

  // NEON JUNCTION — station, plaza, services and four readable exits.
  fill(63, 28, 75, 35, P);
  fill(64, 16, 73, 47, P);
  fill(64, 16, 66, 52, P);
  fill(71, 10, 73, 53, P);
  fill(61, 12, 66, 18, P);
  fill(61, 46, 66, 52, P);
  fill(68, 12, 72, 18, P);
  fill(68, 46, 72, 52, P);
  // Doorstep lanes follow the smaller Junction buildings' new footprints.
  fill(64, 9, 65, 17, P);
  fill(64, 47, 65, 54, P);
  fill(74, 48, 74, 54, P);
  fill(66, 22, 69, 25, R); fill(66, 38, 69, 41, R);
  for (const [row, col] of [
    [63, 15], [63, 48], [66, 19], [66, 44], [69, 20], [69, 43],
    [72, 14], [72, 49], [74, 22], [74, 41],
  ] as Array<[number, number]>) set(row, col, F);

  // WHISPER GROVE — split path around a shrine, then a quiet gate approach.
  paintGrass([
    [76, 6, 20], [77, 5, 19], [78, 15, 23], [79, 16, 24],
    [80, 17, 25], [81, 18, 26], [82, 17, 25], [83, 16, 24],
    [84, 15, 23], [85, 14, 22], [86, 13, 21], [87, 12, 20],
    [76, 44, 58], [77, 45, 59], [78, 41, 50], [79, 40, 48],
    [80, 39, 47], [81, 38, 46], [82, 39, 47], [83, 40, 48],
    [84, 41, 49], [85, 42, 51], [86, 43, 53], [87, 44, 54],
  ]);
  paintRoad([
    [76, 32], [77, 30], [78, 27], [79, 25], [80, 24], [81, 25],
    [82, 28], [83, 31], [84, 35], [85, 38], [86, 39], [87, 38],
    [88, 36], [89, 34], [90, 32], [91, 32],
  ]);
  fill(82, 13, 84, 27, P);     // archive shrine lane
  fill(85, 38, 87, 52, P);     // ranger post lane
  hLine(87, 4, 13, W); hLine(88, 49, 59, W);
  set(89, 28, S);

  // FREQUENCY GATE — a landmark transition, not a full-zone wall texture.
  fill(GATE_START_ROW, 4, GATE_START_ROW + 1, MAP_COLS - 5, W);
  fill(GATE_START_ROW, GATE_CENTER_COL - 2, GATE_START_ROW + 1, GATE_CENTER_COL + 1, G);

  // FADING HIGHLANDS — exposed switchbacks, ledges and a final fragment alcove.
  paintGrass([
    [94, 7, 23], [95, 6, 22], [96, 5, 20], [97, 6, 18], [98, 8, 17],
    [99, 6, 14], [100, 5, 14], [101, 5, 16], [102, 6, 18], [103, 7, 18],
    [104, 8, 19], [105, 9, 21], [106, 7, 20], [107, 6, 18], [108, 8, 21],
    [109, 10, 23], [110, 12, 25], [111, 14, 25], [112, 16, 26],
    [94, 41, 57], [95, 42, 58], [96, 44, 59], [97, 46, 58], [98, 47, 56],
    [99, 49, 59], [100, 49, 58], [101, 47, 58], [102, 45, 57], [103, 44, 56],
    [104, 43, 55], [105, 41, 54], [106, 44, 57], [107, 46, 58], [108, 43, 56],
    [109, 41, 54], [110, 39, 52], [111, 39, 50], [112, 38, 48],
  ]);
  paintRoad([
    [94, 32], [95, 31], [96, 28], [97, 25], [98, 22], [99, 20],
    [100, 19], [101, 21], [102, 24], [103, 27], [104, 31], [105, 35],
    [106, 39], [107, 41], [108, 39], [109, 36], [110, 34], [111, 32], [112, 32],
  ]);
  fill(102, 11, 104, 26, P);   // fragment alcove
  hLine(97, 4, 17, W); hLine(100, 44, 59, W);
  hLine(106, 5, 17, W); hLine(108, 48, 59, W);
  set(101, 14, S);

  // Cave threshold and exterior mouth.
  fill(113, 4, 116, MAP_COLS - 5, K);
  fill(113, 27, 116, 36, C);
  fill(112, 29, 112, 34, P);

  // Building footprints are always laid last in the overworld.
  OVERWORLD_LANDMARK_COLLIDERS.forEach(({ row1, col1, row2, col2 }) => {
    fill(row1, col1, row2, col2, H);
  });

  // VOID CAVE — five chambers, two optional branches and a guaranteed spine.
  fill(CAVE_START_ROW, 0, CORE_START_ROW - 1, MAP_COLS - 1, K);
  fill(117, 29, 122, 34, C);
  ellipse(32, 123, 10, 5, C);                // entrance chamber
  fill(122, 14, 125, 31, C);
  ellipse(14, 128, 9, 6, C);                 // west echo chamber
  fill(122, 33, 125, 51, C);
  ellipse(51, 127, 9, 6, C);                 // universe portal chamber
  fill(126, 29, 137, 35, C);
  ellipse(32, 136, 11, 7, C);                // central descending room
  fill(135, 14, 139, 31, C);
  ellipse(14, 141, 9, 6, C);                 // west lower vault
  fill(136, 34, 141, 50, C);
  ellipse(50, 140, 9, 6, C);                 // east lower vault
  fill(140, 28, 149, 36, C);
  ellipse(32, 146, 13, 4, C);                // Core antechamber

  // The former eastern pool is a dry approach to the sealed universe portal.
  ellipse(53, 127, 4, 3, C);
  fill(125, 47, 130, 49, C);
  ellipse(10, 142, 3, 2, I);
  fill(139, 13, 145, 15, C);

  // Stairs imply floor changes while keeping movement continuous.
  fill(132, 31, 133, 33, Z);
  fill(143, 30, 144, 34, Z);

  for (const [row, col] of [
    [119, 27], [119, 36], [123, 22], [124, 41], [126, 7], [129, 21],
    [131, 47], [133, 25], [135, 39], [139, 7], [141, 23], [143, 45],
  ] as Array<[number, number]>) set(row, col, X);
  for (const [row, col] of [
    [125, 10], [130, 17], [124, 55], [131, 54], [136, 24], [137, 40],
    [142, 19], [143, 52], [147, 23], [147, 41],
  ] as Array<[number, number]>) set(row, col, E);
  for (const [row, col] of [
    [121, 25], [121, 38], [127, 24], [127, 40], [137, 20], [138, 44],
    [145, 20], [145, 44], [148, 24], [148, 40],
  ] as Array<[number, number]>) set(row, col, J);
  for (const [row, col] of [
    [117, 28], [117, 35], [122, 20], [122, 43], [133, 20], [133, 44],
    [139, 24], [140, 40], [147, 19], [147, 45],
  ] as Array<[number, number]>) set(row, col, N);
  for (const [row, col] of [
    [120, 26], [124, 5], [124, 58], [134, 21], [135, 43], [140, 4], [141, 59], [148, 18], [148, 46],
  ] as Array<[number, number]>) set(row, col, V);
  for (const [row, col] of [
    [129, 8], [129, 19], [128, 45], [141, 18], [139, 47], [146, 25], [146, 39],
  ] as Array<[number, number]>) set(row, col, Q2);
  set(129, 53, PORTAL);

  // THE CORE — a broad elliptical arena with one dramatic entrance.
  fill(CORE_START_ROW, 0, MAP_ROWS - 1, MAP_COLS - 1, K);
  fill(CORE_START_ROW, 28, CORE_START_ROW + 1, 36, C);
  ellipse(BOSS_CORE_COL, BOSS_CORE_ROW, 20, 7, A);
  fill(CORE_START_ROW, 29, CORE_START_ROW + 3, 35, A);
  set(160, 13, Q2); set(160, 51, Q2);
  hLine(MAP_ROWS - 1, 0, MAP_COLS - 1, K);
}

/** The authored world grid, shared by the playable scene and the map editor. */
function createAuthoredGrid(): number[][] {
  const grid: number[][] = Array.from({ length: MAP_ROWS }, () => new Array(MAP_COLS).fill(_));
  applyExpandedWorldLayout(grid);
  return grid;
}

/** True for a full-size grid of known tile ids, as saved or imported by the world editor. */
export function isValidGrid(value: unknown): value is number[][] {
  return Array.isArray(value) && value.length === MAP_ROWS
    && value.every(row => Array.isArray(row) && row.length === MAP_COLS
      && row.every(tile => Number.isInteger(tile) && TILE_TYPE_MAP.has(tile)));
}

/** A map saved by the world editor replaces the authored layout for one load. */
function applyEditorOverride(grid: number[][]): void {
  const saved = localStorage.getItem('editor-map');
  if (!saved) return;
  try {
    const editorGrid: unknown = JSON.parse(saved);
    if (isValidGrid(editorGrid)) {
      for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++) grid[r][c] = editorGrid[r][c];
    }
  } catch { /* ignore malformed data */ }
  localStorage.removeItem('editor-map');
}

/**
 * Static collision as merged rectangles instead of one body per tile: the
 * union is identical, but the physics world holds a few hundred bodies.
 */
function addCollision(scene: Phaser.Scene, grid: number[][], walls: Phaser.Physics.Arcade.StaticGroup): void {
  const blocked = (r: number, c: number) => BLOCKING_TILES.has(grid[r][c]);
  const open = new Map<string, { row: number; col1: number; col2: number; rows: number }>();
  const finished: Array<{ row: number; col1: number; col2: number; rows: number }> = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    const runs: Array<[number, number]> = [];
    for (let col = 0; col < MAP_COLS; col++) {
      if (!blocked(row, col)) continue;
      const start = col;
      while (col + 1 < MAP_COLS && blocked(row, col + 1)) col++;
      runs.push([start, col]);
    }
    const next = new Map<string, { row: number; col1: number; col2: number; rows: number }>();
    runs.forEach(([col1, col2]) => {
      const key = `${col1}:${col2}`;
      const rect = open.get(key);
      if (rect) { rect.rows++; next.set(key, rect); open.delete(key); }
      else next.set(key, { row, col1, col2, rows: 1 });
    });
    open.forEach(rect => finished.push(rect));
    open.clear();
    next.forEach((rect, key) => open.set(key, rect));
  }
  open.forEach(rect => finished.push(rect));

  finished.forEach(({ row, col1, col2, rows }) => {
    const width = (col2 - col1 + 1) * TILE;
    const height = rows * TILE;
    walls.add(scene.add.zone(col1 * TILE + width / 2, row * TILE + height / 2, width, height).setName('terrain-blocker'));
  });

  // Gate doors stay individually removable when the Frequency Gate opens.
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (grid[row][col] !== G) continue;
      walls.add(scene.add.zone(col * TILE + TILE / 2, row * TILE + TILE / 2, TILE, TILE).setName('gate-blocker'));
    }
  }
}

export class MapBuilder {
  static build(scene: Phaser.Scene): MapBuildResult {
    const worldWidth  = MAP_COLS * TILE;
    const worldHeight = MAP_ROWS * TILE;

    scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    const grid = createAuthoredGrid();
    applyEditorOverride(grid);

    const walls = scene.physics.add.staticGroup();
    const decorative = scene.add.group();

    const terrain = createTerrainLayer(scene, grid, TERRAIN_REGIONS, TILE);
    decorative.add(terrain.shader);
    addCollision(scene, grid, walls);

    const dressing = dressWorld(scene, grid, {
      tile: TILE,
      cols: MAP_COLS,
      rows: MAP_ROWS,
      walls,
      decorative,
      bridge: BROOK_BRIDGE,
      zoneRows: {
        signal: SIGNAL_START_ROW,
        brook: BROOK_START_ROW,
        junction: JUNCTION_START_ROW,
        grove: GROVE_START_ROW,
        gate: GATE_START_ROW,
        fading: FADING_START_ROW,
        cave: CAVE_START_ROW,
        core: CORE_START_ROW,
      },
      gateCenterCol: GATE_CENTER_COL,
      bossCore: { col: BOSS_CORE_COL, row: BOSS_CORE_ROW },
    });

    walls.refresh();

    // ── Named positions ───────────────────────────────────────────────────────
    const px = (col: number) => col * TILE + TILE / 2;
    const py = (row: number) => row * TILE + TILE / 2;

    const spawnX = px(32);  // Echo Village central green
    const spawnY = py(15);

    // NPCs now occupy deliberate plaza and gate beats.
    const npcPos  = { x: px(28), y: py(11) };
    const npc2Pos = { x: px(31), y: py(70) };
    const npc3Pos = { x: px(44), y: py(67) };

    // Signs
    const signPos  = { x: px(36), y: py(18) };
    const sign2Pos = { x: px(28), y: py(89) };

    // Gate centre
    const gatePos = { x: px(GATE_CENTER_COL), y: py(GATE_START_ROW) };
    const bossPos = { x: BOSS_CORE_COL * TILE, y: BOSS_CORE_ROW * TILE };

    // Sound fragments
    const fragment1Pos = { x: px(13), y: py(29) };  // Signal Meadow west clearing
    const fragment2Pos = { x: px(51), y: py(52) };  // Brookside riverbank
    const fragment3Pos = { x: px(12), y: py(103) }; // Fading Highlands alcove

    // Tall grass zones (pixels)
    const tallGrassZones: Phaser.Geom.Rectangle[] = [
      new Phaser.Geom.Rectangle( 4 * TILE, 21 * TILE, 24 * TILE, 19 * TILE),
      new Phaser.Geom.Rectangle(37 * TILE, 21 * TILE, 23 * TILE, 19 * TILE),
      new Phaser.Geom.Rectangle( 4 * TILE, 76 * TILE, 23 * TILE, 12 * TILE),
      new Phaser.Geom.Rectangle(37 * TILE, 76 * TILE, 23 * TILE, 12 * TILE),
      new Phaser.Geom.Rectangle( 4 * TILE, 94 * TILE, 24 * TILE, 19 * TILE),
      new Phaser.Geom.Rectangle(37 * TILE, 94 * TILE, 23 * TILE, 19 * TILE),
    ];

    return {
      walls, decorative, terrain, worldWidth, worldHeight,
      spawnX, spawnY,
      npcPos, npc2Pos, npc3Pos,
      signPos, sign2Pos,
      gatePos, bossPos, universePortals: dressing.universePortals,
      fragment1Pos, fragment2Pos, fragment3Pos,
      tallGrassZones, tallGrassFrontTiles: dressing.tallGrassFrontTiles,
      runeGraphics: dressing.runeGraphics,
      caveSurfaceTiles: dressing.caveSurfaceTiles,
      caveCorruptionObjects: dressing.caveCorruptionObjects,
      lights: dressing.lights,
    };
  }

  // ── Grid-only build (used by the map editor) ────────────────────────────
  static buildGridOnly(): number[][] {
    return createAuthoredGrid();
  }
}
