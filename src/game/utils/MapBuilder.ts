import Phaser from 'phaser';

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
/* eslint-enable @typescript-eslint/no-unused-vars */

// ──────────────────────────────────────────────────────────────────────────────
//  Map: 48 columns × 80 rows  →  768 × 1280 px
//
//  Zone layout
//  ───────────────────────────────────────────────────────────
//  Rows  0     : Top border
//  Rows  1–12  : ZONE 1 — ECHO VILLAGE  (calm start)
//  Rows 12–13  : Village tree-border exit
//  Rows 14–25  : ZONE 2 — SIGNAL PATH  (first route, tall grass)
//  Rows 25–26  : Route → Neon Junction tree-border
//  Rows 26–37  : ZONE 3 — NEON JUNCTION  (story beat, foreshadowing)
//  Rows 37–38  : FREQUENCY GATE  (Level-2 locked)
//  Rows 38–51  : ZONE 4 — FADING PATH  (darker route, tension)
//  Rows 51–54  : Cave approach / entrance
//  Rows 54–69  : ZONE 5 — VOID CAVE  (dungeon)
//  Rows 69–77  : ZONE 6 — THE CORE  (boss chamber)
//  Rows 77–79  : Bottom border
// ──────────────────────────────────────────────────────────────────────────────

export const MAP_COLS = 48;
export const MAP_ROWS = 80;

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
  // Boss chamber rune graphics (for destruction after boss defeat)
  runeGraphics: Phaser.GameObjects.GameObject[];
}

