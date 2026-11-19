import { TILE_ID as T } from '../../data/tileIds';

/**
 * Converts the semantic tile grid into a small splat atlas the terrain shader
 * samples with bilinear filtering. Each map stores three material weights in
 * RGB (alpha is never used: canvas and WebGL premultiply it away).
 *
 *   map 0  R dirt road   G water        B paving
 *   map 1  R lush grass  G forest floor B worn ground
 *   map 2  R cave floor  G arena        B raised rock (cliffs, cave walls)
 *   map 3  R water depth G rock depth   B cave stairs
 */
export const TERRAIN_MAP_COUNT = 4;
/** Each map is padded by one replicated texel so bilinear taps never bleed. */
export const TERRAIN_MAP_PAD = 1;

export interface TerrainRegions {
  cols: number;
  rows: number;
  /** First row of the cave (everything below is underground). */
  caveStartRow: number;
  /** Rows [start, end) are paved Neon Junction streets. */
  junctionRows: [number, number];
  /** Bridge deck rectangle: water continues under all but its end rows, which rest on the banks. */
  bridge: { top: number; bottom: number; left: number; right: number };
  /** Rows of the Frequency Gate masonry, drawn as sprites instead of rock. */
  gateRows: [number, number];
  /** Columns of the forest belts along the map edges. */
  borderCols: number;
}

export interface TerrainMapResult {
  canvas: HTMLCanvasElement;
  /** Width/height of one padded map cell in texels. */
  cellWidth: number;
  cellHeight: number;
}

const ROCK_TILES = new Set<number>([T.CAVE_WALL, T.WALL_RUNE]);
const CAVE_FLOOR_TILES = new Set<number>([
  T.CAVE_FLOOR, T.CRYSTAL, T.PILLAR, T.SKULL, T.STALACTITE, T.BOULDER, T.PORTAL, T.CAVE_STAIRS,
]);
const DIRT_TILES = new Set<number>([
  T.PATH, T.GATE, T.DOOR, T.IRON_DOOR, T.BUILDING_WALL, T.STONE_WALL, T.WALL_WINDOW,
  T.STONE_WINDOW, T.ROOF, T.ROOF_BLUE, T.ROOF_GRAY,
]);

/** Multi-source BFS distance (in tiles) from every tile outside `inside`. */
function distanceInside(grid: number[][], inside: (r: number, c: number) => boolean, cap: number): Float32Array {
  const rows = grid.length, cols = grid[0].length;
  const dist = new Float32Array(rows * cols).fill(cap);
  const queue: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!inside(r, c)) { dist[r * cols + c] = 0; queue.push(r * cols + c); }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const r = Math.floor(i / cols), c = i % cols;
    const d = dist[i] + 1;
    if (d >= cap) continue;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const j = nr * cols + nc;
      if (dist[j] > d) { dist[j] = d; queue.push(j); }
    }
  }
  return dist;
}

/** Paints the maps into `target` when given (the editor repaints in place), else a new canvas. */
export function buildTerrainMaps(grid: number[][], regions: TerrainRegions, target?: HTMLCanvasElement): TerrainMapResult {
  const { cols, rows, caveStartRow, junctionRows, bridge, gateRows, borderCols } = regions;
  const cellWidth = cols + TERRAIN_MAP_PAD * 2;
  const cellHeight = rows + TERRAIN_MAP_PAD * 2;
  const canvas = target ?? document.createElement('canvas');
  canvas.width = cellWidth * TERRAIN_MAP_COUNT;
  canvas.height = cellHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const image = ctx.createImageData(canvas.width, canvas.height);
  const data = image.data;

  // The deck's end rows rest on the banks; only the rows between them span the
  // river, so water stays under the deck instead of showing past its ends.
  const spansRiver = (r: number, c: number) => r > bridge.top && r < bridge.bottom && c >= bridge.left && c <= bridge.right;
  const isWater = (r: number, c: number) => {
    const t = grid[r]?.[c];
    return t === T.WATER || t === T.CAVE_WATER || (t === T.PATH && spansRiver(r, c));
  };
  const isRock = (r: number, c: number) => {
    const t = grid[r]?.[c];
    if (ROCK_TILES.has(t)) return true;
    return t === T.WALL && !(r >= gateRows[0] && r <= gateRows[1]);
  };
  const waterDepth = distanceInside(grid, isWater, 5);
  const rockDepth = distanceInside(grid, isRock, 7);

  const put = (map: number, r: number, c: number, rgb: [number, number, number]) => {
    const x = map * cellWidth + c + TERRAIN_MAP_PAD;
    const y = r + TERRAIN_MAP_PAD;
    const i = (y * canvas.width + x) * 4;
    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      const underground = r >= caveStartRow;
      const water = isWater(r, c);
      const rock = isRock(r, c);
      const junction = r >= junctionRows[0] && r < junctionRows[1];
      const border = c < borderCols || c >= cols - borderCols;
      const gateRow = r >= gateRows[0] && r <= gateRows[1];

      let dirt = 0, paving = 0, lush = 0, forest = 0, worn = 0, caveFloor = 0, arena = 0, stairs = 0;
      if (!water && !rock) {
        if (DIRT_TILES.has(t) || (gateRow && t === T.WALL)) {
          if (junction && t === T.PATH) paving = 255; else dirt = 255;
        } else if (t === T.TALL_GRASS) {
          lush = 255;
        } else if (t === T.LANDMARK && !underground) {
          if (border) forest = 255; else worn = 160;
        } else if (t === T.TREE || t === T.TRUNK) {
          forest = 255;
        } else if (t === T.ARENA) {
          arena = 255;
        } else if (CAVE_FLOOR_TILES.has(t) || (underground && t !== T.GRASS)) {
          caveFloor = 255;
          if (t === T.CAVE_STAIRS) stairs = 255;
        }
      }
      if (underground && rock) caveFloor = 0;

      const i = r * cols + c;
      put(0, r, c, [dirt, water ? 255 : 0, paving]);
      put(1, r, c, [lush, forest, worn]);
      put(2, r, c, [caveFloor, arena, rock ? 255 : 0]);
      put(3, r, c, [
        Math.round(Math.min(1, waterDepth[i] / 4) * 255),
        Math.round(Math.min(1, rockDepth[i] / 6) * 255),
        stairs,
      ]);
    }
  }

  // Replicate the outer texel ring of every map into its padding.
  for (let map = 0; map < TERRAIN_MAP_COUNT; map++) {
    const x0 = map * cellWidth;
    const copy = (fx: number, fy: number, tx: number, ty: number) => {
      const f = (fy * canvas.width + fx) * 4, to = (ty * canvas.width + tx) * 4;
      for (let k = 0; k < 4; k++) data[to + k] = data[f + k];
    };
    for (let y = 0; y < cellHeight; y++) {
      const sy = Math.min(rows, Math.max(1, y));
      copy(x0 + 1, sy, x0, y);
      copy(x0 + cols, sy, x0 + cols + 1, y);
      for (let x = 1; x <= cols; x++) {
        if (y === 0) copy(x0 + x, 1, x0 + x, 0);
        if (y === cellHeight - 1) copy(x0 + x, rows, x0 + x, y);
      }
    }
  }

  ctx.putImageData(image, 0, 0);
  return { canvas, cellWidth, cellHeight };
}
