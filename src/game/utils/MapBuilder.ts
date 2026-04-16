import Phaser from 'phaser';

const TILE = 16;

// Tile type codes
const _ = 0;  // grass
const P = 1;  // path
const W = 2;  // wall
const A = 3;  // arena floor
const G = 4;  // gate (locked)
// const T = 5;  // gate-open placeholder (unused in static map data)
const S = 6;  // sign/NPC spot
const R = 7;  // water (decorative, no collision)

// Map: 40 columns × 30 rows
// Reading order: row 0 = top
export const MAP_COLS = 40;
export const MAP_ROWS = 30;

/* eslint-disable */
const MAP_DATA: number[][] = [
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,P,P,P,P,P,P,P,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,S,_,_,_,_,_,_,_,_,_,_,_,_,P,_,_,_,_,_,P,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,P,_,_,_,_,_,P,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,P,_,R,R,R,_,P,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,P,_,R,R,R,_,P,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,W,W,W,W,W,W,W,_,_,_,_,_,_,_,_,_,P,_,_,_,_,_,P,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,P,P,P,P,P,P,P,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
];
/* eslint-enable */

export interface MapBuildResult {
  walls: Phaser.Physics.Arcade.StaticGroup;
  decorative: Phaser.GameObjects.Group;
  worldWidth: number;
  worldHeight: number;
  spawnX: number;
  spawnY: number;
  // Named positions (in pixels)
  enemy1Pos: { x: number; y: number };
  enemy2Pos: { x: number; y: number };
  enemy3Pos: { x: number; y: number };
  bossPos: { x: number; y: number };
  fragment1Pos: { x: number; y: number };
  fragment2Pos: { x: number; y: number };
  fragment3Pos: { x: number; y: number };
  npcPos: { x: number; y: number };
  gatePos: { x: number; y: number };
  arenaTopLeft: { x: number; y: number };
}

/**
 * Builds the game world from a tile grid.
 * Uses a simple tile layout: top zone = spawn, middle = route, bottom = arena.
 */
