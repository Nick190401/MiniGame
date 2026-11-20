import Phaser from 'phaser';
import { hash2, linear, rgba, roundRect, shade, softEllipse, type Ctx } from './paint';
import { addWorldImage, worldTexture } from './worldTexture';
import { FX } from './fx';
import { SOUND_LAB_ROOM } from '../maps/SoundLabRoom';
import type { RoomRect } from '../maps/interiors/room';
import { SOUND_LAB_ROOM_ART } from '../assets/InteriorArt';

const SHAFT_MARGIN = 8;
const { shaft } = SOUND_LAB_ROOM;

/** Soft window light laid over the room with additive blending; placed at (x, y) in room units. */
export const SOUND_LAB_SHAFT = {
  key: 'soundlab-shaft',
  x: shaft.top[0] - SHAFT_MARGIN,
  y: shaft.topY - SHAFT_MARGIN,
  w: shaft.bottom[1] - shaft.top[0] + SHAFT_MARGIN * 2,
  h: shaft.bottomY - shaft.topY + SHAFT_MARGIN * 2,
} as const;

/** Beams through the window panes, as [start, end] across the shaft (0-1) and strength. */
const BEAMS: ReadonlyArray<readonly [number, number, number]> = [
  [0.02, 0.17, 0.75],
  [0.23, 0.4, 1],
  [0.46, 0.53, 0.55],
  [0.6, 0.79, 0.9],
  [0.85, 0.98, 0.6],
];
/** Each beam is filled three times, wider and fainter, for soft edges without a blur filter. */
const BEAM_PASSES: ReadonlyArray<readonly [number, number]> = [[0.05, 0.16], [0.025, 0.26], [0, 0.4]];

