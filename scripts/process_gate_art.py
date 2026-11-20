"""Turns the generated Frequency Gate painting into game textures.

usage: python -I scripts/process_gate_art.py <arch.png> [<disc.png>] <out_dir> src/game/assets/GateArt.ts

Then export the PNGs as WebP into public/assets/world (quality 90, alpha_quality 100).

- Cuts the painting out (hard alpha >= 232, haze removed, specks dropped).
- Scales it so the doorway's inner plinth edges are exactly 64 world units
  apart (320 px at 5 px/unit) and puts the ground line on the canvas bottom.
- Finds the flat magenta key, paints the key grooves dark in the base, and
  exports white glow masks (runes, studs, tines, ring marks, disc wave) with
  their measured world rectangles.
- Writes the measurements as a TypeScript module.
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageFilter

PX = 5                      # painted px per world unit
DOOR_W = 64 * PX            # doorway width
CENTER_X = 512              # gate centre (world)
GROUND_Y = 1512             # plinth foot line (world)
CANVAS_W = 176 * PX
PAD_BOTTOM = 2 * PX         # canvas bottom sits 2 units below the ground line


def hard_alpha(img: Image.Image) -> Image.Image:
    img = img.convert('RGBA')
    a = img.getchannel('A').point(lambda v: 255 if v >= 232 else 0)
    a = a.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    img.putalpha(a)
    return img


def drop_specks(img: Image.Image, min_area: int) -> Image.Image:
    w, h = img.size
    a = img.getchannel('A')
    px = a.load()
    seen = bytearray(w * h)
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or px[x0, y0] == 0:
                continue
            stack = [(x0, y0)]
            seen[y0 * w + x0] = 1
            island = []
            while stack:
                x, y = stack.pop()
                island.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny] > 0:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            if len(island) < min_area:
                for x, y in island:
                    px[x, y] = 0
    img.putalpha(a)
    return img


def doorway(img: Image.Image):
    """Bottom opaque row, and the transparent gap around the centre a few px above it."""
    a = img.getchannel('A')
    w, h = img.size
    bbox = a.getbbox()
    bottom = bbox[3] - 1
    row = bottom - max(6, (bbox[3] - bbox[1]) // 60)
    pa = a.load()
    cx = (bbox[0] + bbox[2]) // 2
    left = cx
    while left > bbox[0] and pa[left, row] < 128:
        left -= 1
    right = cx
    while right < bbox[2] - 1 and pa[right, row] < 128:
        right += 1
    return bbox, bottom, left + 1, right - 1


def magenta_strength(r: int, g: int, b: int) -> float:
    """0..1 closeness to the flat #FF00FF key, robust to resampled edges."""
    if r < 90 or b < 90:
        return 0.0
    spill = min(r, b) - g
    if spill < 60:
        return 0.0
    balance = 1 - min(1.0, abs(r - b) / 110)
    return max(0.0, min(1.0, (spill - 60) / 140)) * balance


def components(mask: Image.Image, threshold: int = 128, min_area: int = 6):
    w, h = mask.size
    px = mask.load()
    seen = bytearray(w * h)
    out = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or px[x0, y0] < threshold:
                continue
            stack = [(x0, y0)]
            seen[y0 * w + x0] = 1
            xs, ys = [], []
            while stack:
                x, y = stack.pop()
                xs.append(x)
                ys.append(y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny] >= threshold:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            if len(xs) >= min_area:
                out.append({'l': min(xs), 't': min(ys), 'r': max(xs) + 1, 'b': max(ys) + 1, 'area': len(xs),
                            'cx': sum(xs) / len(xs), 'cy': sum(ys) / len(ys)})
    return out


