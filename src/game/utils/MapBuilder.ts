import Phaser from 'phaser';
import {
  OVERWORLD_LANDMARK_COLLIDERS,
  renderPokemonOverworld,
} from '../maps/PokemonOverworld';

const TILE = 16;

/* eslint-disable @typescript-eslint/no-unused-vars */
const _ = 0;   // grass (background colour, no sprite)
const P = 1;   // path (tan dirt)
const W = 2;   // wall / cliff (collision)
const A = 3;   // arena floor
const G = 4;   // gate (locked, collision)
const S = 6;   // sign marker (decorative)
const R = 7;   // water (decorative)
const T = 8;   // tree top (collision)
const U = 9;   // tree trunk (decorative)
const L = 10;  // tall grass (walkable, encounter zone)
const B = 11;  // building wall (collision)
const O = 12;  // building roof (decorative)
const D = 13;  // building door (decorative)
const F = 14;  // flower (decorative)
const C = 15;  // cave floor (walkable)
const K = 16;  // cave wall / rock (collision)
const X = 17;  // crystal (decorative)
const B2 = 18; // stone building wall (Neon Junction) — collision
const O2 = 19; // blue roof — decorative
const O3 = 20; // gray roof — decorative
const D2 = 21; // iron door — decorative
const BW = 22; // building wall with window (collision) — wood
const SW = 23; // stone building wall with window (collision)
const J  = 24; // pillar / standing stone (collision)
const V  = 25; // wall rune (decorative)
const Q2 = 26; // skull / bone decoration (decorative)
const N  = 27; // stalactite (decorative, depth 2)
const H  = 28; // invisible collision beneath authored overworld landmarks
const I  = 29; // underground water (collision)
const Z  = 30; // underground stone stairs (walkable)
const E  = 31; // underground boulder (collision)
/* eslint-enable @typescript-eslint/no-unused-vars */

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

export interface MapBuildResult {
  walls:      Phaser.Physics.Arcade.StaticGroup;
  decorative: Phaser.GameObjects.Group;
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
  // Cave surfaces transition in sequence when the boss corruption is cleansed.
  caveSurfaceTiles: Phaser.GameObjects.Image[];
  // Ash, fissures and hostile lights that disappear during purification.
  caveCorruptionObjects: Phaser.GameObjects.GameObject[];
}

/**
 * Authoritative overworld pass.
 *
 * The semantic grid is intentionally independent from the landmark artwork:
 * paths, encounter grass and progression remain easy to reason about, while
 * complete buildings and tree groups are rendered by PokemonOverworld.ts.
 */
function applyPokemonOverworldLayout(grid: number[][]): void {
  const set = (row: number, col: number, tile: number) => {
    if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) grid[row][col] = tile;
  };
  const fill = (row1: number, col1: number, row2: number, col2: number, tile: number) => {
    for (let row = row1; row <= row2; row++) {
      for (let col = col1; col <= col2; col++) set(row, col, tile);
    }
  };
  const paintRoad = (rows: Array<[number, number, number?]>) => {
    rows.forEach(([row, center, halfWidth = 1]) => {
      fill(row, center - halfWidth, row, center + halfWidth, P);
    });
  };
  const paintGrass = (rows: Array<[number, number, number]>) => {
    rows.forEach(([row, left, right]) => fill(row, left, row, right, L));
  };

  // Discard the old corridor-shaped overworld while leaving cave rows intact.
  fill(1, 0, 53, MAP_COLS - 1, _);
  fill(1, 0, 51, 0, H);
  fill(1, MAP_COLS - 1, 51, MAP_COLS - 1, H);

  // Echo Village: a compact loop frames a green instead of becoming one slab.
  fill(6, 16, 7, 31, P);
  fill(10, 16, 11, 31, P);
  fill(6, 16, 11, 18, P);
  fill(6, 29, 11, 31, P);
  fill(8, 12, 9, 17, P);
  fill(8, 31, 9, 34, P);
  paintRoad([[10, 25], [11, 25], [12, 24], [13, 24]]);
  set(10, 19, S);
  for (const [row, col] of [
    [4, 18], [4, 28], [6, 33], [10, 12], [11, 32], [11, 41], [12, 18],
  ] as Array<[number, number]>) set(row, col, F);

  // Signal Path: several grass pockets wrap around a three-tile S-curve.
  paintGrass([
    [14, 10, 18], [15, 8, 19], [16, 7, 19], [17, 8, 18], [18, 10, 17],
    [19, 5, 13], [20, 3, 14], [21, 3, 13], [22, 4, 14], [23, 6, 12],
    [20, 17, 20], [21, 16, 21], [22, 17, 21], [23, 18, 20],
    [15, 32, 40], [16, 30, 42], [17, 30, 42], [18, 32, 40],
    [19, 28, 33], [19, 38, 42], [20, 27, 33], [20, 38, 43],
    [21, 28, 33], [21, 38, 43], [22, 29, 34], [22, 37, 42],
    [23, 32, 41], [24, 35, 39],
  ]);
  paintRoad([
    [13, 24], [14, 24], [15, 24], [16, 23], [17, 22], [18, 22],
    [19, 23], [20, 24], [21, 25], [22, 27], [23, 28], [24, 27],
    [25, 25], [26, 24],
  ]);
  fill(17, 12, 17, 21, P);
  fill(16, 10, 18, 14, P);
  fill(20, 25, 20, 36, P);
  fill(19, 34, 21, 37, P);
  set(15, 18, S);

  // Neon Junction: a station loop leaves a green breathing space in its core.
  fill(27, 23, 27, 25, P);
  fill(28, 18, 29, 31, P);
  fill(34, 17, 35, 31, P);
  fill(28, 17, 35, 19, P);
  fill(28, 29, 35, 31, P);
  fill(32, 13, 33, 18, P);
  fill(32, 30, 33, 36, P);
  fill(35, 19, 36, 23, P);
  set(35, 16, S);
  for (const [row, col] of [
    [27, 13], [28, 40], [30, 22], [30, 26], [32, 22], [32, 26],
    [34, 9], [35, 11], [34, 38], [35, 39],
  ] as Array<[number, number]>) set(row, col, F);

  // Frequency Gate: the authored door remains on its original progression row.
  fill(37, 1, 37, 46, W);
  fill(37, 19, 37, 22, G);
  fill(38, 1, 38, 46, W);
  fill(38, 19, 38, 22, G);

  // Fading Path: a real switchback builds tension and creates a fragment alcove.
  paintGrass([
    [39, 7, 13], [40, 5, 14], [41, 4, 14], [42, 3, 7], [42, 12, 14],
    [43, 3, 7], [43, 12, 14], [44, 4, 8], [45, 4, 9], [46, 3, 10],
    [47, 4, 10], [47, 14, 19], [48, 5, 9], [48, 12, 20],
    [49, 6, 9], [49, 12, 20], [50, 13, 20], [51, 15, 19],
    [39, 31, 37], [40, 29, 39], [41, 28, 40], [42, 29, 40], [43, 31, 38],
    [44, 37, 42], [45, 35, 43], [46, 34, 43], [47, 35, 43],
    [48, 36, 42], [49, 30, 38], [50, 29, 39], [51, 31, 37],
  ]);
  paintRoad([
    [39, 21], [40, 20], [41, 19], [42, 17], [43, 16], [44, 18],
    [45, 21], [46, 24], [47, 27], [48, 27], [49, 25], [50, 23],
    [51, 21],
  ]);
  fill(43, 10, 43, 15, P);
  fill(42, 8, 44, 11, P);
  set(48, 33, S);

  // Cave threshold widens naturally before closing into the existing dungeon.
  fill(52, 1, 53, 46, K);
  fill(52, 15, 53, 26, C);
  fill(51, 19, 51, 23, P);

  // Complete landmarks own their collision footprint without exposing block art.
  OVERWORLD_LANDMARK_COLLIDERS.forEach(({ row1, col1, row2, col2 }) => {
    fill(row1, col1, row2, col2, H);
  });
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
  fill(44, 28, 49, 35, P);     // broad timber bridge footprint
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
  ellipse(51, 127, 9, 6, C);                 // crystal pool chamber
  fill(126, 29, 137, 35, C);
  ellipse(32, 136, 11, 7, C);                // central descending room
  fill(135, 14, 139, 31, C);
  ellipse(14, 141, 9, 6, C);                 // west lower vault
  fill(136, 34, 141, 50, C);
  ellipse(50, 140, 9, 6, C);                 // east lower vault
  fill(140, 28, 149, 36, C);
  ellipse(32, 146, 13, 4, C);                // Core antechamber

  // Underground lakes stay at room edges and create loops, not dead ends.
  ellipse(53, 127, 4, 3, I);
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

  // THE CORE — a broad elliptical arena with one dramatic entrance.
  fill(CORE_START_ROW, 0, MAP_ROWS - 1, MAP_COLS - 1, K);
  fill(CORE_START_ROW, 28, CORE_START_ROW + 1, 36, C);
  ellipse(BOSS_CORE_COL, BOSS_CORE_ROW, 20, 7, A);
  fill(CORE_START_ROW, 29, CORE_START_ROW + 3, 35, A);
  set(160, 13, Q2); set(160, 51, Q2);
  hLine(MAP_ROWS - 1, 0, MAP_COLS - 1, K);
}