function paintShaft(ctx: Ctx): void {
  const top = SHAFT_MARGIN;
  const bottom = SHAFT_MARGIN + shaft.bottomY - shaft.topY;
  const topX = (t: number) => SHAFT_MARGIN + (shaft.top[1] - shaft.top[0]) * t;
  const bottomX = (t: number) => SHAFT_MARGIN + shaft.bottom[0] - shaft.top[0] + (shaft.bottom[1] - shaft.bottom[0]) * t;
  for (const [start, end, strength] of BEAMS) {
    for (const [spread, alpha] of BEAM_PASSES) {
      ctx.fillStyle = linear(ctx, 0, top, 0, bottom, [
        [0, 0xffffff, alpha * strength], [0.6, 0xffffff, alpha * strength * 0.45], [1, 0xffffff, 0],
      ]);
      ctx.beginPath();
      ctx.moveTo(topX(start - spread), top);
      ctx.lineTo(topX(end + spread), top);
      ctx.lineTo(bottomX(end + spread), bottom);
      ctx.lineTo(bottomX(start - spread), bottom);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Where the light lands: a warm pool on the boards.
  softEllipse(ctx, bottomX(0.5), bottom - 4, 30, 7, 0xffffff, 0.28);
}

const FURNITURE_COLORS: Record<keyof typeof SOUND_LAB_ROOM.furniture, number> = {
  console: 0x3b3431,
  tapeMachine: 0x4a3a2e,
  chair: 0x4b2e24,
  musicStand: 0x2c2622,
  boxes: 0x94704a,
  booth: 0x3b4a4e,
  sofa: 0x6b3224,
  guitarCase: 0x4a2a1e,
};

/** A dusty block of furniture: lit top, darker base, grey dust settled on top. */
function dustyBlock(ctx: Ctx, { x, y, w, h }: RoomRect, color: number): void {
  softEllipse(ctx, x + w / 2, y + h - 1, w * 0.55, 4, 0x000000, 0.35);
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 2);
  ctx.fillStyle = linear(ctx, 0, y, 0, y + h, [[0, shade(color, 0.16)], [0.3, color], [1, shade(color, -0.35)]]);
  ctx.fill();
  ctx.strokeStyle = rgba(shade(color, -0.55), 0.9);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.fillStyle = rgba(0x9a9184, 0.22);
  ctx.fillRect(x + 2, y + 2, w - 4, Math.min(6, h * 0.25));
}

/**
 * The room painted in code: what the hero sees when the painted room has not
 * streamed in. It lines up with the colliders, so nothing looks walkable that
 * is not.
 */
function paintRoom(ctx: Ctx, w: number, h: number): void {
  const { walls, furniture, rug, doormat, window: glass, note } = SOUND_LAB_ROOM;
  const wallFace = walls.back.h;

  // Boards, each a slightly different brown.
  ctx.fillStyle = rgba(0x5a3e2b);
  ctx.fillRect(0, 0, w, h);
  for (let row = 0, y = wallFace; y < h; row++, y += 6.4) {
    ctx.fillStyle = rgba(shade(0x5a3e2b, (hash2(row, 3) - 0.5) * 0.18));
    ctx.fillRect(0, y, w, 6.4);
    ctx.fillStyle = rgba(0x2e1f15, 0.6);
    ctx.fillRect(0, y, w, 0.4);
    const seam = hash2(row, 7) * w;
    ctx.fillRect(seam, y, 0.4, 6.4);
    ctx.fillRect((seam + w / 2) % w, y, 0.4, 6.4);
  }

  // Back wall: brick under the dark wall top.
  ctx.fillStyle = rgba(0x7b3a2a);
  ctx.fillRect(0, 0, w, wallFace);
  ctx.fillStyle = rgba(0x4a2018, 0.8);
  for (let row = 0, y = 6; y < wallFace; row++, y += 4) {
    ctx.fillRect(0, y, w, 0.5);
    for (let x = row % 2 ? 5 : 0; x < w; x += 10) ctx.fillRect(x, y, 0.5, 4);
  }
  ctx.fillStyle = linear(ctx, 0, wallFace - 8, 0, wallFace, [[0, 0x000000, 0], [1, 0x000000, 0.35]]);
  ctx.fillRect(0, wallFace - 8, w, 8);

  // The window the light comes through.
  ctx.fillStyle = rgba(0x3a2a20);
  ctx.fillRect(glass.x - 1.5, glass.y - 1.5, glass.w + 3, glass.h + 3);
  ctx.fillStyle = linear(ctx, 0, glass.y, 0, glass.y + glass.h, [[0, 0xf6e2b4], [1, 0xd9b77e]]);
  ctx.fillRect(glass.x, glass.y, glass.w, glass.h);
  ctx.fillStyle = rgba(0x3a2a20);
  for (let i = 1; i < 4; i++) ctx.fillRect(glass.x + (glass.w * i) / 4 - 0.6, glass.y, 1.2, glass.h);
  ctx.fillRect(glass.x, glass.y + glass.h / 2 - 0.6, glass.w, 1.2);

  // Dark wall tops round the room; the near wall leaves the doorway open.
  ctx.fillStyle = rgba(0x1c1411);
  ctx.fillRect(0, 0, w, 5.4);
  for (const wall of [walls.left, walls.right, walls.nearLeft, walls.nearRight]) ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  ctx.fillStyle = rgba(0x3a2a22, 0.9);
  ctx.fillRect(0, walls.nearLeft.y, walls.nearLeft.w, 0.8);
  ctx.fillRect(walls.nearRight.x, walls.nearRight.y, walls.nearRight.w, 0.8);

  // Faded rug and doormat.
  ctx.fillStyle = rgba(0x4e5a3f, 0.92);
  ctx.fillRect(rug.x, rug.y, rug.w, rug.h);
  ctx.strokeStyle = rgba(0x7a7d55, 0.8);
  ctx.lineWidth = 1;
  ctx.strokeRect(rug.x + 3, rug.y + 3, rug.w - 6, rug.h - 6);
  ctx.fillStyle = rgba(0x6e6640);
  ctx.fillRect(doormat.x, doormat.y, doormat.w, doormat.h);
  ctx.fillStyle = rgba(0x4f4a2e, 0.8);
  for (let x = doormat.x + 2; x < doormat.x + doormat.w - 1; x += 3) ctx.fillRect(x, doormat.y + 1.5, 0.8, doormat.h - 3);

  // Daylight through the open doorway.
  softEllipse(ctx, walls.nearLeft.w + (walls.nearRight.x - walls.nearLeft.w) / 2, h - 2, 16, 7, 0xffe6b0, 0.35);

  (Object.keys(furniture) as Array<keyof typeof furniture>).forEach(name => dustyBlock(ctx, furniture[name], FURNITURE_COLORS[name]));
  // A dust sheet over the console, and the booth's glass front.
  const desk = furniture.console;
  ctx.fillStyle = rgba(0xb7a58c, 0.85);
  ctx.beginPath();
  ctx.moveTo(desk.x + desk.w * 0.55, desk.y + 4);
  ctx.lineTo(desk.x + desk.w - 1, desk.y + 6);
  ctx.lineTo(desk.x + desk.w - 2, desk.y + desk.h - 4);
  ctx.closePath();
  ctx.fill();
  const booth = furniture.booth;
  ctx.fillStyle = rgba(0x9fc0c4, 0.28);
  ctx.fillRect(booth.x + booth.w * 0.2, booth.y + 8, booth.w * 0.76, booth.h - 14);

  // The note, pinned to the stand.
  const paper = note.paper;
  ctx.fillStyle = rgba(0xeadfc4);
  ctx.fillRect(paper.x + 0.4, paper.y + 0.4, paper.w - 0.8, paper.h - 0.8);
  softEllipse(ctx, paper.x + paper.w / 2, paper.y + 1.2, 1.3, 1.3, 0xc0392b, 1, 0.7);

  // Dust settled everywhere.
  for (let i = 0; i < 260; i++) {
    softEllipse(ctx, hash2(i, 11) * w, hash2(i, 13) * h, 0.6 + hash2(i, 17) * 1.6, 0.5 + hash2(i, 19), 0xb2a898, 0.12);
  }
}

/**
 * The Sound Lab's textures. The painted room is registered first when it has
 * streamed in; worldTexture() keeps an existing key, so this paints the room
 * only when it is missing.
 */
export function createSoundLabTextures(scene: Phaser.Scene): void {
  worldTexture(scene, SOUND_LAB_ROOM_ART.key, SOUND_LAB_ROOM.width, SOUND_LAB_ROOM.height, paintRoom);
  worldTexture(scene, SOUND_LAB_SHAFT.key, SOUND_LAB_SHAFT.w, SOUND_LAB_SHAFT.h, paintShaft);
}

/** Dim, dusty grade; window light; dust hanging in it; a glint on the note. */
export function addSoundLabAtmosphere(scene: Phaser.Scene, reducedMotion: boolean): void {
  const cam = scene.cameras.main;
  if (cam.postFX) {
    cam.postFX.addVignette(0.5, 0.5, 0.86, 0.42);
    const grade = cam.postFX.addColorMatrix();
    grade.brightness(0.9);
    grade.saturate(-0.18, true);
  }

  const beams = addWorldImage(scene, SOUND_LAB_SHAFT.x, SOUND_LAB_SHAFT.y, SOUND_LAB_SHAFT.key)
    .setOrigin(0, 0).setTint(0xffe1ad).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setAlpha(0.18);
  if (!reducedMotion) {
    // Clouds passing the window.
    scene.tweens.add({ targets: beams, alpha: { from: 0.13, to: 0.24 }, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  const inLight = (across: number, down: number) => {
    const left = Phaser.Math.Linear(shaft.top[0], shaft.bottom[0], down);
    const right = Phaser.Math.Linear(shaft.top[1], shaft.bottom[1], down);
    return { x: Phaser.Math.Linear(left, right, across), y: Phaser.Math.Linear(shaft.topY, shaft.bottomY, down) };
  };
  const lit = reducedMotion ? 8 : 24;
  const loose = reducedMotion ? 3 : 10;
  for (let index = 0; index < lit + loose; index++) {
    const glowing = index < lit;
    const at = glowing
      ? inLight(Math.random(), 0.08 + Math.random() * 0.85)
      : { x: 40 + Math.random() * 220, y: 60 + Math.random() * 120 };
    const size = 0.7 + Math.random() * (glowing ? 1.1 : 0.7);
    const peak = glowing ? 0.55 + Math.random() * 0.3 : 0.18 + Math.random() * 0.14;
    const mote = scene.add.image(at.x, at.y, FX.mote).setDisplaySize(size, size).setTint(0xfff1d6)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(7);
    if (reducedMotion) {
      mote.setAlpha(peak * 0.8);
      continue;
    }
    // Dust hangs in the air: a slow sink and sway, catching the light now and then.
    mote.setAlpha(0);
    scene.tweens.add({
      targets: mote,
      x: at.x + Phaser.Math.Between(-7, 7),
      y: at.y + Phaser.Math.Between(-4, 10),
      alpha: { from: 0.04, to: peak },
      duration: 4200 + Math.random() * 4200,
      delay: Math.random() * 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  const { paper } = SOUND_LAB_ROOM.note;
  const glint = scene.add.image(paper.x + paper.w / 2, paper.y + paper.h / 2, FX.glow).setDisplaySize(22, 22)
    .setTint(0xfff3d2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.26).setDepth(1);
  if (!reducedMotion) {
    scene.tweens.add({ targets: glint, alpha: { from: 0.14, to: 0.34 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
