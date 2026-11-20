import { fbm, hash2, makeCanvas, rgba, rng, roundRect, type Ctx, valueNoise, wrapDraw } from '../../art/paint';

/**
 * Tileable surface detail for the terrain shader. Every texture is a power of
 * two so WebGL can repeat and mipmap it; the shader samples them in world
 * space (one repeat covers 128 x 128 world units).
 */
export const TERRAIN_DETAIL_SIZE = 512;

type Pixel = (x: number, y: number) => [number, number, number];

function paintPixels(ctx: Ctx, size: number, pixel: Pixel): void {
  const image = ctx.createImageData(size, size);
  const d = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size);
      const i = (y * size + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Strokes batched per colour bucket: far fewer canvas state changes. */
function strokeBuckets(
  ctx: Ctx, size: number, count: number, rand: () => number,
  palette: Array<[number, number]>, width: [number, number], length: [number, number],
  angle: (x: number, y: number) => number,
): void {
  const buckets = palette.map(() => [] as Array<[number, number, number, number, number, number]>);
  for (let i = 0; i < count; i++) {
    const x = rand() * size, y = rand() * size;
    const len = length[0] + rand() * (length[1] - length[0]);
    const a = angle(x, y) + (rand() - 0.5) * 1.3;
    const bend = (rand() - 0.5) * len * 0.5;
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    const cx = (x + ex) / 2 + Math.cos(a + Math.PI / 2) * bend, cy = (y + ey) / 2 + Math.sin(a + Math.PI / 2) * bend;
    buckets[Math.floor(rand() * palette.length)].push([x, y, cx, cy, ex, ey]);
  }
  ctx.lineCap = 'round';
  buckets.forEach((strokes, index) => {
    const [color, alpha] = palette[index];
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = width[0] + (index / Math.max(1, palette.length - 1)) * (width[1] - width[0]);
    ctx.beginPath();
    strokes.forEach(([x, y, cx, cy, ex, ey]) => {
      wrapDraw(size, size, x, y, 16, (wx, wy) => {
        const dx = wx - x, dy = wy - y;
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(cx + dx, cy + dy, ex + dx, ey + dy);
      });
    });
    ctx.stroke();
  });
}

/**
 * Meadow grass in the painted style of the world art: broad, soft colour
 * patches under a light layer of short brush dabs. No fine blades and no
 * specks, so it reads as one calm surface at the overworld zoom; flowers
 * and bushes are painted objects placed on top.
 */
export function paintGrass(): HTMLCanvasElement {
  const S = TERRAIN_DETAIL_SIZE;
  const { canvas, ctx } = makeCanvas(S, S);
  paintPixels(ctx, S, (u, v) => {
    const n = fbm(u, v, 4, 3, 11);
    const m = fbm(u, v, 10, 2, 17);
    return [clamp255(58 + n * 26 + m * 8), clamp255(96 + n * 30 + m * 10), clamp255(40 + n * 12)];
  });

  // Mottling: large soft light and shade patches, like a painted lawn.
  const patches = rng(2203);
  for (let i = 0; i < 150; i++) {
    const x = patches() * S, y = patches() * S;
    const r = 10 + patches() * 30;
    const light = patches() < 0.5;
    wrapDraw(S, S, x, y, r, (px, py) => {
      const fill = ctx.createRadialGradient(px, py, 0, px, py, r);
      fill.addColorStop(0, rgba(light ? 0x78aa48 : 0x325c26, light ? 0.2 : 0.22));
      fill.addColorStop(1, rgba(light ? 0x78aa48 : 0x325c26, 0));
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    });
  }

  const rand = rng(4021);
  const wind = (x: number, y: number) => -Math.PI / 2 + (valueNoise(x / 64, y / 64, S / 64, 9) - 0.5) * 1.2;
  // Broad, low-contrast dabs: shade first, then light.
  strokeBuckets(ctx, S, 1800, rand, [[0x3a6a28, 0.34], [0x356326, 0.3], [0x2f5a24, 0.26]], [3.2, 4.2], [5, 9], wind);
  strokeBuckets(ctx, S, 1300, rand, [[0x6c9f42, 0.32], [0x7aae4a, 0.3], [0x88ba54, 0.24]], [2.4, 3.2], [4, 7], wind);

  // A few soft clover patches break up the repetition.
  const clover = rng(77);
  for (let i = 0; i < 12; i++) {
    const cx = clover() * S, cy = clover() * S;
    for (let k = 0; k < 7; k++) {
      const lx = cx + (clover() - 0.5) * 24, ly = cy + (clover() - 0.5) * 18;
      wrapDraw(S, S, lx, ly, 8, (x, y) => {
        for (let leaf = 0; leaf < 3; leaf++) {
          const a = leaf * 2.1 + clover();
          ctx.fillStyle = rgba(leaf === 0 ? 0x58923a : 0x4b8232, 0.55);
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 2.6, 2, a, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }
  return canvas;
}

/** Packed earth and sand with pebbles, used for village roads and trails. */
export function paintDirt(): HTMLCanvasElement {
  const S = TERRAIN_DETAIL_SIZE;
  const { canvas, ctx } = makeCanvas(S, S);
  paintPixels(ctx, S, (u, v) => {
    const n = fbm(u, v, 5, 5, 31);
    const fine = fbm(u, v, 64, 2, 37);
    const speck = hash2(Math.floor(u * S), Math.floor(v * S), 5);
    const s = speck > 0.985 ? -26 : speck < 0.02 ? 18 : 0;
    return [clamp255(168 + n * 40 + fine * 22 + s), clamp255(140 + n * 34 + fine * 18 + s), clamp255(98 + n * 24 + fine * 12 + s)];
  });
  const rand = rng(509);
  // Wheel and foot ruts: long faint darker streaks.
  for (let i = 0; i < 40; i++) {
    const x = rand() * S, y = rand() * S, len = 30 + rand() * 80, a = (rand() - 0.5) * 0.5 + (rand() < 0.5 ? 0 : Math.PI / 2);
    wrapDraw(S, S, x, y, 120, (wx, wy) => {
      ctx.strokeStyle = 'rgba(96,72,44,0.045)';
      ctx.lineWidth = 3 + rand() * 4;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * len, wy + Math.sin(a) * len); ctx.stroke();
    });
  }
  // Pebbles: soft cast shadow, rounded body, sunlit cap.
  const tones = [0x9c8a72, 0xb3a58c, 0x857865, 0xc2b398, 0x76695a];
  for (let i = 0; i < 520; i++) {
    const x = rand() * S, y = rand() * S;
    const r = 0.8 + Math.pow(rand(), 3) * 4.2;
    const tone = tones[Math.floor(rand() * tones.length)];
    const rot = rand() * Math.PI;
    wrapDraw(S, S, x, y, 8, (px, py) => {
      ctx.fillStyle = 'rgba(60,42,24,0.35)';
      ctx.beginPath(); ctx.ellipse(px + r * 0.45, py + r * 0.55, r * 1.05, r * 0.8, rot, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(tone, 1);
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.78, rot, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,248,230,0.38)';
      ctx.beginPath(); ctx.ellipse(px - r * 0.3, py - r * 0.3, r * 0.45, r * 0.3, rot, 0, Math.PI * 2); ctx.fill();
    });
  }
  return canvas;
}

/** Slate pavers in a running bond with worn bevels and mossy joints. */
export function paintPaving(): HTMLCanvasElement {
  const S = TERRAIN_DETAIL_SIZE;
  const { canvas, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#3b4244';
  ctx.fillRect(0, 0, S, S);
  const rand = rng(1201);
  const rowH = 48; // 12 world units per course
  for (let row = 0; row < S / rowH; row++) {
    const y = row * rowH;
    let x = (row % 2) * 34 - 34;
    while (x < S) {
      const w = 56 + Math.floor(rand() * 3) * 12;
      const tone = 104 + rand() * 30;
      const tint = (rand() - 0.5) * 10;
      const grad = ctx.createLinearGradient(x, y, x + w, y + rowH);
      grad.addColorStop(0, `rgb(${tone + 8 + tint},${tone + 14},${tone + 18 - tint})`);
      grad.addColorStop(1, `rgb(${tone - 14 + tint},${tone - 8},${tone - 2 - tint})`);
      const draw = (sx: number) => {
        const inset = 2.2;
        ctx.fillStyle = grad;
        roundRect(ctx, sx + inset, y + inset, w - inset * 2, rowH - inset * 2, 5);
        ctx.fill();
        // Bevel: light north-west lip, darker south-east lip.
        ctx.strokeStyle = 'rgba(235,240,236,0.22)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(sx + inset + 4, y + rowH - inset - 2); ctx.lineTo(sx + inset + 2, y + inset + 2); ctx.lineTo(sx + w - inset - 4, y + inset + 1.5); ctx.stroke();
        ctx.strokeStyle = 'rgba(16,20,22,0.45)';
        ctx.beginPath(); ctx.moveTo(sx + w - inset - 1.5, y + inset + 4); ctx.lineTo(sx + w - inset - 1.5, y + rowH - inset - 1.5); ctx.lineTo(sx + inset + 4, y + rowH - inset - 1.5); ctx.stroke();
      };
      draw(x);
      if (x + w > S) draw(x - S);
      if (x < 0) draw(x + S);
      x += w;
    }
  }
  // Surface wear, speckle and a few hairline cracks.
  const image = ctx.getImageData(0, 0, S, S);
  const d = image.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const n = (fbm(x / S, y / S, 16, 3, 61) - 0.5) * 26 + (hash2(x, y, 3) - 0.5) * 10;
    d[i] = clamp255(d[i] + n); d[i + 1] = clamp255(d[i + 1] + n); d[i + 2] = clamp255(d[i + 2] + n);
  }
  ctx.putImageData(image, 0, 0);
  for (let i = 0; i < 26; i++) {
    let x = rand() * S, y = rand() * S;
    ctx.strokeStyle = 'rgba(20,24,26,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rand() - 0.5) * 14; y += (rand() - 0.5) * 10; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // Moss creeping along some joints.
  for (let i = 0; i < 260; i++) {
    const row = Math.floor(rand() * (S / rowH));
    const x = rand() * S, y = row * rowH + (rand() < 0.5 ? 1 : rowH - 1);
    wrapDraw(S, S, x, y, 6, (mx, my) => {
      ctx.fillStyle = rgba(rand() < 0.5 ? 0x4e6b34 : 0x5f7d3b, 0.55);
      ctx.beginPath(); ctx.ellipse(mx, my, 2 + rand() * 4, 1.2 + rand() * 1.5, 0, 0, Math.PI * 2); ctx.fill();
    });
  }
  return canvas;
}

/**
 * Three grayscale surfaces packed into RGB:
 * R rugged rock, G cave gravel, B polished obsidian with veins.
 */
export function paintStone(): HTMLCanvasElement {
  const S = TERRAIN_DETAIL_SIZE;
  const { canvas, ctx } = makeCanvas(S, S);
  paintPixels(ctx, S, (u, v) => {
    const ridge = 1 - Math.abs(fbm(u, v, 8, 5, 71) * 2 - 1);
    const rock = fbm(u, v, 4, 5, 73) * 0.6 + ridge * 0.4;
    const gravelCell = hash2(Math.floor(u * 96), Math.floor(v * 96), 79);
    const gravel = fbm(u, v, 32, 3, 83) * 0.55 + gravelCell * 0.25 + fbm(u, v, 6, 3, 89) * 0.2;
    const vein = Math.pow(1 - Math.abs(fbm(u, v, 4, 4, 97) * 2 - 1), 10);
    const obsidian = 0.22 + fbm(u, v, 3, 3, 101) * 0.3 + vein * 0.6;
    return [clamp255(rock * 255), clamp255(gravel * 255), clamp255(obsidian * 255)];
  });
  return canvas;
}

/** RGB tileable noise at three frequencies, for warping, clouds and waves. */
export function paintNoise(size = 256): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size, size);
  const image = ctx.createImageData(size, size);
  const d = image.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const i = (y * size + x) * 4;
    d[i] = clamp255(fbm(u, v, 4, 4, 211) * 255);
    d[i + 1] = clamp255(fbm(u, v, 12, 4, 223) * 255);
    d[i + 2] = clamp255(fbm(u, v, 32, 3, 227) * 255);
    d[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