export class MapBuilder {
  static build(scene: Phaser.Scene): MapBuildResult {
    const worldWidth  = MAP_COLS * TILE;   // 768
    const worldHeight = MAP_ROWS * TILE;   // 1504

    scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // ── Build tile grid programmatically ─────────────────────────────────────
    const grid: number[][] = Array.from(
      { length: MAP_ROWS },
      () => new Array(MAP_COLS).fill(_)
    );

    const set = (r: number, c: number, t: number) => {
      if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) grid[r][c] = t;
    };
    const fill = (r1: number, c1: number, r2: number, c2: number, t: number) => {
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++) set(r, c, t);
    };
    const hLine = (row: number, c1: number, c2: number, t: number) => fill(row, c1, row, c2, t);
    const vLine = (col: number, r1: number, r2: number, t: number) => fill(r1, col, r2, col, t);

    // ── BORDER ───────────────────────────────────────────────────────────────
    hLine(0,           0, MAP_COLS - 1, W);
    hLine(MAP_ROWS - 1, 0, MAP_COLS - 1, W);
    vLine(0,           0, MAP_ROWS - 1, W);
    vLine(MAP_COLS - 1, 0, MAP_ROWS - 1, W);

    // ── MAIN PATH (cols 19–22 through all open-world zones) ─────────────────
    fill(1, 19, 51, 22, P);

    // ═════════════════════════════════════════════════════════════════════════
    //  ZONE 1 — ECHO VILLAGE  (rows 1–11)
    // ═════════════════════════════════════════════════════════════════════════

    // House 1 — "Bard's Cottage" (compact 3-wide body, brown roof overhang)
    hLine(2, 2, 6, O);
    set(3, 3, BW); set(3, 4, B); set(3, 5, BW);
    set(4, 3, B);  set(4, 4, D); set(4, 5, B);

    // House 2 — "Muse's Study" (5-wide body, blue roof overhang)
    hLine(2, 9, 15, O2);
    set(3, 10, BW); set(3, 11, B); set(3, 12, B); set(3, 13, B); set(3, 14, BW);
    set(4, 10, B);  set(4, 11, BW); set(4, 12, D); set(4, 13, BW); set(4, 14, B);

    // House 3 — "Workshop" (compact 3-wide body, brown roof)
    hLine(8, 2, 6, O);
    set(9, 3, BW); set(9, 4, B); set(9, 5, BW);
    set(10, 3, B);  set(10, 4, D); set(10, 5, B);

    // House 4 — "Lakeside Cabin" (near pond, 3-wide body, brown roof)
    hLine(2, 33, 37, O);
    set(3, 34, BW); set(3, 35, B); set(3, 36, BW);
    set(4, 34, B);  set(4, 35, D); set(4, 36, B);

    // Decorative pond (rows 2–5, cols 24–30)
    fill(2, 24, 5, 30, R);

    // Village walkways (connect houses to main path)
    hLine(5, 4, 18, P);
    hLine(11, 4, 18, P);

    // Flowers — around buildings and village green
    for (const [r, c] of [
      [1,3],[1,6],[3,2],[3,6],            // House 1
      [1,10],[1,14],[3,9],[3,15],         // House 2
      [8,7],[9,7],[8,1],[9,1],            // House 3
      [1,34],[1,36],[3,32],[3,38],        // House 4
      [6,1],[6,8],[6,17],[7,1],[7,17],    // village green
      [7,36],[4,31],                      // near pond
    ] as [number,number][]) set(r, c, F);

    // Sign (village)
    set(9, 17, S);

    // ── Village exit tree border ─────────────────────────────────────────────
    for (let c = 1; c <= 46; c++) {
      if (c < 19 || c > 22) { set(12, c, T); set(13, c, U); }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  ZONE 2 — SIGNAL PATH  (rows 14–24)
    // ═════════════════════════════════════════════════════════════════════════

    // Hard tree edge columns
    fill(14, 1, 24, 2, T);
    fill(14, 45, 24, 46, T);

    // Tall grass — left flank
    fill(14, 3, 24, 17, L);
    // Tall grass — right flank
    fill(14, 23, 24, 44, L);

    // Small open nook left (row 18–19, cols 8–10) — leads to Fragment 1
    fill(18, 8, 19, 10, _);
    // Small open nook right (row 20–21, cols 32–35) — leads to Fragment 2
    fill(20, 32, 21, 35, _);

    // Landmark: broken speaker stone  (decorative sign tile)
    set(16, 13, S);

    // ── Route → Neon Junction tree border ────────────────────────────────────
    for (let c = 1; c <= 46; c++) {
      if (c < 19 || c > 22) { set(25, c, T); set(26, c, U); }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  ZONE 3 — NEON JUNCTION  (rows 27–36)
    // ═════════════════════════════════════════════════════════════════════════

    // Building A — "Junction Inn" (compact 5-wide body, gray roof overhang)
    hLine(27, 2, 8, O3);
    set(28, 3, SW); set(28, 4, B2); set(28, 5, B2); set(28, 6, B2); set(28, 7, SW);
    set(29, 3, B2); set(29, 4, B2); set(29, 5, D2); set(29, 6, B2); set(29, 7, B2);

    // Building B — "Signal Station" (compact 5-wide body, gray roof overhang)
    hLine(27, 28, 34, O3);
    set(28, 29, SW); set(28, 30, B2); set(28, 31, B2); set(28, 32, B2); set(28, 33, SW);
    set(29, 29, B2); set(29, 30, B2); set(29, 31, D2); set(29, 32, B2); set(29, 33, B2);

    // Building C — guard post (compact 3-wide body, gray roof)
    hLine(33, 38, 42, O3);
    set(34, 39, B2); set(34, 40, SW); set(34, 41, B2);
    set(35, 39, B2); set(35, 40, D2); set(35, 41, B2);

    // Building D — storage shed (compact 3-wide body, gray roof)
    hLine(33, 2, 6, O3);
    set(34, 3, B2); set(34, 4, SW); set(34, 5, B2);
    set(35, 3, B2); set(35, 4, D2); set(35, 5, B2);

    // Junction walkway (connects top buildings via main path)
    hLine(30, 5, 31, P);

    // Town flowers and decorative details
    for (const [r, c] of [
      [28,2],[28,8],[31,3],[31,7],          // Building A
      [28,28],[28,34],[31,29],[31,33],       // Building B
      [34,2],[34,6],[36,3],[36,5],           // Building D
      [34,38],[34,42],[36,39],[36,41],       // Building C
      [32,14],[33,14],[32,25],[33,24],       // open area
    ] as [number,number][]) set(r, c, F);

    // Sign in Neon Junction (warns of danger ahead)
    set(35, 17, S);

    // ── FREQUENCY GATE  (rows 37–38) ─────────────────────────────────────────
    hLine(37, 1, 46, W);
    fill(37, 19, 37, 22, G);
    hLine(38, 1, 46, W);
    fill(38, 19, 38, 22, G);

    // ═════════════════════════════════════════════════════════════════════════
    //  ZONE 4 — FADING PATH  (rows 39–50)
    // ═════════════════════════════════════════════════════════════════════════

    // Restore main path after gate wall
    fill(39, 19, 51, 22, P);

    // Hard rocky edges (narrower feel)
    fill(39, 1, 51, 2, W);
    fill(39, 45, 51, 46, W);

    // Tall grass — slightly denser, darker (same tile but zone bg is dark)
    fill(39, 3, 51, 17, L);
    fill(39, 23, 51, 44, L);

    // Rocky outcrops narrowing the grass at rows 45–47
    fill(45, 3, 47, 4, W);
    fill(45, 43, 47, 44, W);

    // Environmental landmark: silent stone marker
    set(43, 12, S);

    // ── Cave approach  (rows 51–53) ───────────────────────────────────────────
    // Tree-like rocky border row before cave
    for (let c = 1; c <= 46; c++) {
      if (c < 19 || c > 22) set(51, c, T);
    }
    for (let c = 1; c <= 46; c++) {
      if (c < 15 || c > 26) set(52, c, K);
    }
    // Cave floor starts in approach passage
    fill(52, 15, 53, 26, C);
    fill(52, 19, 53, 22, C);  // reinforce path as cave floor

    // Authoritative second pass: discard the legacy strip-shaped overworld.
    applyPokemonOverworldLayout(grid);

    // ═════════════════════════════════════════════════════════════════════════
    //  ZONE 5 — VOID CAVE  (legacy compact pass; expanded below)
    // ═════════════════════════════════════════════════════════════════════════

    // Full-width cave walls as default for this section
    fill(54, 1, 68, 46, K);

    // Organic passage shape — widens, narrows, then fans into boss ante-room
    const passageShape: [number, number, number][] = [
      [54, 12, 35], [55, 11, 36], [56, 10, 35],  // wide entry
      [57, 11, 34], [58, 13, 35], [59, 14, 34],  // mid-wide
      [60, 15, 32], [61, 14, 31], [62, 15, 32], [63, 16, 31], // choke-point
      [64, 10, 37], [65, 9, 38], [66, 8, 38], [67, 8, 39], [68, 7, 39], // fan open
    ];
    passageShape.forEach(([r, cL, cR]) => fill(r, cL, r, cR, C));

    // Stone pillar pairs flanking the inner gate (rows 67–68)
    set(67, 11, J); set(67, 12, J); set(67, 35, J); set(67, 36, J);
    set(68, 11, J); set(68, 12, J); set(68, 35, J); set(68, 36, J);

    // Wall rune tiles carved into cave-wall faces
    set(57, 9, V);  set(57, 37, V);
    set(63, 15, V); set(63, 32, V);
    set(66, 6, V);  set(66, 40, V);

    // Stalactites dangling into the passage from wall edges
    for (const [r, c] of [
      [54, 13], [54, 34], [55, 12], [55, 35], [56, 11],
      [57, 11], [57, 34], [58, 14], [59, 15],
    ] as [number, number][]) set(r, c, N);
    for (const [r, c] of [
      [60, 16], [61, 15], [62, 15], [63, 16],
      [60, 32], [61, 31], [62, 32], [63, 31],
    ] as [number, number][]) set(r, c, N);

    // Skull / bone decorations at pillar bases and gate approach
    set(68, 13, Q2); set(68, 34, Q2);

    // Crystals — dramatically repositioned (asymmetric clusters)
    for (const [r, c] of [
      [55, 10], [55, 36],        // entry alcoves
      [56, 10], [58, 36],        // wall pockets
      [61, 13], [62, 33],        // choke zone
      [64, 9],  [65, 38],        // fan zone
      [66, 8],  [67, 38],
      [69, 14], [69, 33],        // arena ante-room
    ] as [number, number][]) set(r, c, X);

    // ═════════════════════════════════════════════════════════════════════════
    //  ZONE 6 — THE CORE  (legacy compact pass; expanded below)
    // ═════════════════════════════════════════════════════════════════════════

    // Entry wall with wider opening (matches fanned passage)
    hLine(69, 1, 46, K);
    fill(69, 13, 69, 34, C);

    // Quasi-elliptical boss arena floor — curved walls instead of a rectangle
    const arenaRows: [number, number, number][] = [
      [70, 12, 35],
      [71, 8,  39],
      [72, 7,  40],
      [73, 7,  40],
      [74, 8,  39],
      [75, 9,  38],
      [76, 11, 36],
      [77, 14, 33],
    ];
    arenaRows.forEach(([r, cL, cR]) => {
      fill(r, cL, r, cR, A);
      fill(r, 1, r, cL - 1, K);
      fill(r, cR + 1, r, 46, K);
    });

    // Skull decorations at the deep arena back-wall corners
    set(76, 9, Q2); set(76, 38, Q2);

    // Bottom border above world edge
    hLine(78, 1, 46, K);
    hLine(79, 1, 46, K);

    // Expanded finale layout. This second pass replaces the compact legacy cave
    // above while keeping the preceding open-world zones untouched.
    fill(54, 1, 91, 46, K);
    fill(54, 12, 57, 35, C);
    fill(57, 18, 61, 24, C);
    fill(60, 7, 63, 24, C);
    fill(62, 5, 67, 15, C);
    fill(65, 11, 67, 38, C);
    fill(64, 32, 70, 41, C);
    fill(68, 35, 74, 40, C);
    fill(72, 12, 74, 38, C);
    fill(70, 9, 76, 20, C);
    fill(74, 14, 79, 19, C);
    fill(77, 14, 79, 34, C);
    fill(79, 10, 81, 37, C);

    // Optional branches end in small pockets, making the cave exploratory
    // without hiding the guaranteed S-route to the Core.
    fill(58, 29, 59, 34, C);
    fill(68, 24, 70, 29, C);
    fill(68, 5, 69, 9, C);
    fill(75, 27, 76, 32, C);

    fill(55, 22, 56, 25, K);
    fill(55, 15, 56, 17, K);
    fill(61, 12, 62, 14, K);
    fill(60, 18, 61, 20, K);
    fill(64, 9, 65, 11, K);
    fill(66, 24, 66, 27, K);
    fill(67, 37, 68, 38, K);
    fill(71, 16, 72, 18, K);
    fill(73, 24, 73, 28, K);
    fill(80, 18, 80, 21, K);
    fill(80, 27, 80, 30, K);
    for (const [r, c] of [
      [55,14],[55,33],[60,8],[60,22],[63,7],[66,13],[66,36],
      [69,34],[72,13],[72,37],[76,10],[78,16],[78,32],[80,11],[80,36],
    ] as [number, number][]) set(r, c, J);
    for (const [r, c] of [
      [58,17],[59,25],[61,6],[64,15],[64,31],[68,33],
      [71,40],[73,11],[75,21],[77,13],[79,35],[81,9],[81,38],
    ] as [number, number][]) set(r, c, V);
    for (const [r, c] of [
      [54,13],[54,34],[57,17],[57,25],[60,9],[60,23],[62,6],[63,15],
      [65,12],[65,37],[68,35],[70,40],[72,14],[72,36],[74,19],[74,34],
      [77,15],[77,33],[79,12],[79,36],
    ] as [number, number][]) set(r, c, N);
    for (const [r, c] of [
      [63,6],[67,14],[70,36],[74,13],[76,19],[79,33],[81,12],[81,35],
    ] as [number, number][]) set(r, c, Q2);
    for (const [r, c] of [
      [55,12],[56,35],[60,7],[62,23],[63,15],[65,11],[65,38],
      [68,40],[70,35],[72,12],[74,39],[75,10],[77,18],[78,34],[80,10],[80,37],
    ] as [number, number][]) set(r, c, X);

    hLine(82, 1, 46, K);
    fill(82, 13, 82, 34, C);
    const expandedArenaRows: [number, number, number][] = [
      [83,12,35],[84,8,39],[85,6,41],[86,5,42],[87,5,42],
      [88,6,41],[89,7,40],[90,9,38],[91,13,34],
    ];
    expandedArenaRows.forEach(([r, cL, cR]) => {
      fill(r, cL, r, cR, A);
      fill(r, 1, r, cL - 1, K);
      fill(r, cR + 1, r, 46, K);
    });
    set(89, 8, Q2); set(89, 39, Q2);
    hLine(92, 1, 46, K);
    hLine(93, 1, 46, K);

    // One final authoritative pass owns every tile in the expanded world.
    applyExpandedWorldLayout(grid);

    // ── Render tile grid to Phaser game objects ───────────────────────────────
    const walls     = scene.physics.add.staticGroup();
    const decorative = scene.add.group();
    const tallGrassFrontTiles: Phaser.GameObjects.Image[] = [];
    const caveSurfaceTiles: Phaser.GameObjects.Image[] = [];
    const caveCorruptionObjects: Phaser.GameObjects.GameObject[] = [];

    const markCaveSurface = (image: Phaser.GameObjects.Image, purifiedTexture: string) => {
      image.setName('cave-surface').setData('purifiedTexture', purifiedTexture);
      caveSurfaceTiles.push(image);
      return image;
    };

    // Zone backgrounds (drawn first, depth 0)
    const bg = scene.add.graphics().setDepth(-10);

    bg.fillStyle(0x5e7848); bg.fillRect(0, 0, worldWidth, SIGNAL_START_ROW * TILE);
    bg.fillStyle(0x587447); bg.fillRect(0, SIGNAL_START_ROW * TILE, worldWidth, (BROOK_START_ROW - SIGNAL_START_ROW) * TILE);
    bg.fillStyle(0x4e6e59); bg.fillRect(0, BROOK_START_ROW * TILE, worldWidth, (JUNCTION_START_ROW - BROOK_START_ROW) * TILE);
    bg.fillStyle(0x455c4d); bg.fillRect(0, JUNCTION_START_ROW * TILE, worldWidth, (GROVE_START_ROW - JUNCTION_START_ROW) * TILE);
    bg.fillStyle(0x3f5a46); bg.fillRect(0, GROVE_START_ROW * TILE, worldWidth, (GATE_START_ROW - GROVE_START_ROW) * TILE);
    bg.fillStyle(0x241814); bg.fillRect(0, GATE_START_ROW * TILE, worldWidth, 2 * TILE);
    bg.fillStyle(0x354b39); bg.fillRect(0, FADING_START_ROW * TILE, worldWidth, (CAVE_START_ROW - FADING_START_ROW) * TILE);
    bg.fillStyle(0x182426); bg.fillRect(0, 113 * TILE, worldWidth, 4 * TILE);
    bg.fillStyle(0x090f11); bg.fillRect(0, CAVE_START_ROW * TILE, worldWidth, (CORE_START_ROW - CAVE_START_ROW) * TILE);
    bg.fillStyle(0x030707); bg.fillRect(0, CORE_START_ROW * TILE, worldWidth, (MAP_ROWS - CORE_START_ROW) * TILE);

    // Override grid with editor-saved map if present
    const _editorMap = localStorage.getItem('editor-map');
    if (_editorMap) {
      try {
        const editorGrid: number[][] = JSON.parse(_editorMap);
        const hasCurrentDimensions = editorGrid.length === MAP_ROWS
          && editorGrid.every(row => row.length === MAP_COLS);
        if (hasCurrentDimensions) {
          for (let r = 0; r < MAP_ROWS; r++)
            for (let c = 0; c < MAP_COLS; c++)
              grid[r][c] = editorGrid[r][c];
        }
      } catch { /* ignore malformed data */ }
      localStorage.removeItem('editor-map');
    }

    // Seeded pseudo-random for deterministic variety per tile position
    const hash = (r: number, c: number) => ((r * 7919 + c * 104729) & 0xffff) / 0xffff;

    const addOutdoorGround = (row: number, col: number, x: number, y: number) => {
      const blockRow = Math.floor(row / 3);
      const blockCol = Math.floor(col / 3);
      const blockSeed = hash(blockRow, blockCol);
      const flipX = blockSeed > 0.48;
      const flipY = blockSeed > 0.78;
      const localRow = ((row % 3) + 3) % 3;
      const localCol = ((col % 3) + 3) % 3;
      const sourceRow = flipY ? 2 - localRow : localRow;
      const sourceCol = flipX ? 2 - localCol : localCol;
      const texture = row < SIGNAL_START_ROW ? 'town-grass-b'
        : row < JUNCTION_START_ROW ? 'town-grass-a'
          : 'town-grass-c';
      const alpha = row < SIGNAL_START_ROW ? 0.28
        : row < BROOK_START_ROW ? 0.34
          : row < JUNCTION_START_ROW ? 0.3
            : row < GROVE_START_ROW ? 0.36
              : 0.3;
      const image = scene.add.image(x, y, texture, sourceRow * 3 + sourceCol)
        .setDepth(0)
        .setFlip(flipX, flipY)
        .setAlpha(alpha);

      if (row >= FADING_START_ROW) image.setTint(0x879387);
      else if (row >= GROVE_START_ROW) image.setTint(0x9bad96);
      else if (row >= JUNCTION_START_ROW) image.setTint(0xa9bab3);
      decorative.add(image);
      return image;
    };

    const addShadow = (texture: string, x: number, y: number, depth = 0.5) => {
      const shadow = scene.add.image(x + 2, y + 2, texture);
      shadow.setTint(0x07100c).setAlpha(0.22).setDepth(depth);
      return shadow;
    };

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tileType = grid[row][col];
        const px = col * TILE + TILE / 2;
        const py = row * TILE + TILE / 2;
        const rng = hash(row, col);

        switch (tileType) {
          case W:  { addShadow('tile-wall', px, py); const i = scene.add.image(px, py, 'tile-wall'); i.setDepth(1); walls.add(i); break; }
          case T:  { const treeKey = rng < 0.4 ? 'tile-tree-top-2' : 'tile-tree-top'; addShadow(treeKey, px, py, 1.5); const i = scene.add.image(px, py, treeKey); i.setDepth(2); walls.add(i); break; }
          case B:  { addShadow('tile-building-wall', px, py); const i = scene.add.image(px, py, 'tile-building-wall'); i.setDepth(1); walls.add(i); break; }
          case B2: { addShadow('tile-bldg-stone', px, py); const i = scene.add.image(px, py, 'tile-bldg-stone'); i.setDepth(1); walls.add(i); break; }
          case BW: { addShadow('tile-bldg-wall-win', px, py); const i = scene.add.image(px, py, 'tile-bldg-wall-win'); i.setDepth(1); walls.add(i); break; }
          case SW: { addShadow('tile-bldg-stone-win', px, py); const i = scene.add.image(px, py, 'tile-bldg-stone-win'); i.setDepth(1); walls.add(i); break; }
          case K:  {
            const below = grid[row + 1]?.[col];
            const hasFloorBelow = below === C || below === A || below === Z;
            const wallKey = hasFloorBelow ? 'tile-cave-wall-face' : rng < 0.48 ? 'tile-cave-wall-2' : 'tile-cave-wall';
            const purifiedKey = hasFloorBelow ? 'tile-cave-wall-face-purified'
              : wallKey === 'tile-cave-wall-2' ? 'tile-cave-wall-2-purified' : 'tile-cave-wall-purified';
            addShadow(wallKey, px, py);
            const i = markCaveSurface(scene.add.image(px, py, wallKey), purifiedKey);
            i.setDepth(hasFloorBelow ? 2 : 1); walls.add(i); break;
          }
          case G:  {
            // A real road surface remains visible after the doors slide away.
            const floor = scene.add.image(px, py, 'tile-path');
            floor.setDepth(0); decorative.add(floor);
            // Collision is independent from the coherent multi-tile door artwork.
            const blocker = scene.add.image(px, py, 'tile-gate');
            blocker.setAlpha(0).setDepth(1).setName('gate-blocker');
            walls.add(blocker);
            break;
          }
          case H: {
            if (row < CAVE_START_ROW) addOutdoorGround(row, col, px, py);
            const blocker = scene.add.image(px, py, 'tile-wall');
            blocker.setAlpha(0).setDepth(1).setName('landmark-blocker');
            walls.add(blocker);
            break;
          }
          case P: {
            const isBridge = row >= 44 && row <= 49 && col >= 28 && col <= 35;
            const pathKey = isBridge ? 'tile-bridge'
              : row >= JUNCTION_START_ROW && row < GROVE_START_ROW ? 'tile-path-2'
                : 'tile-path';
            const i = scene.add.image(px, py, pathKey);
            i.setFlip(rng > 0.52, rng > 0.82);
            if (row >= FADING_START_ROW) i.setTint(0xb6b49e);
            i.setDepth(0); decorative.add(i);
            break;
          }
          case A:  { const i = markCaveSurface(scene.add.image(px, py, 'tile-arena'), 'tile-arena-purified'); i.setDepth(0); decorative.add(i); break; }
          case C:  {
            const caveVariant = Math.min(2, Math.floor(rng * 3));
            const suffix = caveVariant === 0 ? '' : `-${caveVariant + 1}`;
            const i = markCaveSurface(
              scene.add.image(px, py, `tile-cave-floor${suffix}`),
              `tile-cave-floor${suffix}-purified`,
            );
            i.setDepth(0); decorative.add(i); break;
          }
          case R:  {
            const i = scene.add.image(px, py, 'tile-water');
            i.setName('water-tile').setData('baseY', py).setDepth(0); walls.add(i); break;
          }
          case L: {
            addOutdoorGround(row, col, px, py);
            const grassVariants = ['', '-2', '-3', '-4'];
            const grassVariant = grassVariants[Math.min(3, Math.floor(rng * grassVariants.length))];
            // Full clump below the player plus a foot-line-sorted foreground tuft.
            const grassTint = row >= FADING_START_ROW ? 0x9fa99a
              : row >= GROVE_START_ROW ? 0xb4c3ad : 0xffffff;
            const flipGrass = hash(row + 31, col + 17) > 0.54;
            const tg = scene.add.image(px, py, `tile-tall-grass${grassVariant}`)
              .setFlipX(flipGrass)
              .setTint(grassTint);
            tg.setDepth(1); decorative.add(tg);
            const tileBottom = py + TILE / 2;
            const to = scene.add.image(px, tileBottom, `tile-tall-grass-top${grassVariant}`)
              .setOrigin(0.5, 1)
              .setFlipX(flipGrass)
              .setTint(grassTint)
              .setDepth(5 + tileBottom / 10000 + 0.0001)
              .setName('tall-grass-front')
              .setData('row', row)
              .setData('col', col);
            decorative.add(to);
            tallGrassFrontTiles.push(to);
            break;
          }
          case U: {
            addOutdoorGround(row, col, px, py);
            const ti = scene.add.image(px, py, 'tile-tree-trunk'); ti.setDepth(1); decorative.add(ti);
            break;
          }
          case O:  { const i = scene.add.image(px, py, 'tile-building-roof'); i.setDepth(1); decorative.add(i); break; }
          case O2: { const i = scene.add.image(px, py, 'tile-roof-blue');    i.setDepth(1); decorative.add(i); break; }
          case O3: { const i = scene.add.image(px, py, 'tile-roof-gray');    i.setDepth(1); decorative.add(i); break; }
          case D:  { const i = scene.add.image(px, py, 'tile-building-door'); i.setDepth(1); decorative.add(i); break; }
          case D2: { const i = scene.add.image(px, py, 'tile-door-iron');    i.setDepth(1); decorative.add(i); break; }
          case F: {
            addOutdoorGround(row, col, px, py);
            const flowerKey = rng < 0.5 ? 'tile-flower' : 'tile-flower-2';
            const i = scene.add.image(px, py, flowerKey);
            i.setDepth(0); decorative.add(i);
            break;
          }
          case X:  { const i = markCaveSurface(scene.add.image(px, py, 'tile-crystal'), 'tile-crystal-purified'); i.setDepth(1); decorative.add(i); break; }
          case J:  { const i = markCaveSurface(scene.add.image(px, py, 'tile-pillar'), 'tile-pillar-purified'); i.setDepth(1); walls.add(i); break; }
          case V:  { const i = markCaveSurface(scene.add.image(px, py, 'tile-wall-rune'), 'tile-wall-rune-purified'); i.setDepth(1); walls.add(i); break; }
          case Q2: { const i = scene.add.image(px, py, 'tile-skull'); i.setDepth(1); decorative.add(i); caveCorruptionObjects.push(i); break; }
          case N:  { const i = scene.add.image(px, py, 'tile-stalactite');  i.setDepth(2); decorative.add(i); break; }
          case I:  {
            const i = markCaveSurface(scene.add.image(px, py, 'tile-cave-water'), 'tile-cave-water-purified');
            i.setName('water-tile').setData('baseY', py).setDepth(0); walls.add(i); break;
          }
          case Z:  {
            const i = markCaveSurface(scene.add.image(px, py, 'tile-cave-stairs'), 'tile-cave-stairs-purified');
            i.setDepth(0); decorative.add(i); break;
          }
          case E:  {
            const i = markCaveSurface(scene.add.image(px, py, 'tile-cave-boulder'), 'tile-cave-boulder-purified');
            i.setDepth(2); walls.add(i); break;
          }
          case S: {
            addOutdoorGround(row, col, px, py);
            const i = scene.add.image(px, py, 'tile-sign');
            i.setDepth(1); decorative.add(i);
            break;
          }
          default: {
            // Fill empty outdoor tiles with tileset grass for a richer ground
            if (row < CAVE_START_ROW) {
              addOutdoorGround(row, col, px, py);
            }
            break;
          }
        }
      }
    }

    // Coherent multi-tile buildings, clearings and forest groups sit on top of
    // the semantic grid. The source atlas already contains true alpha.
    renderPokemonOverworld(scene, decorative);

    // Walkable void fissures add danger without introducing invisible damage.
    for (const [row, col, angle] of [
      [121,31,-18],[124,18,24],[128,12,-8],[132,31,78],[136,37,12],
      [139,16,-42],[141,46,28],[145,27,82],[147,37,-24],[154,20,18],
      [157,43,-36],[159,31,70],
    ] as [number, number, number][]) {
      const fissure = scene.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, 'tile-void-fissure')
        .setDepth(0.7)
        .setAngle(angle)
        .setName('cave-corruption');
      decorative.add(fissure);
      caveCorruptionObjects.push(fissure);
      scene.tweens.add({
        targets: fissure,
        alpha: { from: 0.46, to: 1 },
        duration: 620 + (row % 5) * 110,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // The Frequency Gate is one architectural object instead of eight repeated tiles.
    const gateCenterX = GATE_CENTER_COL * TILE;
    const gateCenterY = (GATE_START_ROW + 1) * TILE;
    const gateLeftPanel = scene.add.image(gateCenterX - 16, gateCenterY, 'gate-panel-left')
      .setDepth(6).setName('gate-panel-left');
    const gateRightPanel = scene.add.image(gateCenterX + 16, gateCenterY, 'gate-panel-right')
      .setDepth(6).setName('gate-panel-right');
    const gateFrame = scene.add.image(gateCenterX, gateCenterY, 'gate-frame')
      .setDepth(7).setName('gate-frame');
    decorative.addMultiple([gateLeftPanel, gateRightPanel, gateFrame]);

    walls.refresh();

    // ── Boss chamber rune circle ──────────────────────────────────────────────
    const runeGraphics = MapBuilder.drawCoreRunes(scene, BOSS_CORE_COL * TILE, BOSS_CORE_ROW * TILE);

    // ── Crystal glow pulses (tween on a few X tiles) ─────────────────────────
    MapBuilder.animateCrystals(scene, grid);

    // ── Cave atmosphere: ash, fog, braziers, entrance arch ────────────────────
    caveCorruptionObjects.push(...MapBuilder.drawCaveAtmosphere(scene));

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
      walls, decorative, worldWidth, worldHeight,
      spawnX, spawnY,
      npcPos, npc2Pos, npc3Pos,
      signPos, sign2Pos,
      gatePos, bossPos,
      fragment1Pos, fragment2Pos, fragment3Pos,
      tallGrassZones, tallGrassFrontTiles,
      runeGraphics,
      caveSurfaceTiles,
      caveCorruptionObjects,
    };
  }

  // ── Grid-only build (used by the map editor) ────────────────────────────
  static buildGridOnly(): number[][] {
    const grid: number[][] = Array.from({ length: MAP_ROWS }, () => new Array(MAP_COLS).fill(_));
    const set  = (r: number, c: number, t: number) => { if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) grid[r][c] = t; };
    const fill = (r1: number, c1: number, r2: number, c2: number, t: number) => { for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) set(r, c, t); };
    const hLine = (row: number, c1: number, c2: number, t: number) => fill(row, c1, row, c2, t);
    const vLine = (col: number, r1: number, r2: number, t: number) => fill(r1, col, r2, col, t);

    hLine(0, 0, MAP_COLS - 1, W); hLine(MAP_ROWS - 1, 0, MAP_COLS - 1, W);
    vLine(0, 0, MAP_ROWS - 1, W); vLine(MAP_COLS - 1, 0, MAP_ROWS - 1, W);
    fill(1, 19, 51, 22, P);

    // ZONE 1 — Echo Village
    hLine(2, 2, 6, O); set(3,3,BW); set(3,4,B); set(3,5,BW); set(4,3,B); set(4,4,D); set(4,5,B);
    hLine(2, 9, 15, O2); set(3,10,BW); set(3,11,B); set(3,12,B); set(3,13,B); set(3,14,BW); set(4,10,B); set(4,11,BW); set(4,12,D); set(4,13,BW); set(4,14,B);
    hLine(8, 2, 6, O); set(9,3,BW); set(9,4,B); set(9,5,BW); set(10,3,B); set(10,4,D); set(10,5,B);
    hLine(2, 33, 37, O); set(3,34,BW); set(3,35,B); set(3,36,BW); set(4,34,B); set(4,35,D); set(4,36,B);
    fill(2, 24, 5, 30, R); hLine(5, 4, 18, P); hLine(11, 4, 18, P);
    for (const [r,c] of [[1,3],[1,6],[3,2],[3,6],[1,10],[1,14],[3,9],[3,15],[8,7],[9,7],[8,1],[9,1],[1,34],[1,36],[3,32],[3,38],[6,1],[6,8],[6,17],[7,1],[7,17],[7,36],[4,31]] as [number,number][]) set(r,c,F);
    set(9, 17, S);
    for (let c = 1; c <= 46; c++) { if (c < 19 || c > 22) { set(12, c, T); set(13, c, U); } }

    // ZONE 2 — Signal Path
    fill(14,1,24,2,T); fill(14,45,24,46,T); fill(14,3,24,17,L); fill(14,23,24,44,L);
    fill(18,8,19,10,_); fill(20,32,21,35,_); set(16,13,S);
    for (let c = 1; c <= 46; c++) { if (c < 19 || c > 22) { set(25, c, T); set(26, c, U); } }

    // ZONE 3 — Neon Junction
    hLine(27,2,8,O3); set(28,3,SW); set(28,4,B2); set(28,5,B2); set(28,6,B2); set(28,7,SW); set(29,3,B2); set(29,4,B2); set(29,5,D2); set(29,6,B2); set(29,7,B2);
    hLine(27,28,34,O3); set(28,29,SW); set(28,30,B2); set(28,31,B2); set(28,32,B2); set(28,33,SW); set(29,29,B2); set(29,30,B2); set(29,31,D2); set(29,32,B2); set(29,33,B2);
    hLine(33,38,42,O3); set(34,39,B2); set(34,40,SW); set(34,41,B2); set(35,39,B2); set(35,40,D2); set(35,41,B2);
    hLine(33,2,6,O3); set(34,3,B2); set(34,4,SW); set(34,5,B2); set(35,3,B2); set(35,4,D2); set(35,5,B2);
    hLine(30,5,31,P);
    for (const [r,c] of [[28,2],[28,8],[31,3],[31,7],[28,28],[28,34],[31,29],[31,33],[34,2],[34,6],[36,3],[36,5],[34,38],[34,42],[36,39],[36,41],[32,14],[33,14],[32,25],[33,24]] as [number,number][]) set(r,c,F);
    set(35,17,S);

    // Gate
    hLine(37,1,46,W); fill(37,19,37,22,G); hLine(38,1,46,W); fill(38,19,38,22,G);

    // ZONE 4 — Fading Path
    fill(39,19,51,22,P); fill(39,1,51,2,W); fill(39,45,51,46,W); fill(39,3,51,17,L); fill(39,23,51,44,L);
    fill(45,3,47,4,W); fill(45,43,47,44,W); set(43,12,S);

    // Cave approach
    for (let c = 1; c <= 46; c++) { if (c < 19 || c > 22) set(51, c, T); }
    for (let c = 1; c <= 46; c++) { if (c < 15 || c > 26) set(52, c, K); }
    fill(52,15,53,26,C); fill(52,19,53,22,C);

    // Keep the map editor and the playable scene on the same authored layout.
    applyPokemonOverworldLayout(grid);

    // ZONE 5 — Void Cave
    fill(54,1,68,46,K);
    const ps: [number,number,number][] = [[54,12,35],[55,11,36],[56,10,35],[57,11,34],[58,13,35],[59,14,34],[60,15,32],[61,14,31],[62,15,32],[63,16,31],[64,10,37],[65,9,38],[66,8,38],[67,8,39],[68,7,39]];
    ps.forEach(([r,cL,cR]) => fill(r,cL,r,cR,C));
    set(67,11,J); set(67,12,J); set(67,35,J); set(67,36,J); set(68,11,J); set(68,12,J); set(68,35,J); set(68,36,J);
    set(57,9,V); set(57,37,V); set(63,15,V); set(63,32,V); set(66,6,V); set(66,40,V);
    for (const [r,c] of [[54,13],[54,34],[55,12],[55,35],[56,11],[57,11],[57,34],[58,14],[59,15],[60,16],[61,15],[62,15],[63,16],[60,32],[61,31],[62,32],[63,31]] as [number,number][]) set(r,c,N);
    set(68,13,Q2); set(68,34,Q2);
    for (const [r,c] of [[55,10],[55,36],[56,10],[58,36],[61,13],[62,33],[64,9],[65,38],[66,8],[67,38],[69,14],[69,33]] as [number,number][]) set(r,c,X);

    // ZONE 6 — The Core
    hLine(69,1,46,K); fill(69,13,69,34,C);
    const ar: [number,number,number][] = [[70,12,35],[71,8,39],[72,7,40],[73,7,40],[74,8,39],[75,9,38],[76,11,36],[77,14,33]];
    ar.forEach(([r,cL,cR]) => { fill(r,cL,r,cR,A); fill(r,1,r,cL-1,K); fill(r,cR+1,r,46,K); });
    set(76,9,Q2); set(76,38,Q2);
    hLine(78,1,46,K); hLine(79,1,46,K);

    // Expanded finale layout mirrors the playable map's second pass.
    fill(54,1,91,46,K);
    fill(54,12,57,35,C); fill(57,18,61,24,C); fill(60,7,63,24,C);
    fill(62,5,67,15,C); fill(65,11,67,38,C); fill(64,32,70,41,C);
    fill(68,35,74,40,C); fill(72,12,74,38,C); fill(70,9,76,20,C);
    fill(74,14,79,19,C); fill(77,14,79,34,C); fill(79,10,81,37,C);
    fill(58,29,59,34,C); fill(68,24,70,29,C); fill(68,5,69,9,C); fill(75,27,76,32,C);
    fill(55,22,56,25,K); fill(55,15,56,17,K); fill(61,12,62,14,K); fill(60,18,61,20,K);
    fill(64,9,65,11,K); fill(66,24,66,27,K); fill(67,37,68,38,K); fill(71,16,72,18,K);
    fill(73,24,73,28,K); fill(80,18,80,21,K); fill(80,27,80,30,K);
    for (const [r,c] of [[55,14],[55,33],[60,8],[60,22],[63,7],[66,13],[66,36],[69,34],[72,13],[72,37],[76,10],[78,16],[78,32],[80,11],[80,36]] as [number,number][]) set(r,c,J);
    for (const [r,c] of [[58,17],[59,25],[61,6],[64,15],[64,31],[68,33],[71,40],[73,11],[75,21],[77,13],[79,35],[81,9],[81,38]] as [number,number][]) set(r,c,V);
    for (const [r,c] of [[54,13],[54,34],[57,17],[57,25],[60,9],[60,23],[62,6],[63,15],[65,12],[65,37],[68,35],[70,40],[72,14],[72,36],[74,19],[74,34],[77,15],[77,33],[79,12],[79,36]] as [number,number][]) set(r,c,N);
    for (const [r,c] of [[63,6],[67,14],[70,36],[74,13],[76,19],[79,33],[81,12],[81,35]] as [number,number][]) set(r,c,Q2);
    for (const [r,c] of [[55,12],[56,35],[60,7],[62,23],[63,15],[65,11],[65,38],[68,40],[70,35],[72,12],[74,39],[75,10],[77,18],[78,34],[80,10],[80,37]] as [number,number][]) set(r,c,X);
    hLine(82,1,46,K); fill(82,13,82,34,C);
    const expandedArena: [number,number,number][] = [[83,12,35],[84,8,39],[85,6,41],[86,5,42],[87,5,42],[88,6,41],[89,7,40],[90,9,38],[91,13,34]];
    expandedArena.forEach(([r,cL,cR]) => { fill(r,cL,r,cR,A); fill(r,1,r,cL-1,K); fill(r,cR+1,r,46,K); });
    set(89,8,Q2); set(89,39,Q2); hLine(92,1,46,K); hLine(93,1,46,K);

    applyExpandedWorldLayout(grid);

    return grid;
  }

  // ── Boss chamber rune circle (enhanced) ─────────────────────────────────
  private static drawCoreRunes(scene: Phaser.Scene, cx: number, cy: number): Phaser.GameObjects.GameObject[] {
    const outerR = 5 * TILE;
    const midR   = 3.5 * TILE;
    const innerR = 2 * TILE;

    // Three concentric circles on one graphics object
    const g = scene.add.graphics().setDepth(1);
    g.lineStyle(3, 0xff6b3d, 0.42); g.strokeCircle(cx, cy, outerR);
    g.lineStyle(2, 0xff5c66, 0.30); g.strokeCircle(cx, cy, midR);
    g.lineStyle(1, 0x49dfbf, 0.20); g.strokeCircle(cx, cy, innerR);

    // True pentagram: each point connects to the point two positions ahead
    const pts = 5;
    g.lineStyle(1, 0xff6b3d, 0.34);
    const pentPoints: [number, number][] = Array.from({ length: pts }, (_, i) => [
      cx + Math.cos(((Math.PI * 2) / pts) * i - Math.PI / 2) * outerR,
      cy + Math.sin(((Math.PI * 2) / pts) * i - Math.PI / 2) * outerR,
    ]);
    for (let i = 0; i < pts; i++) {
      const [x1, y1] = pentPoints[i];
      const [x2, y2] = pentPoints[(i + 2) % pts];
      g.lineBetween(x1, y1, x2, y2);
    }
    scene.tweens.add({ targets: g, alpha: 0.35, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 8 cardinal glyph markers on the mid ring
    const markerG = scene.add.graphics().setDepth(2);
    for (let i = 0; i < 8; i++) {
      const angle = ((Math.PI * 2) / 8) * i;
      const mx = cx + Math.cos(angle) * midR;
      const my = cy + Math.sin(angle) * midR;
      markerG.fillStyle(0xff6b3d, 0.68); markerG.fillRect(mx - 2, my - 2, 4, 4);
      markerG.fillStyle(0xd7ff4a, 0.42); markerG.fillRect(mx - 1, my - 1, 2, 2);
    }
    scene.tweens.add({ targets: markerG, alpha: 0.2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Void-eye center — layered black / dark-red / bright-red
    const eye = scene.add.graphics().setDepth(3);
    eye.fillStyle(0x000000, 1.0); eye.fillCircle(cx, cy, 10);
    eye.fillStyle(0x16312c, 0.8); eye.fillCircle(cx, cy, 7);
    eye.fillStyle(0x287a6b, 0.6); eye.fillCircle(cx, cy, 4);
    eye.fillStyle(0xd7ff4a, 0.9); eye.fillCircle(cx, cy, 2);
    scene.tweens.add({ targets: eye, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    // 5 pentagram-vertex rune markers with staggered pulsing
    const markers: Phaser.GameObjects.Graphics[] = [];
    for (let i = 0; i < pts; i++) {
      const a  = ((Math.PI * 2) / pts) * i - Math.PI / 2;
      const mx = cx + Math.cos(a) * outerR;
      const my = cy + Math.sin(a) * outerR;
      const m  = scene.add.graphics().setDepth(2);
      m.fillStyle(0xff6b3d, 0.8); m.fillRect(-3, -1, 6, 2); m.fillRect(-1, -3, 2, 6);
      m.fillStyle(0xd7ff4a, 0.36); m.fillCircle(0, 0, 3);
      m.setPosition(mx, my);
      scene.tweens.add({ targets: m, alpha: 0.1, duration: 600 + i * 150, yoyo: true, repeat: -1 });
      markers.push(m);
    }

    return [g, markerG, eye, ...markers];
  }

  // ── Cave atmosphere: ash motes, fog wisps, braziers, entrance arch ────────
  private static drawCaveAtmosphere(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
    const caveTop    = CAVE_START_ROW * TILE;
    const caveBottom = (MAP_ROWS - 3) * TILE;
    const caveLeft   = 4 * TILE;
    const caveRight  = (MAP_COLS - 4) * TILE;
    const effects: Phaser.GameObjects.GameObject[] = [];

    // ── Floating ash / dust motes ──────────────────────────────────────────
    for (let i = 0; i < 40; i++) {
      const mote  = scene.add.graphics().setDepth(2);
      effects.push(mote);
      const isRed = Math.random() < 0.3;
      const isTeal = !isRed && Math.random() < 0.4;
      const color = isRed ? 0x7a2e25 : isTeal ? 0x267568 : 0x273b38;
      const alpha = 0.15 + Math.random() * 0.3;
      mote.fillStyle(color, alpha);
      mote.fillCircle(0, 0, 0.8 + Math.random() * 1.2);
      const sx = caveLeft  + Math.random() * (caveRight - caveLeft);
      const sy = caveTop   + Math.random() * (caveBottom - caveTop);
      mote.setPosition(sx, sy);
      const driftY = -25 - Math.random() * 40;
      const driftX = (Math.random() - 0.5) * 30;
      const dur    = 4000 + Math.random() * 5000;
      scene.tweens.add({
        targets: mote,
        y: sy + driftY, x: sx + driftX,
        alpha: 0,
        duration: dur,
        delay: Math.random() * dur,
        repeat: -1,
        onRepeat: () => {
          mote.setPosition(
            caveLeft + Math.random() * (caveRight - caveLeft),
            caveTop  + Math.random() * (caveBottom - caveTop)
          );
          mote.setAlpha(alpha);
        },
      });
    }

    // ── Fog wisps at the cave entrance ─────────────────────────────────────
    const fogY = (CAVE_START_ROW - 1) * TILE;
    for (let i = 0; i < 6; i++) {
      const fog = scene.add.graphics().setDepth(3);
      effects.push(fog);
      fog.fillStyle(0x1b3431, 0.18);
      fog.fillEllipse(0, 0, 48 + Math.random() * 32, 10 + Math.random() * 6);
      const fx = 25 * TILE + Math.random() * 14 * TILE;
      fog.setPosition(fx, fogY + Math.random() * 8);
      scene.tweens.add({
        targets: fog,
        x: fx + (Math.random() < 0.5 ? 1 : -1) * (10 + Math.random() * 16),
        alpha: { from: 0.08, to: 0.22 },
        duration: 3000 + Math.random() * 2000,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // ── Void crack floor glow in arena ────────────────────────────────────
    const aCx = BOSS_CORE_COL * TILE;
    const aCy = BOSS_CORE_ROW * TILE;
    const arenaGlow = scene.add.graphics().setDepth(1);
    effects.push(arenaGlow);
    const crackAngles = [15, 72, 130, 200, 255, 310];
    crackAngles.forEach(deg => {
      const rad = Phaser.Math.DegToRad(deg);
      const len = 40 + Math.random() * 20;
      const ex  = aCx + Math.cos(rad) * len;
      const ey  = aCy + Math.sin(rad) * len;
      arenaGlow.lineStyle(1, 0xff6b3d, 0.38);
      arenaGlow.lineBetween(aCx, aCy, ex, ey);
      arenaGlow.lineStyle(1, 0x49dfbf, 0.18);
      arenaGlow.lineBetween(aCx + 1, aCy, ex + 1, ey);
    });
    arenaGlow.fillStyle(0x2b1713, 0.34); arenaGlow.fillCircle(aCx, aCy, 22);
    arenaGlow.fillStyle(0x17332d, 0.22); arenaGlow.fillCircle(aCx, aCy, 12);
    scene.tweens.add({ targets: arenaGlow, alpha: 0.5, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // ── Brazier / torch glow points ────────────────────────────────────────
    const braziers: [number, number, number][] = [
      [27 * TILE, 116 * TILE, 0xff4400],
      [37 * TILE, 116 * TILE, 0xff4400],
      [8 * TILE, 128 * TILE, 0xff2200],
      [56 * TILE, 127 * TILE, 0xff2200],
      [17 * TILE, 141 * TILE, 0xcc0044],
      [48 * TILE, 140 * TILE, 0xcc0044],
      [18 * TILE, 159 * TILE, 0xff2200],
      [46 * TILE, 159 * TILE, 0xff2200],
    ];
    braziers.forEach(([bx, by, col]) => {
      const outer = scene.add.graphics().setDepth(2);
      outer.setPosition(bx, by);
      outer.fillStyle(col, 0.045); outer.fillCircle(0, 0, 18);
      outer.lineStyle(1, col, 0.22); outer.strokeCircle(0, 0, 15);
      const inner = scene.add.graphics().setDepth(3);
      inner.setPosition(bx, by);
      inner.fillStyle(col, 0.24); inner.fillCircle(0, 0, 7);
      inner.fillStyle(0xff6b3d, 0.58); inner.fillRect(-2, -6, 4, 9);
      const dot   = scene.add.graphics().setDepth(3);
      dot.setPosition(bx, by);
      effects.push(outer, inner, dot);
      dot.fillStyle(0xffcc44, 0.9); dot.fillCircle(0, -3, 2);
      scene.tweens.add({ targets: outer, alpha: 0.04, scaleX: 1.15, scaleY: 1.1, duration: 180 + Math.random() * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: inner, alpha: 0.15, scaleX: 0.9,  scaleY: 1.1, duration: 220 + Math.random() * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: dot,   alpha: 0.4,  scaleX: 1.3,  scaleY: 1.4, duration: 130 + Math.random() * 80,  yoyo: true, repeat: -1 });
    });

    // ── Entrance arch framing the boss chamber opening ─────────────────────
    // arc(x, y, radius, startAngle, endAngle, anticlockwise):
    // From PI (left) clockwise to 0 (right) traces the upper semicircle arch.
    const archCx = BOSS_CORE_COL * TILE;
    const archCy = (CORE_START_ROW + 1) * TILE;
    const archR  = 8 * TILE;
    const arch   = scene.add.graphics().setDepth(3);
    effects.push(arch);

    arch.lineStyle(8, 0x18292a, 0.9);
    arch.beginPath(); arch.arc(archCx, archCy, archR,      Math.PI, 0, false); arch.strokePath();

    arch.lineStyle(4, 0x2c4342, 0.8);
    arch.beginPath(); arch.arc(archCx, archCy, archR - 4,  Math.PI, 0, false); arch.strokePath();

    arch.lineStyle(2, 0xff6b3d, 0.46);
    arch.beginPath(); arch.arc(archCx, archCy, archR - 8,  Math.PI + 0.15, -0.15, false); arch.strokePath();

    arch.lineStyle(1, 0x004433, 0.3);
    arch.beginPath(); arch.arc(archCx, archCy, archR - 12, Math.PI, 0, false); arch.strokePath();
    return effects;
  }

  // ── Animate crystal tiles with gentle glow pulse ─────────────────────────
  private static animateCrystals(scene: Phaser.Scene, grid: number[][]): void {
    // Find all crystal positions
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (grid[row][col] !== X) continue;
        const px = col * TILE + TILE / 2;
        const py = row * TILE + TILE / 2;
        const gfx = scene.add.graphics().setDepth(1);
        gfx.fillStyle(0x00ffcc, 0.25);
        gfx.fillCircle(0, 0, TILE * 0.7);
        gfx.setPosition(px, py);
        scene.tweens.add({
          targets: gfx,
          alpha: 0.05,
          duration: 900 + Math.random() * 600,
          yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }
}
