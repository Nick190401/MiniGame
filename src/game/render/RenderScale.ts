import Phaser from 'phaser';

/**
 * Gameplay, physics and layout keep working in logical units (the classic
 * 640 x 480 board, or 480 x N in portrait). The canvas itself renders at a
 * multiple of that size so artwork, text and vector effects stay sharp on
 * high-density screens; every camera applies the multiple as zoom.
 *
 * The value is fixed at boot because all generated artwork is drawn at a
 * matching texel density.
 */
const MIN_RENDER_SCALE = 1.5;
const MAX_RENDER_SCALE = 2.5;
// Keeps phones with very tall viewports within a sensible fill-rate budget.
const MAX_CANVAS_PIXELS = 3_200_000;

function computeRenderScale(): number {
  if (typeof window === 'undefined') return 2;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const screenW = Math.max(window.screen?.width ?? 0, window.innerWidth, 320);
  const screenH = Math.max(window.screen?.height ?? 0, window.innerHeight, 240);
  const portrait = window.matchMedia?.('(max-width: 760px) and (orientation: portrait)').matches ?? false;
  const fit = portrait ? screenW / 480 : Math.min(screenW / 640, screenH / 480);
  let scale = Phaser.Math.Clamp(Math.round(fit * dpr * 4) / 4, MIN_RENDER_SCALE, MAX_RENDER_SCALE);
  const logicalPixels = portrait ? 480 * Math.min(1180, (screenH / screenW) * 480) : 640 * 480;
  while (scale > MIN_RENDER_SCALE && logicalPixels * scale * scale > MAX_CANVAS_PIXELS) scale -= 0.25;
  return scale;
}

export const RENDER_SCALE = computeRenderScale();

/** The overworld is framed at twice the logical board (20 x 15 tiles). */
export const WORLD_ZOOM = 2 * RENDER_SCALE;

/** Texture texels per world unit, so world art samples close to 1:1. */
export const TEXEL = WORLD_ZOOM;

/** Converts a logical camera zoom (as authored for the 640 x 480 board) to canvas zoom. */
export const canvasZoom = (logicalZoom: number) => logicalZoom * RENDER_SCALE;

export interface LogicalSize {
  width: number;
  height: number;
}

/** The layout size a scene is designed against, independent of canvas density. */
export function logicalSize(scene: Phaser.Scene): LogicalSize {
  return { width: scene.scale.width / RENDER_SCALE, height: scene.scale.height / RENDER_SCALE };
}

/**
 * Screen-space scenes (loading, battle, death, cinematic UI) lay out in logical
 * units; their camera maps that board onto the dense canvas.
 */
export function useLogicalCamera(scene: Phaser.Scene): void {
  // Zoom and origin survive canvas resizes; only the viewport size changes.
  scene.cameras.main.setOrigin(0, 0).setZoom(RENDER_SCALE);
}

let hiDpiTextInstalled = false;

/**
 * Phaser text renders to its own canvas at resolution 1 unless told otherwise,
 * which turns blurry once a camera zooms it. Every authored resolution is
 * treated as relative to the logical board and multiplied by the canvas scale.
 */
export function installHiDpiText(): void {
  if (hiDpiTextInstalled) return;
  hiDpiTextInstalled = true;

  const textProto = Phaser.GameObjects.Text.prototype as unknown as {
    setResolution: (value: number) => Phaser.GameObjects.Text;
  };
  const baseSetResolution = textProto.setResolution;
  textProto.setResolution = function setResolution(this: Phaser.GameObjects.Text, value: number) {
    return baseSetResolution.call(this, value * RENDER_SCALE);
  };

  const factoryProto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (...args: unknown[]) => Phaser.GameObjects.Text;
  };
  const baseText = factoryProto.text;
  factoryProto.text = function text(this: Phaser.GameObjects.GameObjectFactory, ...args: unknown[]) {
    const label = baseText.apply(this, args);
    const style = args[3] as Phaser.Types.GameObjects.Text.TextStyle | undefined;
    // World text is zoomed by WORLD_ZOOM, so default to that density.
    if (!style?.resolution) baseSetResolution.call(label, WORLD_ZOOM);
    return label;
  };
}