export class MapBuilder {
  static build(scene: Phaser.Scene): MapBuildResult {
    const worldWidth  = MAP_COLS * TILE;   // 768
    const worldHeight = MAP_ROWS * TILE;   // 1280

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

    // House 1 — "Bard's Cottage"  (rows 2–6, cols 2–8) — warm wood + brown roof
    hLine(2, 2, 8, O);
    fill(3, 2, 5, 8, B);
    set(3, 4, BW); set(3, 7, BW);        // upper windows
    set(5, 5, D);

    // House 2 — "Muse's Study"  (rows 2–6, cols 10–16) — wood + blue roof
    hLine(2, 10, 16, O2);
    fill(3, 10, 5, 16, B);
    set(3, 12, BW); set(3, 15, BW);      // upper windows
    set(4, 11, BW); set(4, 14, BW);      // lower windows
    set(5, 13, D);

    // House 3 — smaller workshop  (rows 8–11, cols 2–7) — wood + brown roof
    hLine(8, 2, 7, O);
    fill(9, 2, 10, 7, B);
    set(9, 3, BW); set(9, 6, BW);        // windows
    set(10, 4, D);

    // Decorative pond  (rows 2–5, cols 24–30)
    fill(2, 24, 5, 30, R);

    // Flowers
    for (const [r, c] of [
      [4,9],[5,18],[6,1],[6,9],[6,17],[7,1],[7,17],
      [3,32],[4,35],[5,38],[6,32],[7,36],
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

    // Building A — "The Junction Inn"  (rows 27–32, cols 2–12) — stone + gray roof
    hLine(27, 2, 12, O3);
    fill(28, 2, 31, 12, B2);
    set(29, 4, SW); set(29, 7, SW); set(29, 10, SW);  // upper windows
    set(30, 5, SW); set(30, 9, SW);                    // lower windows
    set(31, 7, D2);

    // Building B — "Signal Station"  (rows 27–32, cols 28–42) — stone + gray roof
    hLine(27, 28, 42, O3);
    fill(28, 28, 31, 42, B2);
    set(29, 31, SW); set(29, 35, SW); set(29, 39, SW); // upper windows
    set(30, 30, SW); set(30, 34, SW); set(30, 38, SW); // lower windows
    set(31, 35, D2);

    // Small building C  (rows 33–36, cols 38–44) — stone + gray roof
    hLine(33, 38, 44, O3);
    fill(34, 38, 35, 44, B2);
    set(34, 40, SW); set(34, 43, SW);                  // windows
    set(35, 41, D2);

    // Town flowers and open space details
    for (const [r, c] of [
      [28,14],[29,16],[30,14],[32,14],[33,14],[32,25],[33,24],
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

    // ═════════════════════════════════════════════════════════════════════════
    //  ZONE 5 — VOID CAVE  (rows 54–68)
    // ═════════════════════════════════════════════════════════════════════════

    // Full-width cave walls as default for this section
    fill(54, 1, 68, 46, K);

    // Wide cave passage — rows 54–59
    fill(54, 13, 59, 34, C);

    // Narrow passage — rows 60–63
    fill(60, 16, 63, 31, C);

    // Wide again — rows 64–68 (opening to boss chamber)
    fill(64, 11, 68, 36, C);

    // Crystals (decorative) scattered along cave walls
    for (const [r, c] of [
      [55,12],[56,35],[57,12],[58,34],[59,13],
      [60,15],[61,32],[62,15],[63,32],
      [64,10],[65,37],[66,11],[67,36],[68,10],
    ] as [number,number][]) set(r, c, X);

    // ═════════════════════════════════════════════════════════════════════════
    //  ZONE 6 — THE CORE  (rows 69–77)
    // ═════════════════════════════════════════════════════════════════════════

    // Entry wall with opening
    hLine(69, 1, 46, K);
    fill(69, 16, 69, 31, C);

    // Boss arena floor
    fill(70, 8, 77, 39, A);

    // Arena outer ring (cave walls)
    fill(70, 1, 77, 7, K);
    fill(70, 40, 77, 46, K);

    // Bottom border above world edge
    hLine(78, 1, 46, K);
    hLine(79, 1, 46, K);

    // ── Render tile grid to Phaser game objects ───────────────────────────────
    const walls     = scene.physics.add.staticGroup();
    const decorative = scene.add.group();

    // Zone backgrounds (drawn first, depth 0)
    const bg = scene.add.graphics().setDepth(0);

    // Echo Village  — matched to punyworld grass #85a643
    bg.fillStyle(0x7a9a40); bg.fillRect(0, 0, worldWidth, 13 * TILE);
    // Signal Path   — slightly darker
    bg.fillStyle(0x6a8a38); bg.fillRect(0, 13 * TILE, worldWidth, 13 * TILE);
    // Neon Junction — muted grey-green urban
    bg.fillStyle(0x506838); bg.fillRect(0, 26 * TILE, worldWidth, 12 * TILE);
    // Gate row      — near-black red
    bg.fillStyle(0x1a0808); bg.fillRect(0, 37 * TILE, worldWidth, 2 * TILE);
    // Fading Path   — very dark green, ominous
    bg.fillStyle(0x1e2c18); bg.fillRect(0, 39 * TILE, worldWidth, 13 * TILE);
    // Cave approach — dark stone
    bg.fillStyle(0x141018); bg.fillRect(0, 52 * TILE, worldWidth, 2 * TILE);
    // Void Cave     — near black purple
    bg.fillStyle(0x0c0814); bg.fillRect(0, 54 * TILE, worldWidth, 15 * TILE);
    // The Core      — pure black
    bg.fillStyle(0x060410); bg.fillRect(0, 69 * TILE, worldWidth, 11 * TILE);

    // Seeded pseudo-random for deterministic variety per tile position
    const hash = (r: number, c: number) => ((r * 7919 + c * 104729) & 0xffff) / 0xffff;

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tileType = grid[row][col];
        const px = col * TILE + TILE / 2;
        const py = row * TILE + TILE / 2;
        const rng = hash(row, col);

        switch (tileType) {
          case W:  { const i = scene.add.image(px, py, 'tile-wall');           i.setDepth(1); walls.add(i);      break; }
          case T:  { const treeKey = rng < 0.4 ? 'tile-tree-top-2' : 'tile-tree-top'; const i = scene.add.image(px, py, treeKey); i.setDepth(2); walls.add(i); break; }
          case B:  { const i = scene.add.image(px, py, 'tile-building-wall'); i.setDepth(1); walls.add(i);     break; }
          case B2: { const i = scene.add.image(px, py, 'tile-bldg-stone');   i.setDepth(1); walls.add(i);      break; }
          case BW: { const i = scene.add.image(px, py, 'tile-bldg-wall-win'); i.setDepth(1); walls.add(i); break; }
          case SW: { const i = scene.add.image(px, py, 'tile-bldg-stone-win'); i.setDepth(1); walls.add(i); break; }
          case K:  { const i = scene.add.image(px, py, 'tile-cave-wall');    i.setDepth(1); walls.add(i);      break; }
          case G:  { const i = scene.add.image(px, py, 'tile-gate'); i.setDepth(1); i.setName('gate-tile'); walls.add(i); break; }
          case P: {
            const pathKey = rng < 0.3 ? 'tile-path-2' : 'tile-path';
            const i = scene.add.image(px, py, pathKey);
            i.setDepth(0); decorative.add(i);
            break;
          }
          case A:  { const i = scene.add.image(px, py, 'tile-arena');        i.setDepth(0); decorative.add(i); break; }
          case C:  { const i = scene.add.image(px, py, 'tile-cave-floor');   i.setDepth(0); decorative.add(i); break; }
          case R:  { const i = scene.add.image(px, py, 'tile-water');        i.setDepth(0); decorative.add(i); break; }
          case L:  { const i = scene.add.image(px, py, 'tile-tall-grass');   i.setDepth(1); decorative.add(i); break; }
          case U: {
            const gk = rng < 0.3 ? 'tile-grass-2' : 'tile-grass';
            const gi = scene.add.image(px, py, gk); gi.setDepth(0); decorative.add(gi);
            const ti = scene.add.image(px, py, 'tile-tree-trunk'); ti.setDepth(1); decorative.add(ti);
            break;
          }
          case O:  { const i = scene.add.image(px, py, 'tile-building-roof'); i.setDepth(1); decorative.add(i); break; }
          case O2: { const i = scene.add.image(px, py, 'tile-roof-blue');    i.setDepth(1); decorative.add(i); break; }
          case O3: { const i = scene.add.image(px, py, 'tile-roof-gray');    i.setDepth(1); decorative.add(i); break; }
          case D:  { const i = scene.add.image(px, py, 'tile-building-door'); i.setDepth(1); decorative.add(i); break; }
          case D2: { const i = scene.add.image(px, py, 'tile-door-iron');    i.setDepth(1); decorative.add(i); break; }
          case F: {
            const flowerKey = rng < 0.5 ? 'tile-flower' : 'tile-flower-2';
            const i = scene.add.image(px, py, flowerKey);
            i.setDepth(0); decorative.add(i);
            break;
          }
          case X:  { const i = scene.add.image(px, py, 'tile-crystal');      i.setDepth(1); decorative.add(i); break; }
          case S: {
            const gk = rng < 0.3 ? 'tile-grass-2' : 'tile-grass';
            const gi = scene.add.image(px, py, gk);
            gi.setDepth(0); decorative.add(gi);
            const i = scene.add.image(px, py, 'tile-sign');
            i.setDepth(1); decorative.add(i);
            break;
          }
          default: {
            // Fill empty outdoor tiles with tileset grass for a richer ground
            if (row < 52) {
              const grassKey = rng < 0.3 ? 'tile-grass-2' : 'tile-grass';
              const i = scene.add.image(px, py, grassKey);
              i.setDepth(0); decorative.add(i);
            }
            break;
          }
        }
      }
    }

    walls.refresh();

    // ── Subtle grid overlay ───────────────────────────────────────────────────
    const grid2 = scene.add.graphics().setDepth(0);
    grid2.lineStyle(1, 0xffffff, 0.025);
    for (let c = 0; c <= MAP_COLS; c++) grid2.lineBetween(c * TILE, 0, c * TILE, worldHeight);
    for (let r = 0; r <= MAP_ROWS; r++) grid2.lineBetween(0, r * TILE, worldWidth, r * TILE);

    // ── Zone label overlays ───────────────────────────────────────────────────
    const label = (x: number, y: number, text: string, col: number, a: number) =>
      scene.add.text(x, y, text, { fontFamily: '"Press Start 2P"', fontSize: '8px',
        color: '#' + col.toString(16).padStart(6, '0') }).setDepth(0).setAlpha(a);

    label(2 * TILE,  2 * TILE, 'ECHO VILLAGE',   0x88cc68, 0.40);
    label(2 * TILE, 15 * TILE, 'SIGNAL PATH',    0x68aa50, 0.35);
    label(2 * TILE, 28 * TILE, 'NEON JUNCTION',  0x60aa88, 0.40);
    label(2 * TILE, 40 * TILE, 'FADING PATH',    0x4a6040, 0.45);
    label(2 * TILE, 56 * TILE, 'VOID CAVE',      0x8844cc, 0.50);
    label(2 * TILE, 71 * TILE, 'THE CORE',       0xff2200, 0.60);

    // ── Gate highlight ────────────────────────────────────────────────────────
    const gh = scene.add.graphics().setDepth(3);
    gh.lineStyle(2, 0xffd700, 0.7);
    gh.strokeRect(19 * TILE, 36 * TILE + 8, 4 * TILE, 2 * TILE + 8);

    // ── Boss chamber rune circle ──────────────────────────────────────────────
    const runeGraphics = MapBuilder.drawCoreRunes(scene, 24 * TILE, 74 * TILE);

    // ── Crystal glow pulses (tween on a few X tiles) ─────────────────────────
    MapBuilder.animateCrystals(scene, grid);

    // ── Named positions ───────────────────────────────────────────────────────
    const px = (col: number) => col * TILE + TILE / 2;
    const py = (row: number) => row * TILE + TILE / 2;

    const spawnX = px(20);  // col 20, row 6 — Echo Village centre path
    const spawnY = py(6);

    // NPC 1 — Elder Muse  (Echo Village, near south exit)
    const npcPos  = { x: px(15), y: py(10) };
    // NPC 2 — Junction Guard  (Neon Junction south side, near gate)
    const npc2Pos = { x: px(14), y: py(34) };
    // NPC 3 — Wandering Musician  (Neon Junction east side)
    const npc3Pos = { x: px(37), y: py(32) };

    // Signs
    const signPos  = { x: px(17), y: py(9)  };  // Echo Village
    const sign2Pos = { x: px(17), y: py(35) };  // Neon Junction

    // Gate centre
    const gatePos = { x: px(20), y: py(37) };
    // Boss — true arena center (arena spans cols 8–39, rows 70–77)
    const bossPos = { x: 24 * TILE, y: 74 * TILE };

    // Sound fragments
    const fragment1Pos = { x: px(9),  y: py(18) };  // Signal Path left nook
    const fragment2Pos = { x: px(33), y: py(20) };  // Signal Path right nook
    const fragment3Pos = { x: px(10), y: py(45) };  // Fading Path left side

    // Tall grass zones (pixels)
    const tallGrassZones: Phaser.Geom.Rectangle[] = [
      new Phaser.Geom.Rectangle( 3 * TILE, 14 * TILE, 14 * TILE, 11 * TILE),  // Signal L
      new Phaser.Geom.Rectangle(23 * TILE, 14 * TILE, 21 * TILE, 11 * TILE),  // Signal R
      new Phaser.Geom.Rectangle( 3 * TILE, 39 * TILE, 14 * TILE, 12 * TILE),  // Fading L
      new Phaser.Geom.Rectangle(23 * TILE, 39 * TILE, 21 * TILE, 12 * TILE),  // Fading R
    ];

    return {
      walls, decorative, worldWidth, worldHeight,
      spawnX, spawnY,
      npcPos, npc2Pos, npc3Pos,
      signPos, sign2Pos,
      gatePos, bossPos,
      fragment1Pos, fragment2Pos, fragment3Pos,
      tallGrassZones,
      runeGraphics,
    };
  }

  // ── Boss chamber rune circle ─────────────────────────────────────────────
  private static drawCoreRunes(scene: Phaser.Scene, cx: number, cy: number): Phaser.GameObjects.GameObject[] {
    const g = scene.add.graphics().setDepth(1);

    // Outer circle
    g.lineStyle(2, 0xcc0000, 0.5);
    g.strokeCircle(cx, cy, 4 * TILE);

    // Inner circle
    g.lineStyle(1, 0x880000, 0.3);
    g.strokeCircle(cx, cy, 2 * TILE);

    // Pentagram spokes
    g.lineStyle(1, 0xaa0000, 0.3);
    const pts = 5;
    const r = 4 * TILE;
    for (let i = 0; i < pts; i++) {
      const a1 = ((Math.PI * 2) / pts) * i - Math.PI / 2;
      const a2 = ((Math.PI * 2) / pts) * ((i + 2) % pts) - Math.PI / 2;
      g.lineBetween(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r,
                    cx + Math.cos(a2) * r, cy + Math.sin(a2) * r);
    }

    // Pulsing centre dot
    const dot = scene.add.graphics().setDepth(2);
    dot.fillStyle(0xff0000, 0.7);
    dot.fillCircle(cx, cy, 6);
    scene.tweens.add({ targets: dot, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 });

    // Corner rune markers
    const markers: Phaser.GameObjects.Graphics[] = [];
    for (let i = 0; i < pts; i++) {
      const a = ((Math.PI * 2) / pts) * i - Math.PI / 2;
      const mx = cx + Math.cos(a) * r;
      const my = cy + Math.sin(a) * r;
      const m = scene.add.graphics().setDepth(2);
      m.fillStyle(0xcc0000, 0.6);
      m.fillRect(-2, -2, 4, 4);
      m.setPosition(mx, my);
      scene.tweens.add({ targets: m, alpha: 0.15, duration: 600 + i * 150, yoyo: true, repeat: -1 });
      markers.push(m);
    }

    return [g, dot, ...markers];
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