def main():
    args = sys.argv[1:]
    arch_path = args[0]
    disc_path = args[1] if len(args) == 4 else None
    out_dir, ts_out = Path(args[-2]), Path(args[-1])
    out_dir.mkdir(parents=True, exist_ok=True)

    raw = drop_specks(hard_alpha(Image.open(arch_path)), 400)
    bbox, bottom, door_l, door_r = doorway(raw)
    scale = DOOR_W / (door_r - door_l + 1)
    door_cx = (door_l + door_r + 1) / 2
    art_h = round((bottom + 1 - bbox[1]) * scale)
    canvas_h = art_h + PAD_BOTTOM
    print(f'raw bbox {bbox}, ground {bottom}, doorway {door_l}-{door_r}, scale {scale:.4f}, canvas {CANVAS_W}x{canvas_h}')
    resized = raw.resize((round(raw.width * scale), round(raw.height * scale)), Image.LANCZOS)
    canvas = Image.new('RGBA', (CANVAS_W, canvas_h), (0, 0, 0, 0))
    ox = round(CANVAS_W / 2 - door_cx * scale)
    oy = round(canvas_h - PAD_BOTTOM - (bottom + 1) * scale)
    canvas.alpha_composite(resized, (ox, oy))
    # World position of the canvas' top-left corner (origin bottom-centre at (512, GROUND_Y + 2)).
    world_left = CENTER_X - CANVAS_W / PX / 2
    world_top = GROUND_Y + PAD_BOTTOM / PX - canvas_h / PX

    # Key colour: soft strength per pixel, then the base gets dark grooves and despilled edges.
    w, h = canvas.size
    px = canvas.load()
    key = Image.new('L', (w, h), 0)
    kp = key.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            s = magenta_strength(r, g, b)
            if s > 0:
                kp[x, y] = round(255 * s)
    key = key.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    kp = key.load()
    groove = (42, 31, 23)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            k = kp[x, y] / 255
            if k > 0:
                r, g, b = (round(c + (gc - c) * min(1.0, k * 1.4)) for c, gc in zip((r, g, b), groove))
            spill = min(r, b) - g
            if spill > 8:
                r -= round(spill * 0.85)
                b -= round(spill * 0.85)
            px[x, y] = (max(0, r), g, max(0, b), a)
    leftover = sum(1 for y in range(h) for x in range(w)
                   if px[x, y][3] > 0 and magenta_strength(*px[x, y][:3]) > 0.15)
    print('magenta pixels left in the base:', leftover)
    canvas.save(out_dir / 'hd-gate-arch.png')

    # Glow masks: key plus a soft halo, split by part.
    halo = key.filter(ImageFilter.GaussianBlur(PX))
    comps = components(key)
    print(len(comps), 'key components')
    ring_centre = None
    wave = max((c for c in comps if c['cy'] < h * 0.45), key=lambda c: c['area'])
    ring_centre = ((wave['l'] + wave['r']) / 2, (wave['t'] + wave['b']) / 2)
    parts = {'tines': [], 'ring': [], 'wave': [wave], 'runes': [], 'studs': []}
    door_left_px = CANVAS_W / 2 - DOOR_W / 2
    door_right_px = CANVAS_W / 2 + DOOR_W / 2
    for c in comps:
        if c is wave:
            continue
        d = math.hypot(c['cx'] - ring_centre[0], c['cy'] - ring_centre[1])
        wide = (c['r'] - c['l']) > 1.6 * (c['b'] - c['t'])
        if c['cy'] < h * 0.12:
            parts['tines'].append(c)
        elif d < 15 * PX:
            parts['wave'].append(c)
        elif d < 30 * PX:
            parts['ring'].append(c)
        elif wide:
            parts['runes'].append(c)
        elif abs(c['cx'] - door_left_px) < 9 * PX or abs(c['cx'] - door_right_px) < 9 * PX:
            parts['studs'].append(c)
        else:
            parts['runes'].append(c)
    for name, cs in parts.items():
        print(f'{name}: {len(cs)}')

    def world(x, y):
        return round(world_left + x / PX, 2), round(world_top + y / PX, 2)

    rects = {}
    pad = 2 * PX
    for name, cs in parts.items():
        if not cs:
            continue
        l = max(0, min(c['l'] for c in cs) - pad)
        t = max(0, min(c['t'] for c in cs) - pad)
        r = min(w, max(c['r'] for c in cs) + pad)
        b = min(h, max(c['b'] for c in cs) + pad)
        mask = Image.new('RGBA', (r - l, b - t), (255, 255, 255, 0))
        mp = mask.load()
        member = Image.new('L', (w, h), 0)
        mem = member.load()
        for c in cs:
            for yy in range(max(0, c['t'] - pad), min(h, c['b'] + pad)):
                for xx in range(max(0, c['l'] - pad), min(w, c['r'] + pad)):
                    mem[xx, yy] = 255
        hp = halo.load()
        for yy in range(t, b):
            for xx in range(l, r):
                if not mem[xx, yy]:
                    continue
                v = max(kp[xx, yy], round(0.5 * hp[xx, yy]))
                if v:
                    mp[xx - l, yy - t] = (255, 255, 255, min(255, v))
        key_name = {'tines': 'hd-gate-glow-tines', 'ring': 'hd-gate-glow-ring', 'wave': 'hd-gate-glow-wave',
                    'runes': 'hd-gate-glow-runes', 'studs': 'hd-gate-glow-studs'}[name]
        mask.save(out_dir / f'{key_name}.png')
        x0, y0 = world(l, t)
        rects[name] = {'key': key_name, 'x': x0, 'y': y0, 'w': round((r - l) / PX, 2), 'h': round((b - t) / PX, 2)}

    # Rune rows (bottom to top) as world y bands, and stud centres (string anchors).
    runes = sorted(parts['runes'], key=lambda c: -c['cy'])
    rows = []
    for c in runes:
        if rows and abs(rows[-1]['cy'] - c['cy']) < 4 * PX:
            rows[-1]['items'].append(c)
            rows[-1]['cy'] = sum(i['cy'] for i in rows[-1]['items']) / len(rows[-1]['items'])
        else:
            rows.append({'cy': c['cy'], 'items': [c]})
    row_bands = []
    for row in rows:
        t = min(i['t'] for i in row['items'])
        b = max(i['b'] for i in row['items'])
        row_bands.append({'top': world(0, t - PX)[1], 'bottom': world(0, b + PX)[1]})
    # A stud's rim can come out as two pieces: merge pieces closer than 3 units.
    merged = []
    for c in parts['studs']:
        near = next((m for m in merged if math.hypot(m['cx'] - c['cx'], m['cy'] - c['cy']) < 3 * PX), None)
        if near:
            total = near['area'] + c['area']
            near['cx'] = (near['cx'] * near['area'] + c['cx'] * c['area']) / total
            near['cy'] = (near['cy'] * near['area'] + c['cy'] * c['area']) / total
            near['area'] = total
        else:
            merged.append(dict(c))
    studs = sorted(merged, key=lambda c: (c['cx'] > CANVAS_W / 2, -c['cy']))
    stud_points = [{'x': world(c['cx'], c['cy'])[0], 'y': world(c['cx'], c['cy'])[1]} for c in studs]
    tines = [{'x': world(c['cx'], c['cy'])[0], 'y': world(c['cx'], c['cy'])[1]} for c in sorted(parts['tines'], key=lambda c: c['cx'])]
    ring = {'x': world(*ring_centre)[0], 'y': world(*ring_centre)[1]}

    # The medallion's painted disc, cut out so it can turn: radius from the ring marks.
    marks = parts['ring']
    if marks:
        mark_r = sum(math.hypot(c['cx'] - ring_centre[0], c['cy'] - ring_centre[1]) for c in marks) / len(marks)
    else:
        mark_r = 18.5 * PX
    disc_r = round(mark_r * 16 / 18.5)
    disc_key = None
    src = None
    if disc_path:
        src = hard_alpha(Image.open(disc_path))
        bb = src.getchannel('A').getbbox()
        src = src.crop(bb).resize((disc_r * 2, disc_r * 2), Image.LANCZOS)
    else:
        cx, cy = round(ring_centre[0]), round(ring_centre[1])
        src = canvas.crop((cx - disc_r, cy - disc_r, cx + disc_r, cy + disc_r))
        # Re-take the wave from the key so the turning disc carries its own groove.
    disc = Image.new('RGBA', (disc_r * 2, disc_r * 2), (0, 0, 0, 0))
    disc.alpha_composite(src.convert('RGBA'))
    circle = Image.new('L', disc.size, 0)
    cp = circle.load()
    for yy in range(disc.height):
        for xx in range(disc.width):
            d = math.hypot(xx + 0.5 - disc_r, yy + 0.5 - disc_r)
            cp[xx, yy] = max(0, min(255, round((disc_r - d) * 255)))
    dp = disc.load()
    for yy in range(disc.height):
        for xx in range(disc.width):
            r, g, b, a = dp[xx, yy]
            dp[xx, yy] = (r, g, b, min(a, cp[xx, yy]))
    disc.save(out_dir / 'hd-gate-disc.png')
    disc_key = 'hd-gate-disc'

    meta = {
        'arch': {'key': 'hd-gate-arch', 'x': CENTER_X, 'y': GROUND_Y + PAD_BOTTOM / PX, 'w': CANVAS_W / PX, 'h': round(canvas_h / PX, 2)},
        'masks': rects,
        'runeRows': row_bands,
        'studs': stud_points,
        'tines': tines,
        'medallion': {**ring, 'discRadius': round(disc_r / PX, 2), 'discKey': disc_key},
    }
    ts_out.write_text(
        '// Generated by scripts/process_gate_art.py: measured from the painting.\n'
        '// World units; rects are top-left corners. Rows and studs run bottom to top, left column first.\n'
        f'export const GATE_ART = {json.dumps(meta, indent=2)} as const;\n', encoding='utf-8')
    print(json.dumps(meta, indent=1)[:2000])


if __name__ == '__main__':
    main()
