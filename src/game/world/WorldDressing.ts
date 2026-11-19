import Phaser from 'phaser';
import { TILE_ID as T } from '../data/tileIds';
import { OVERWORLD_LANDMARKS, type LandmarkStamp } from '../maps/PokemonOverworld';
import { hash2 } from '../art/paint';
import { addWorldImage, standingDepth, WORLD_TEXTURE_SCALE } from '../art/worldTexture';
import { TREE_SIZE, VEGETATION } from '../art/vegetation';
import { FX } from '../art/fx';
import { STRUCTURES } from '../art/structures';
import { CAVE_ART, CAVE_BRAZIERS } from '../art/caveArt';
import { LANDMARK_ART } from '../art/landmarkArt';
import { buildingTileTexture, isBuildingTile, isDoorTile } from '../art/buildingTiles';
import { WorldCulling } from './WorldCulling';
import type { LightSource } from './WorldLighting';

export interface DressingContext {
  tile: number;
  cols: number;
  rows: number;
  walls: Phaser.Physics.Arcade.StaticGroup;
  decorative: Phaser.GameObjects.Group;
  bridge: { top: number; bottom: number; left: number; right: number };
  zoneRows: {
    signal: number; brook: number; junction: number; grove: number;
    gate: number; fading: number; cave: number; core: number;
  };
  gateCenterCol: number;
  bossCore: { col: number; row: number };
}

export interface DressingResult {
  tallGrassFrontTiles: Phaser.GameObjects.Image[];
  caveSurfaceTiles: Phaser.GameObjects.Image[];
  caveCorruptionObjects: Phaser.GameObjects.GameObject[];
  runeGraphics: Phaser.GameObjects.GameObject[];
  universePortals: Array<{ x: number; y: number }>;
  /** Light sources that carve through the underground darkness. */
  lights: LightSource[];
}

const CAVE_PROP_TILES = new Set<number>([T.CRYSTAL, T.PILLAR, T.WALL_RUNE, T.SKULL, T.STALACTITE, T.BOULDER]);
/** Additive glows sit above the underground darkness so they bloom instead of being dimmed. */
const GLOW_DEPTH = 41;

/** A landmark building and its ground shadow, as the overworld (and the editor) shows it. */
export function placeLandmark(scene: Phaser.Scene, landmark: LandmarkStamp, tile: number): {
  objects: Phaser.GameObjects.Image[];
  rect: { left: number; top: number; width: number; height: number };
} {
  const art = LANDMARK_ART[landmark.texture];
  const left = landmark.col * tile;
  const top = landmark.row * tile;
  const width = landmark.width * tile;
  const height = landmark.height * tile;
  const base = top + height;
  const objects: Phaser.GameObjects.Image[] = [];
  if (art?.shadow !== false) {
    objects.push(addWorldImage(scene, left + width * 0.56, base - 4, FX.shadow)
      .setDisplaySize(width * 1.08, Math.max(18, height * 0.32)).setAlpha(0.42).setDepth(0.6));
  }
  const image = addWorldImage(scene, left, top, landmark.texture)
    .setOrigin(0, 0)
    .setDisplaySize(width, height)
    .setDepth(art?.ground ? 3.5 : standingDepth(base - (art?.sortInset ?? 4)));
  if (landmark.flipX) image.setFlipX(true);
  objects.push(image);
  return { objects, rect: { left, top, width, height } };
}

/**
 * Places every standing object of the world on top of the terrain shader:
 * forests, meadow grass, flowers, water life, structures, buildings and the
 * cave. Collision for the tile grid lives in MapBuilder; only objects that
 * add their own footprint (trees in open fields, bridge rails) add colliders.
 */