export class MapBuilder {
  static build(scene: Phaser.Scene): MapBuildResult {
    const worldWidth = MAP_COLS * TILE;
    const worldHeight = MAP_ROWS * TILE;

    scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    const walls = scene.physics.add.staticGroup();
    const decorative = scene.add.group();

    // ── Zone backgrounds ──────────────────────────────────────────────────
    // Draw zone backgrounds first (large rectangles per zone)
    const bg = scene.add.graphics();

    // Spawn zone (rows 0-11) – lush green
    bg.fillStyle(0x1d3d10);
    bg.fillRect(0, 0, worldWidth, 12 * TILE);

    // Route zone (rows 12-19) – mid section
    bg.fillStyle(0x263d15);
    bg.fillRect(0, 12 * TILE, worldWidth, 8 * TILE);

    // Pre-boss transition + Boss arena (rows 20-29) – dark ominous
    bg.fillStyle(0x0d0d1a);
    bg.fillRect(0, 20 * TILE, worldWidth, 10 * TILE);

    // ── Tile layer ────────────────────────────────────────────────────────
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tileType = MAP_DATA[row][col];
        const px = col * TILE + TILE / 2;
        const py = row * TILE + TILE / 2;

        switch (tileType) {
          case W: {
            // Wall tile — add to static physics group
            const img = scene.add.image(px, py, 'tile-wall');
            img.setDepth(1);
            walls.add(img);
            break;
          }
          case P: {
            const img = scene.add.image(px, py, 'tile-path');
            img.setDepth(0);
            decorative.add(img);
            break;
          }
          case A: {
            const img = scene.add.image(px, py, 'tile-arena');
            img.setDepth(0);
            decorative.add(img);
            break;
          }
          case G: {
            const img = scene.add.image(px, py, 'tile-gate');
            img.setDepth(1);
            img.setName('gate-tile');
            walls.add(img);
            break;
          }
          case R: {
            const img = scene.add.image(px, py, 'tile-water');
            img.setDepth(0);
            decorative.add(img);
            break;
          }
          case S: {
            // NPC spot — just grass underneath
            const img = scene.add.image(px, py, 'tile-path');
            img.setDepth(0);
            decorative.add(img);
            break;
          }
          default:
            break; // grass — bg color handles it
        }
      }
    }

    // ── Grid lines (very subtle) ──────────────────────────────────────────
    const grid = scene.add.graphics();
    grid.lineStyle(1, 0xffffff, 0.04);
    for (let col = 0; col <= MAP_COLS; col++) {
      grid.lineBetween(col * TILE, 0, col * TILE, worldHeight);
    }
    for (let row = 0; row <= MAP_ROWS; row++) {
      grid.lineBetween(0, row * TILE, worldWidth, row * TILE);
    }
    grid.setDepth(0);

    // ── Zone labels (atmospheric text) ───────────────────────────────────
    MapBuilder.addZoneLabel(scene, 3 * TILE, 3 * TILE, 'ECHO FIELDS', 0x4a8a3a, 0.4);
    MapBuilder.addZoneLabel(scene, 3 * TILE, 15 * TILE, 'STATIC WILDS', 0x5a8a4a, 0.35);
    MapBuilder.addZoneLabel(scene, 3 * TILE, 22 * TILE, 'THE VOID GATE', 0x8b0000, 0.5);

    // ── Boss arena ring ───────────────────────────────────────────────────
    const arenaRing = scene.add.graphics();
    arenaRing.lineStyle(3, 0x8b0000, 0.6);
    arenaRing.strokeRect(2 * TILE, 21 * TILE, 14 * TILE, 7 * TILE);
    arenaRing.lineStyle(1, 0xff0000, 0.2);
    arenaRing.strokeRect(3 * TILE, 22 * TILE, 12 * TILE, 5 * TILE);
    arenaRing.setDepth(2);

    // Boss arena floor tiles
    const arenaFloor = scene.add.graphics();
    arenaFloor.fillStyle(0x0a0a14);
    arenaFloor.fillRect(2 * TILE, 21 * TILE, 14 * TILE, 7 * TILE);
    arenaFloor.setDepth(0);

    // Pulsing pentagrams / runes on arena floor
    MapBuilder.drawArenaRunes(scene, 9 * TILE, 24 * TILE);

    // ── Finalize static group ─────────────────────────────────────────────
    walls.refresh();

    // ── Named positions ───────────────────────────────────────────────────
    // Spawn: top-left safe area
    const spawnX = 4 * TILE;
    const spawnY = 3 * TILE;

    // NPC position
    const npcPos = { x: 4 * TILE, y: 2 * TILE };

    // Enemies in Route zone
    const enemy1Pos = { x: 6 * TILE, y: 14 * TILE };
    const enemy2Pos = { x: 12 * TILE, y: 16 * TILE };
    const enemy3Pos = { x: 20 * TILE, y: 15 * TILE };

    // Sound Fragments scattered
    const fragment1Pos = { x: 10 * TILE, y: 8 * TILE };
    const fragment2Pos = { x: 25 * TILE, y: 5 * TILE };
    const fragment3Pos = { x: 30 * TILE, y: 14 * TILE };

    // Gate between Route and Arena
    const gatePos = { x: 9 * TILE, y: 20 * TILE };

    // Boss in center of arena
    const bossPos = { x: 9 * TILE, y: 24 * TILE };

    const arenaTopLeft = { x: 2 * TILE, y: 21 * TILE };

    return {
      walls,
      decorative,
      worldWidth,
      worldHeight,
      spawnX,
      spawnY,
      npcPos,
      enemy1Pos,
      enemy2Pos,
      enemy3Pos,
      fragment1Pos,
      fragment2Pos,
      fragment3Pos,
      gatePos,
      bossPos,
      arenaTopLeft,
    };
  }

  private static addZoneLabel(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    color: number,
    alpha: number
  ): void {
    const label = scene.add.text(x, y, text, {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#' + color.toString(16).padStart(6, '0'),
    });
    label.setDepth(0);
    label.setAlpha(alpha);
  }

  private static drawArenaRunes(scene: Phaser.Scene, cx: number, cy: number): void {
    const g = scene.add.graphics();
    g.lineStyle(1, 0xff0000, 0.3);

    // Simple rune circle
    g.strokeCircle(cx, cy, 3 * TILE);

    // Inner marks
    const pts = 5;
    for (let i = 0; i < pts; i++) {
      const a1 = ((Math.PI * 2) / pts) * i - Math.PI / 2;
      const a2 = ((Math.PI * 2) / pts) * ((i + 2) % pts) - Math.PI / 2;
      const r = 3 * TILE;
      g.lineBetween(
        cx + Math.cos(a1) * r,
        cy + Math.sin(a1) * r,
        cx + Math.cos(a2) * r,
        cy + Math.sin(a2) * r
      );
    }
    g.setDepth(1);
  }
}
