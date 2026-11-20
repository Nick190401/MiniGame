import Phaser from 'phaser';
import { buildTerrainMaps, type TerrainRegions } from './TerrainMaps';
import { paintDirt, paintGrass, paintNoise, paintPaving, paintStone } from './TerrainTextures';
import { TERRAIN_FRAGMENT, TERRAIN_VERTEX } from './terrainShader';
import { addStaticCanvas } from '../../art/worldTexture';

const DETAIL_TEXTURES: Array<[string, () => HTMLCanvasElement]> = [
  ['terrain-grass', paintGrass],
  ['terrain-dirt', paintDirt],
  ['terrain-paving', paintPaving],
  ['terrain-stone', paintStone],
  ['terrain-noise', () => paintNoise(256)],
];

/** Paints the repeating surface textures once per game; cheap to call again. */
export function ensureTerrainTextures(scene: Phaser.Scene): void {
  DETAIL_TEXTURES.forEach(([key, paint]) => {
    if (!scene.textures.exists(key)) addStaticCanvas(scene, key, paint());
  });
}

export interface TerrainLayer {
  readonly shader: Phaser.GameObjects.Shader;
  /** Sends a purifying wave outward from (x, y) over `duration` ms. */
  purify(x: number, y: number, duration: number): void;
  /** Applies the purified cave immediately (e.g. after a reload). */
  setPurified(x: number, y: number): void;
  /** Repaints the splat maps after the grid changed (world editor). */
  redraw(grid: number[][]): void;
}

const REPEAT = { repeat: true, minFilter: 'linear_mipmap_linear', magFilter: 'linear' };
const CLAMP = { wrapS: 'clamp_to_edge', wrapT: 'clamp_to_edge', minFilter: 'linear', magFilter: 'linear' };
const FULLY_PURIFIED_RADIUS = 100000;

export function createTerrainLayer(scene: Phaser.Scene, grid: number[][], regions: TerrainRegions, tileSize: number): TerrainLayer {
  ensureTerrainTextures(scene);
  const maps = buildTerrainMaps(grid, regions);
  if (scene.textures.exists('terrain-maps')) scene.textures.remove('terrain-maps');
  scene.textures.addCanvas('terrain-maps', maps.canvas);

  const worldW = regions.cols * tileSize;
  const worldH = regions.rows * tileSize;
  const base = new Phaser.Display.BaseShader('terrain', TERRAIN_FRAGMENT, TERRAIN_VERTEX, {
    uMaps: { type: 'sampler2D', value: null },
    uGrass: { type: 'sampler2D', value: null },
    uDirt: { type: 'sampler2D', value: null },
    uPaving: { type: 'sampler2D', value: null },
    uStone: { type: 'sampler2D', value: null },
    uNoise: { type: 'sampler2D', value: null },
    uMapCell: { type: '2f', value: { x: maps.cellWidth, y: maps.cellHeight } },
    uMapAtlas: { type: '2f', value: { x: maps.canvas.width, y: maps.canvas.height } },
    uCaveY: { type: '1f', value: regions.caveStartRow * tileSize },
    uPurifyCenter: { type: '2f', value: { x: worldW / 2, y: worldH } },
    uPurifyRadius: { type: '1f', value: 0 },
    uPurifyFront: { type: '1f', value: 0 },
  });

  const shader = scene.add.shader(base, 0, 0, worldW, worldH).setOrigin(0, 0).setDepth(-10).setName('terrain');
  shader.setSampler2D('uMaps', 'terrain-maps', 0, CLAMP);
  shader.setSampler2D('uGrass', 'terrain-grass', 1, REPEAT);
  shader.setSampler2D('uDirt', 'terrain-dirt', 2, REPEAT);
  shader.setSampler2D('uPaving', 'terrain-paving', 3, REPEAT);
  shader.setSampler2D('uStone', 'terrain-stone', 4, REPEAT);
  shader.setSampler2D('uNoise', 'terrain-noise', 5, REPEAT);

  const setCenter = (x: number, y: number) => shader.setUniform('uPurifyCenter.value', { x, y });

  return {
    shader,
    purify(x, y, duration) {
      setCenter(x, y);
      const wave = { radius: 0, front: 0 };
      const reach = Math.hypot(worldW, worldH - regions.caveStartRow * tileSize) + 200;
      scene.tweens.add({
        targets: wave,
        radius: reach,
        duration,
        ease: 'Sine.easeIn',
        onUpdate: () => {
          shader.setUniform('uPurifyRadius.value', wave.radius);
          shader.setUniform('uPurifyFront.value', Math.min(1, wave.radius / 60) * (1 - wave.radius / reach));
        },
        onComplete: () => {
          shader.setUniform('uPurifyRadius.value', FULLY_PURIFIED_RADIUS);
          shader.setUniform('uPurifyFront.value', 0);
        },
      });
    },
    setPurified(x, y) {
      setCenter(x, y);
      shader.setUniform('uPurifyRadius.value', FULLY_PURIFIED_RADIUS);
      shader.setUniform('uPurifyFront.value', 0);
    },
    redraw(next) {
      // Same canvas and GL texture, so the shader's sampler stays bound.
      buildTerrainMaps(next, regions, maps.canvas);
      scene.textures.get('terrain-maps').source[0].update();
    },
  };
}