export function dressWorld(scene: Phaser.Scene, grid: number[][], ctx: DressingContext): DressingResult {
  const { tile: TILE, cols, rows, walls, decorative, zoneRows } = ctx;
  const culling = new WorldCulling(scene);
  const add = (object: Phaser.GameObjects.GameObject & { x: number; y: number }, cull = true) => {
    decorative.add(object);
    if (cull) culling.track(object as Phaser.GameObjects.Image);
    return object;
  };
  const at = (r: number, c: number) => grid[r]?.[c];
  const cx = (c: number) => c * TILE + TILE / 2;
  const cy = (r: number) => r * TILE + TILE / 2;

  const result: DressingResult = {
    tallGrassFrontTiles: [], caveSurfaceTiles: [], caveCorruptionObjects: [], runeGraphics: [], universePortals: [], lights: [],
  };

  // Later zones are cooler and darker: the world drifts toward the silence.
  const zoneTint = (row: number) => row >= zoneRows.fading ? 0xb9bfae
    : row >= zoneRows.grove ? 0xc8d6c0
      : row >= zoneRows.junction ? 0xdfe8e2 : 0xffffff;

  const shadow = (x: number, y: number, w: number, h: number, alpha: number, depth = 0.6) => {
    const s = addWorldImage(scene, x, y, FX.shadow)
      .setDisplaySize(w, h).setAlpha(alpha).setDepth(depth);
    return add(s);
  };

  // ── Meadow grass, flowers and signs ──────────────────────────────────────
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = at(r, c);
      const seed = hash2(r, c, 7);
      if (t === T.TALL_GRASS) {
        const v = Math.floor(seed * VEGETATION.variants.tallGrass);
        const flip = hash2(r + 31, c + 17, 3) > 0.5;
        const tint = zoneTint(r);
        const bottom = (r + 1) * TILE;
        const back = addWorldImage(scene, cx(c) + (seed - 0.5) * 3, bottom - 2, VEGETATION.tallGrassBack(v))
          .setOrigin(0.5, 1).setFlipX(flip).setTint(tint).setDepth(1);
        add(back);
        const front = addWorldImage(scene, cx(c) + (seed - 0.5) * 2, bottom, VEGETATION.tallGrassFront((v + 1) % VEGETATION.variants.tallGrass))
          .setOrigin(0.5, 1).setFlipX(!flip).setTint(tint)
          .setDepth(standingDepth(bottom) + 0.0001)
          .setName('tall-grass-front')
          .setData('row', r).setData('col', c).setData('baseScale', WORLD_TEXTURE_SCALE);
        add(front);
        result.tallGrassFrontTiles.push(front);
      } else if (t === T.FLOWER) {
        const v = Math.floor(seed * VEGETATION.variants.flowers);
        add(addWorldImage(scene, cx(c), (r + 1) * TILE - 1, VEGETATION.flowers(v)).setOrigin(0.5, 1).setDepth(3).setFlipX(seed > 0.5));
      } else if (t === T.SIGN) {
        const foot = (r + 1) * TILE - 2;
        shadow(cx(c) + 3, foot, 16, 6, 0.35);
        add(addWorldImage(scene, cx(c), foot, STRUCTURES.sign).setOrigin(0.5, 1).setDepth(standingDepth(foot)));
      } else if (isBuildingTile(t)) {
        // Free-form houses from the world editor, sorted by their own tile row
        // (doors slightly earlier, so a player in the doorway stands in front).
        const key = buildingTileTexture(scene, grid, r, c)!;
        const sortY = isDoorTile(t) ? r * TILE + 2 : (r + 1) * TILE;
        add(addWorldImage(scene, c * TILE, r * TILE, key).setOrigin(0, 0).setTint(zoneTint(r)).setDepth(standingDepth(sortY)));
        if (!isBuildingTile(at(r + 1, c))) shadow(cx(c) + 3, (r + 1) * TILE + 1, 24, 7, 0.32);
      }
    }
  }

  // ── Water life: lilies on open water, reeds along calm banks ─────────────
  const isWater = (r: number, c: number) => at(r, c) === T.WATER;
  const inBridge = (r: number, c: number) => r >= ctx.bridge.top - 1 && r <= ctx.bridge.bottom + 1 && c >= ctx.bridge.left - 1 && c <= ctx.bridge.right + 1;
  for (let r = 1; r < zoneRows.cave; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (!isWater(r, c) || inBridge(r, c)) continue;
      const seed = hash2(r * 11 + c, c * 5 + r, 13);
      const enclosed = isWater(r - 1, c) && isWater(r + 1, c) && isWater(r, c - 1) && isWater(r, c + 1);
      if (enclosed && seed < 0.1) {
        const lily = addWorldImage(scene, cx(c) + (seed - 0.05) * 60, cy(r) + (hash2(r, c, 2) - 0.5) * 6, VEGETATION.lily(seed < 0.05 ? 0 : 1))
          .setDepth(0.4).setAngle(seed * 3600);
        add(lily);
        scene.tweens.add({ targets: lily, y: lily.y + 0.8, angle: lily.angle + 6, duration: 2600 + seed * 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      const bankNorth = !isWater(r - 1, c) && at(r - 1, c) !== T.PATH;
      if (bankNorth && seed > 0.62) {
        add(addWorldImage(scene, cx(c) + (seed - 0.8) * 20, r * TILE + 5, VEGETATION.reeds).setOrigin(0.5, 1).setDepth(standingDepth(r * TILE + 5)));
      }
    }
  }

  // ── Forest belts frame the world instead of hard walls ───────────────────
  const treeKey = (r: number, seed: number) => {
    const coniferChance = r >= zoneRows.grove ? 0.55 : r >= zoneRows.junction ? 0.3 : 0.12;
    return seed < coniferChance
      ? { key: VEGETATION.conifer(Math.floor(seed * 97) % VEGETATION.variants.conifer), size: TREE_SIZE.conifer, conifer: true }
      : { key: VEGETATION.broadleaf(Math.floor(seed * 89) % VEGETATION.variants.broadleaf), size: TREE_SIZE.broadleaf, conifer: false };
  };
  const plantTree = (x: number, footY: number, seed: number, row: number, scale = 1, collide = false) => {
    const kind = treeKey(row, seed);
    const tint = zoneTint(row);
    shadow(x + kind.size.w * 0.18 * scale, footY - 2, kind.size.w * 0.8 * scale, kind.size.w * 0.24 * scale, 0.42, 0.55);
    const tree = addWorldImage(scene, x, footY, kind.key)
      .setOrigin(0.5, (kind.size.h - kind.size.footInset) / kind.size.h)
      .setScale(WORLD_TEXTURE_SCALE * scale)
      .setFlipX(seed > 0.5)
      .setTint(tint)
      .setDepth(standingDepth(footY));
    add(tree);
    // Gentle wind sway around the trunk base.
    scene.tweens.add({
      targets: tree, angle: { from: -0.5, to: 0.6 }, duration: 2600 + seed * 1800,
      delay: seed * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    if (collide) {
      walls.add(scene.add.zone(x, footY - 3, 10 * scale, 6 * scale).setName('tree-trunk'));
    }
  };

  const beltTop = 1, beltBottom = 112;
  for (const side of [0, 1] as const) {
    for (let y = beltTop * TILE - 6; y < beltBottom * TILE; y += 19) {
      for (let lane = 0; lane < 3; lane++) {
        const seed = hash2(Math.floor(y), lane + side * 7, 41);
        const laneX = 10 + lane * 21 + (seed - 0.5) * 10;
        const x = side === 0 ? laneX : cols * TILE - laneX;
        const footY = y + (lane % 2) * 9 + (hash2(lane, Math.floor(y), 3) - 0.5) * 8;
        const row = Math.floor(footY / TILE);
        const t = at(Math.min(rows - 1, Math.max(0, row)), side === 0 ? lane : cols - 1 - lane);
        if (t !== T.LANDMARK && t !== T.WALL) continue;
        plantTree(x, footY, seed, row, 0.92 + hash2(lane, Math.floor(y), 9) * 0.22);
      }
    }
  }
  // Trees painted tile by tile in the world editor (the tile itself already blocks).
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (at(r, c) !== T.TREE) continue;
      const seed = hash2(r, c, 71);
      const foot = (at(r + 1, c) === T.TRUNK ? r + 2 : r + 1) * TILE - 2;
      plantTree(cx(c) + (seed - 0.5) * 4, foot, hash2(c, r, 73), r, 0.62 + seed * 0.16);
    }
  }
  // A canopy line along the northern edge closes the village.
  for (let x = 70; x < cols * TILE - 64; x += 26) {
    const seed = hash2(x, 0, 51);
    plantTree(x + (seed - 0.5) * 10, 10 + seed * 4, seed, 0, 0.95);
  }

  // ── Open meadows: small groves, bushes and stones ────────────────────────
  const clearRadius = (r: number, c: number, radius: number) => {
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      const t = at(r + dr, c + dc);
      if (t === undefined) return false;
      if (t !== T.GRASS) return false;
    }
    return true;
  };
  const occupied: Array<[number, number]> = [];
  const farFrom = (r: number, c: number, min: number) => occupied.every(([or, oc]) => Math.abs(or - r) + Math.abs(oc - c) >= min);
  // Keep the opening cutscene stage and the respawn green free.
  const reserved = [
    { r: 15, c: 32, radius: 4 }, { r: 11, c: 28, radius: 4 }, { r: 70, c: 31, radius: 4 }, { r: 67, c: 44, radius: 4 },
  ];
  const isReserved = (r: number, c: number) => reserved.some(z => Math.abs(z.r - r) <= z.radius && Math.abs(z.c - c) <= z.radius);
  for (let r = 2; r < 110; r++) {
    for (let c = 5; c < cols - 5; c++) {
      if (isReserved(r, c)) continue;
      const seed = hash2(r, c, 101);
      if (seed < 0.075 && clearRadius(r, c, 2) && farFrom(r, c, 5)) {
        plantTree(cx(c) + (seed - 0.04) * 60, (r + 1) * TILE - 2, hash2(c, r, 5), r, 0.85 + seed * 2, true);
        occupied.push([r, c]);
      } else if (seed > 0.94 && clearRadius(r, c, 1) && farFrom(r, c, 3)) {
        const v = Math.floor(hash2(r, c, 6) * VEGETATION.variants.bush);
        const foot = (r + 1) * TILE - 3;
        shadow(cx(c) + 4, foot, 26, 8, 0.32);
        add(addWorldImage(scene, cx(c), foot, VEGETATION.bush(v)).setOrigin(0.5, 0.88).setTint(zoneTint(r)).setDepth(standingDepth(foot)));
        occupied.push([r, c]);
      } else if (seed > 0.905 && seed < 0.915 && clearRadius(r, c, 1)) {
        const v = Math.floor(hash2(r, c, 8) * VEGETATION.variants.rock);
        add(addWorldImage(scene, cx(c), (r + 1) * TILE - 4, VEGETATION.rock(v)).setOrigin(0.5, 0.8).setDepth(2));
      }
    }
  }

  // ── Buildings ─────────────────────────────────────────────────────────────
  OVERWORLD_LANDMARKS.forEach((landmark) => {
    const placed = placeLandmark(scene, landmark, TILE);
    placed.objects.forEach((o) => add(o));
    LANDMARK_ART[landmark.texture]?.decorate?.(scene, placed.rect, (o) => add(o));
  });

  // ── Brookside bridge ──────────────────────────────────────────────────────
  const { bridge } = ctx;
  const bridgeLeft = bridge.left * TILE, bridgeTop = bridge.top * TILE;
  const bridgeW = (bridge.right - bridge.left + 1) * TILE, bridgeH = (bridge.bottom - bridge.top + 1) * TILE;
  add(addWorldImage(scene, bridgeLeft + bridgeW / 2 + 6, bridgeTop + bridgeH / 2 + 8, FX.shadow)
    .setDisplaySize(bridgeW * 1.05, bridgeH * 0.9).setAlpha(0.35).setDepth(0.12));
  add(addWorldImage(scene, bridgeLeft, bridgeTop, STRUCTURES.bridgeDeck).setOrigin(0, 0).setDepth(0.15));
  for (const railCol of [bridge.left, bridge.right]) {
    const railX = railCol === bridge.left ? railCol * TILE + 3 : (railCol + 1) * TILE - 3;
    for (let r = bridge.top; r <= bridge.bottom; r++) {
      const bottom = (r + 1) * TILE;
      add(addWorldImage(scene, railX, bottom, STRUCTURES.bridgeRail).setOrigin(0.5, 1).setDepth(standingDepth(bottom)).setName('bridge-rail'));
      // Collision follows only the side rails; both approaches remain open.
      walls.add(scene.add.zone(railX, r * TILE + TILE / 2, 8, TILE).setName('bridge-rail-blocker'));
    }
    for (const offset of [8, 36, 64, 92]) {
      const footY = bridgeTop + offset;
      add(addWorldImage(scene, railX, footY, STRUCTURES.bridgePost).setOrigin(0.5, 1).setDepth(standingDepth(footY) + 0.0001).setName('bridge-post'));
    }
  }

  // ── Frequency Gate: masonry wall with the sliding doors in its centre ────
  const gateRow = zoneRows.gate;
  const gateTop = gateRow * TILE;
  let runStart = -1;
  for (let c = 0; c <= cols; c++) {
    const isWall = c < cols && at(gateRow, c) === T.WALL;
    if (isWall && runStart < 0) runStart = c;
    if (!isWall && runStart >= 0) {
      const x0 = runStart * TILE, x1 = c * TILE;
      const wall = scene.add.tileSprite(x0, gateTop - 10, x1 - x0, 54, STRUCTURES.gateWall)
        .setOrigin(0, 0).setTileScale(WORLD_TEXTURE_SCALE).setDepth(standingDepth(gateTop + 32) - 0.001);
      add(wall);
      add(addWorldImage(scene, x0, gateTop + 30, FX.shadow).setOrigin(0, 0.5).setDisplaySize(x1 - x0, 16).setAlpha(0.4).setDepth(0.7));
      runStart = -1;
    }
  }
  const gateCenterX = ctx.gateCenterCol * TILE;
  const gateCenterY = (gateRow + 1) * TILE;
  const gateDepth = standingDepth(gateTop + 32);
  add(addWorldImage(scene, gateCenterX - 16, gateCenterY, STRUCTURES.gatePanelLeft).setDepth(gateDepth).setName('gate-panel-left'), false);
  add(addWorldImage(scene, gateCenterX + 16, gateCenterY, STRUCTURES.gatePanelRight).setDepth(gateDepth).setName('gate-panel-right'), false);
  add(addWorldImage(scene, gateCenterX, gateTop + 34, STRUCTURES.gateFrame).setOrigin(0.5, 1).setDepth(gateDepth + 0.0002).setName('gate-frame'), false);

  // ── The cave ──────────────────────────────────────────────────────────────
  // Props are scanned over the whole map: the editor may place them above ground too.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = at(r, c);
      if (!CAVE_PROP_TILES.has(t) && t !== T.PORTAL) continue;
      const x = cx(c), foot = (r + 1) * TILE - 2;
      const seed = hash2(r, c, 61);
      const prop = (key: string, purified: string, origin: number, depth: number, y = foot) => {
        const image = addWorldImage(scene, x, y, key).setOrigin(0.5, origin).setDepth(depth)
          .setName('cave-surface').setData('purifiedTexture', purified).setFlipX(seed > 0.5);
        add(image);
        result.caveSurfaceTiles.push(image);
        return image;
      };
      switch (t) {
        case T.CRYSTAL: {
          prop(CAVE_ART.crystal, CAVE_ART.crystalPurified, 0.92, standingDepth(foot));
          const glow = addWorldImage(scene, x, foot - 9, FX.glow).setDisplaySize(44, 44)
            .setTint(0x3fe0c5).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH);
          add(glow);
          scene.tweens.add({ targets: glow, alpha: 0.12, duration: 1200 + seed * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          result.lights.push({ x, y: foot - 8, radius: 40, intensity: 0.55 });
          break;
        }
        case T.PILLAR: prop(CAVE_ART.pillar, CAVE_ART.pillarPurified, 0.94, standingDepth(foot)); break;
        case T.WALL_RUNE: {
          prop(CAVE_ART.rune, CAVE_ART.runePurified, 0.5, 1.2, cy(r) + 2);
          const glow = addWorldImage(scene, x, cy(r) + 2, FX.glow).setDisplaySize(30, 30)
            .setTint(0xff5a3c).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH);
          add(glow);
          result.caveCorruptionObjects.push(glow);
          scene.tweens.add({ targets: glow, alpha: 0.08, duration: 900 + seed * 600, yoyo: true, repeat: -1 });
          result.lights.push({ x, y: cy(r), radius: 18, intensity: 0.3 });
          break;
        }
        case T.SKULL: {
          const bones = addWorldImage(scene, x, foot - 2, CAVE_ART.bones).setOrigin(0.5, 0.8).setDepth(1).setFlipX(seed > 0.5);
          add(bones);
          result.caveCorruptionObjects.push(bones);
          break;
        }
        case T.STALACTITE: prop(CAVE_ART.stalagmite, CAVE_ART.stalagmitePurified, 0.94, standingDepth(foot)); break;
        case T.BOULDER: prop(CAVE_ART.boulder, CAVE_ART.boulderPurified, 0.86, standingDepth(foot)); break;
        case T.PORTAL: {
          const portal = scene.add.container(x, cy(r)).setDepth(standingDepth(cy(r) + 8)).setName('universe-portal');
          const frame = addWorldImage(scene, 0, 8, CAVE_ART.portalFrame).setOrigin(0.5, 1);
          const energy = addWorldImage(scene, 0, -45, CAVE_ART.portalEnergy).setAlpha(0.85).setBlendMode(Phaser.BlendModes.ADD);
          const halo = addWorldImage(scene, 0, -45, FX.glow).setDisplaySize(120, 120).setTint(0x9270db).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
          const plaque = scene.add.graphics();
          plaque.fillStyle(0x120f1c, 0.9).fillRoundedRect(-34, -100, 68, 13, 3);
          plaque.lineStyle(0.6, 0xb59cf0, 0.8).strokeRoundedRect(-34, -100, 68, 13, 3);
          const label = scene.add.text(0, -93.5, 'UNIVERSE // SOON', {
            fontFamily: 'DM Mono', fontSize: '5.5px', color: '#e2d6ff',
          }).setOrigin(0.5);
          portal.add([halo, frame, energy, plaque, label]);
          add(portal, false);
          scene.tweens.add({ targets: energy, angle: 360, duration: 14000, repeat: -1, ease: 'Linear' });
          scene.tweens.add({ targets: [energy, halo], alpha: { from: 0.55, to: 0.95 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          // Solid feet and the sealed threshold stop entry without sealing the room.
          walls.add(scene.add.zone(x, cy(r) - 4, 72, 16).setName('universe-portal-blocker'));
          result.universePortals.push({ x, y: cy(r) });
          result.lights.push({ x, y: cy(r) - 40, radius: 90, intensity: 0.85, flicker: 0.05 });
          break;
        }
      }
    }
  }

  // Walkable void fissures add danger without introducing invisible damage.
  for (const [row, col, angle] of [
    [121, 31, -18], [124, 18, 24], [128, 12, -8], [132, 31, 78], [136, 37, 12],
    [139, 16, -42], [141, 46, 28], [145, 27, 82], [147, 37, -24], [154, 20, 18],
    [157, 43, -36], [159, 31, 70],
  ] as Array<[number, number, number]>) {
    const fissure = addWorldImage(scene, cx(col), cy(row), CAVE_ART.fissure)
      .setDepth(0.7).setAngle(angle).setBlendMode(Phaser.BlendModes.ADD).setName('cave-corruption');
    add(fissure);
    result.caveCorruptionObjects.push(fissure);
    scene.tweens.add({ targets: fissure, alpha: { from: 0.5, to: 1 }, duration: 620 + (row % 5) * 110, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    result.lights.push({ x: cx(col), y: cy(row), radius: 24, intensity: 0.35, flicker: 0.2 });
  }
  CAVE_BRAZIERS.forEach(([col, row]) => result.lights.push({ x: col * TILE, y: row * TILE - 2, radius: 70, intensity: 0.9, flicker: 0.12 }));
  result.lights.push({ x: ctx.bossCore.col * TILE, y: ctx.bossCore.row * TILE, radius: 120, intensity: 0.62 });

  result.runeGraphics.push(...CAVE_ART.drawCoreCircle(scene, ctx.bossCore.col * TILE, ctx.bossCore.row * TILE));
  result.caveCorruptionObjects.push(...CAVE_ART.drawCaveAtmosphere(scene, {
    tile: TILE, cols, rows, caveStartRow: zoneRows.cave, coreStartRow: zoneRows.core, bossCore: ctx.bossCore,
  }));

  culling.start();
  return result;
}
