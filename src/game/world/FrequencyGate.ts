import Phaser from 'phaser';
import { BFX } from '../art/battleFx';
import { FX } from '../art/fx';
import { GATE_TEX } from '../art/gateArt';
import { addCastShadow, castShadow } from '../art/castShadow';
import { addWorldImage, standingDepth, WORLD_TEXTURE_SCALE } from '../art/worldTexture';
import { GATE_ART } from '../assets/GateArt';
import { RENDER_SCALE, TEXEL } from '../render/RenderScale';

/**
 * The Frequency Gate: painted stone (hd-gate-arch) brought to life in code.
 *
 * Closed, an ember standing-wave barrier hums in the doorway and the runes
 * show how close the hero is to level 2. Touched too early it measures the
 * hero, buzzes red and goes dead for a beat. Opening plays on the beats of
 * gate-open.mp3: the runes ignite, the forks ring, the disc turns like a key
 * and on the strongest hit (1170 ms) the barrier snaps back into the pylons.
 * Open, it is silent and steel blue.
 */

export interface FrequencyGateOptions {
  reducedMotion: boolean;
  open: boolean;
  /** The hero's progress, read for the rune gauge. */
  progress(): { level: number; xp: number; xpForLevel2: number };
  shake(duration: number, intensity: number): void;
}

type Ease = (v: number) => number;
const E = Phaser.Math.Easing;
const SINE_IO: Ease = E.Sine.InOut;
const SINE_O: Ease = E.Sine.Out;
const SINE_I: Ease = E.Sine.In;
const QUAD_O: Ease = E.Quadratic.Out;
const QUAD_I: Ease = E.Quadratic.In;
const CUBIC_O: Ease = E.Cubic.Out;
const CUBIC_I: Ease = E.Cubic.In;
const BACK_O: Ease = v => E.Back.Out(v);

const EMBER = 0xff7a2b;
const EMBER_SOFT = 0xff9a3c;
const GOLD = 0xf2c35f;
const WHITE_GOLD = 0xfff1c8;
const RED = 0xff4b3a;
const PALE = 0xc9d6dc;
const STEEL = 0x78b4e6;
const STEEL_DEEP = 0x6ea8d8;
const STEEL_LIGHT = 0x9cc8ef;

const G = standingDepth(1504);
const C = standingDepth(1490);
const EPS = 0.00001;
const VIEW = new Phaser.Geom.Rectangle(424 - 48, 1366 - 48, 176 + 96, 150 + 96);
const DOOR = { left: 480, right: 544, top: 1430, bottom: 1510 };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const progress = (t: number, start: number, duration: number) => clamp01((t - start) / duration);
const lerpColor = (a: number, b: number, k: number) => {
  const r = lerp((a >> 16) & 0xff, (b >> 16) & 0xff, k);
  const g = lerp((a >> 8) & 0xff, (b >> 8) & 0xff, k);
  const bl = lerp(a & 0xff, b & 0xff, k);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};

interface StringSpec { n: number; amp: number; period: number; phase: number }
const STRING_SPECS: StringSpec[] = [
  { n: 2, amp: 1.3, period: 1.1, phase: 0 },
  { n: 3, amp: 1.7, period: 0.95, phase: 0.7 },
  { n: 4, amp: 2, period: 0.8, phase: 1.9 },
  { n: 3, amp: 1.7, period: 0.95, phase: 2.6 },
  { n: 2, amp: 1.2, period: 1.2, phase: 3.8 },
];
const POINTS = 17;
const ROW_IGNITE = [450, 495, 560, 680, 750];
/** Centres of the two rune columns, measured on hd-gate-glow-runes. */
const RUNE_X = [459, 565.5];

interface Strand {
  x0: number; y0: number; x1: number; y1: number;
  spec: StringSpec; theta: number; kickAt: number; colour: number;
  shape: Float32Array;
}

/** A one-off effect that grows/fades by itself and is destroyed at the end. */
interface Shot {
  image: Phaser.GameObjects.Image; t0: number; duration: number;
  w0: number; w1: number; h0: number; h1: number; a0: number; a1: number; dy: number; y0: number; ease: Ease;
}

export class FrequencyGate {
  private readonly scene: Phaser.Scene;
  private readonly calm: boolean;
  private readonly opts: FrequencyGateOptions;
  private readonly owned = new Set<Phaser.GameObjects.GameObject>();
  private readonly shots: Shot[] = [];
  private state: 'closed' | 'opening' | 'open';
  private openingStart = 0;
  private denyStart = -1e9;
  private lastDeny = -1e9;
  private now = 0;
  private time = 0;
  private hum = 0;
  private litRows = -1;
  private ampMul = 1;
  private speedMul = 1;
  private released = false;
  private onRelease?: () => void;
  private lastRipple = -1e9;
  private lastRippleX = 0;
  private lastRippleY = 0;
  private inlayBoost = -1e9;
  /** 0..1: how strongly the hero's silhouette shows through the stone. */
  private xray = 0;
  private silhouette?: Phaser.GameObjects.Image;
  private hero?: Phaser.GameObjects.Sprite;
  /** The disc's own alpha (the reduced-motion key turn cross-fades it). */
  private discAlpha = 1;

  // Layers.
  private readonly arch: Phaser.GameObjects.Image;
  private readonly pool: Phaser.GameObjects.Image;
  private readonly runes?: Phaser.GameObjects.Image;
  private readonly runeOverlay?: Phaser.GameObjects.Image;
  private readonly studs?: Phaser.GameObjects.Image;
  private readonly tines?: Phaser.GameObjects.Image;
  private readonly ring?: Phaser.GameObjects.Image;
  private readonly disc?: Phaser.GameObjects.Image;
  private readonly discWave?: Phaser.GameObjects.Image;
  private readonly structure: Phaser.GameObjects.Image[] = [];
  private backing: Phaser.GameObjects.Image[] = [];
  private curtain: Phaser.GameObjects.Image[] = [];
  private lines?: Phaser.GameObjects.TileSprite;
  private strings?: Phaser.GameObjects.Graphics;
  private embers: Phaser.GameObjects.Image[] = [];
  private inlay?: Phaser.GameObjects.Image;
  private passage?: Phaser.GameObjects.Image;
  private motes: Phaser.GameObjects.Image[] = [];
  private notes: Array<{ image: Phaser.GameObjects.Image; t0: number; x: number; y: number; deny: boolean }> = [];
  private dust?: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly strands: Strand[] = [];
  private readonly pulses: Array<{ strand: number; t0: number; u0: number; size: number }> = [];

  /** Builds the gate, or returns undefined when the painted stone is missing (the old frame stays). */
  static create(scene: Phaser.Scene, opts: FrequencyGateOptions): FrequencyGate | undefined {
    if (!scene.textures.exists(GATE_ART.arch.key)) return undefined;
    return new FrequencyGate(scene, opts);
  }

  private constructor(scene: Phaser.Scene, opts: FrequencyGateOptions) {
    this.scene = scene;
    this.opts = opts;
    this.calm = opts.reducedMotion;
    this.state = opts.open ? 'open' : 'closed';

    // Ground: worn threshold, contact shadow, cast shadow, ember light pool.
    this.own(addWorldImage(scene, 512, 1492, GATE_TEX.threshold).setDepth(0.15));
    this.own(scene.add.image(512, 1514, FX.shadow).setDisplaySize(184, 12).setAlpha(0.42).setDepth(0.7));
    for (const x of [421, 603]) this.own(scene.add.image(x, 1494, FX.shadow).setDisplaySize(6, 36).setAlpha(0.25).setDepth(G - 0.0005));
    const archH = GATE_ART.arch.h;
    this.own(addCastShadow(scene, castShadow(scene, GATE_ART.arch.key, 176, archH, 88, archH - 2), 512, 1512, 1, 0.22));
    this.pool = this.own(scene.add.image(512, 1508, FX.glow).setDisplaySize(84, 20).setBlendMode(Phaser.BlendModes.ADD).setDepth(1.3));

    // The painted stone and its glow masks, all on the gate's depth.
    this.arch = this.own(addWorldImage(scene, GATE_ART.arch.x, GATE_ART.arch.y, GATE_ART.arch.key).setOrigin(0.5, 1).setDepth(G));
    this.structure.push(this.arch);
    const mask = (part: keyof typeof GATE_ART.masks, depth: number) => {
      const m = GATE_ART.masks[part];
      if (!scene.textures.exists(m.key)) return undefined;
      const img = this.own(addWorldImage(scene, m.x, m.y, m.key).setOrigin(0, 0).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD));
      this.structure.push(img);
      return img;
    };
    this.runes = mask('runes', G + EPS);
    this.runeOverlay = mask('runes', G + 2 * EPS);
    this.studs = mask('studs', G + EPS);
    this.tines = mask('tines', G + EPS);
    this.ring = mask('ring', G + EPS);
    this.runeOverlay?.setAlpha(0);

    const med = GATE_ART.medallion;
    if (scene.textures.exists(med.discKey)) {
      this.disc = this.own(addWorldImage(scene, med.x, med.y, med.discKey).setDepth(G + 3 * EPS));
      this.structure.push(this.disc);
    }
    const wave = GATE_ART.masks.wave;
    if (scene.textures.exists(wave.key)) {
      // Turns with the disc, about the medallion centre.
      this.discWave = this.own(addWorldImage(scene, med.x, med.y, wave.key)
        .setOrigin((med.x - wave.x) / wave.w, (med.y - wave.y) / wave.h)
        .setDepth(G + 4 * EPS).setBlendMode(Phaser.BlendModes.ADD));
      this.structure.push(this.discWave);
    }

    // String anchors: pair each left stud with the right stud at the same height.
    const left = GATE_ART.studs.filter(s => s.x < 512).sort((a, b) => b.y - a.y);
    const right = GATE_ART.studs.filter(s => s.x >= 512);
    left.slice(0, STRING_SPECS.length).forEach((l, i) => {
      const r = right.reduce((best, s) => (Math.abs(s.y - l.y) < Math.abs(best.y - l.y) ? s : best), right[0]);
      this.strands.push({
        x0: l.x + 1, y0: l.y, x1: r.x - 1, y1: r.y, spec: STRING_SPECS[i], theta: 0, kickAt: -1e9, colour: 0xffcf7a,
        shape: new Float32Array(POINTS),
      });
    });

    this.structure.forEach(img => img.setData('baseX', img.x));
    // After physics has moved the hero, so the silhouette never lags a frame.
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.syncSilhouette, this);
    if (this.state === 'open') {
      this.applyOpenGlows(1);
      this.buildOpen(true);
    } else this.buildClosed();
  }

  // ── Building ────────────────────────────────────────────────────────────

  private buildClosed(): void {
    const scene = this.scene;
    for (const side of [0, 1]) {
      const back = this.own(addWorldImage(scene, side ? DOOR.right : DOOR.left, DOOR.bottom, GATE_TEX.sheet)
        .setOrigin(side, 1).setTint(0x1a0f0a).setAlpha(0.42).setDepth(C));
      const glow = this.own(addWorldImage(scene, side ? DOOR.right : DOOR.left, DOOR.bottom, GATE_TEX.sheet)
        .setOrigin(side, 1).setTint(EMBER).setBlendMode(Phaser.BlendModes.ADD).setDepth(C + EPS));
      for (const img of [back, glow]) {
        const fw = img.frame.width;
        img.setCrop(side ? fw / 2 : 0, 0, fw / 2, img.frame.height);
      }
      this.backing.push(back);
      this.curtain.push(glow);
    }
    this.lines = this.own(scene.add.tileSprite(DOOR.left, DOOR.top, 64, 80, GATE_TEX.lines)
      .setOrigin(0, 0).setTileScale(WORLD_TEXTURE_SCALE).setTint(0xffb35c).setAlpha(0.12)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(C + 2 * EPS));
    this.strings = this.own(scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(C + 3 * EPS));
    if (!this.calm) {
      for (let i = 0; i < 4; i++) {
        this.embers.push(this.own(scene.add.image(500, 1506, FX.mote).setDisplaySize(2.5, 2.5).setTint(0xffc46b)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(C + 4 * EPS).setData('period', [2600, 2900, 3100, 3400][i]).setData('x', 490 + i * 14)));
      }
    }
    this.disc?.setAngle(90);
    this.discWave?.setAngle(90);
  }

  /** The silent open gate; `instant` skips the transition (a loaded save, a teleport). */
  private buildOpen(instant: boolean): void {
    const scene = this.scene;
    if (instant) this.state = 'open';
    this.disc?.setAngle(0);
    this.discWave?.setAngle(0);
    this.inlay = this.own(scene.add.image(512, 1506, BFX.beam).setDisplaySize(instant ? 64 : 0, 3).setTint(STEEL_DEEP)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.28).setDepth(0.2));
    this.passage = this.own(scene.add.image(512, 1490, FX.shadow).setDisplaySize(64, 34).setAlpha(instant ? 0.25 : 0).setDepth(0.75));
    if (!this.calm) {
      for (let i = 0; i < 3; i++) {
        this.motes.push(this.own(scene.add.image(492 + i * 20, 1440, FX.mote).setDisplaySize(2, 2).setTint(0xcfe6ff)
          .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(standingDepth(1500)).setData('offset', i * 2000)));
      }
    }
    if (instant) {
      this.released = true;
      this.tines?.setAlpha(0);
    }
  }

  private own<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.owned.add(obj);
    return obj;
  }

  private drop(obj: Phaser.GameObjects.GameObject | undefined): void {
    if (!obj) return;
    this.owned.delete(obj);
    obj.destroy();
  }

  private shot(key: string, x: number, y: number, o: {
    w: [number, number]; h?: [number, number]; alpha: [number, number]; duration: number; color: number;
    depth: number; dy?: number; ease?: Ease; frame?: number; additive?: boolean;
  }): Phaser.GameObjects.Image {
    const h = o.h ?? o.w;
    const img = this.own(this.scene.add.image(x, y, key, o.frame).setDisplaySize(o.w[0], h[0]).setTint(o.color)
      .setAlpha(o.alpha[0]).setDepth(o.depth));
    if (o.additive ?? true) img.setBlendMode(Phaser.BlendModes.ADD);
    this.shots.push({
      image: img, t0: this.now, duration: o.duration, w0: o.w[0], w1: o.w[1], h0: h[0], h1: h[1],
      a0: o.alpha[0], a1: o.alpha[1], dy: o.dy ?? 0, y0: y, ease: o.ease ?? QUAD_O,
    });
    return img;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** True while the opening plays to gate-open.mp3, which a scene pause could not stop. */
  get busy(): boolean {
    return this.state === 'opening';
  }

  /** A hero below level 2 touched the seal at (px, py); false while the last denial is still playing. */
  deny(px: number, py: number): boolean {
    if (this.state !== 'closed' || this.now - this.lastDeny < 1000) return false;
    this.lastDeny = this.now;
    this.denyStart = this.now;
    const P = { x: Phaser.Math.Clamp(px, 488, 536), y: Math.min(py, 1472) - 14 };
    this.shot(BFX.core, P.x, P.y, { w: [14, 14], alpha: [0.85, 0], duration: 140, color: 0xffd0a0, depth: C + 5 * EPS });
    if (!this.calm) {
      this.shot(BFX.ringSoft, P.x, P.y, { w: [6, 44], h: [5, 34], alpha: [0.6, 0], duration: 280, color: EMBER, depth: C + 5 * EPS, ease: CUBIC_O });
      let nearest = 0;
      this.strands.forEach((s, i) => { if (Math.abs(s.y0 - P.y) < Math.abs(this.strands[nearest].y0 - P.y)) nearest = i; });
      const hit = this.strands[nearest];
      const u0 = hit ? clamp01((P.x - hit.x0) / Math.max(1, hit.x1 - hit.x0)) : 0.5;
      this.pulses.length = 0;
      this.pulses.push({ strand: nearest, t0: this.now, u0, size: 3.2 });
      if (nearest > 0) this.pulses.push({ strand: nearest - 1, t0: this.now, u0, size: 3.2 * 0.6 });
      if (nearest < this.strands.length - 1) this.pulses.push({ strand: nearest + 1, t0: this.now, u0, size: 3.2 * 0.6 });
    }
    // Two "wrong note" sharps.
    for (const side of [-1, 1]) {
      const note = this.own(this.scene.add.image(P.x + side * 8, P.y, BFX.note, 4).setDisplaySize(10, 10).setTint(0xff6a4a)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(C + 6 * EPS));
      this.notes.push({ image: note, t0: this.now + 180, x: P.x + side * 8, y: P.y, deny: true });
    }
    return true;
  }

  /** Opens the gate: animated on the gate-open sound, or at once; `release` runs when it lets the hero through. */
  open(animated: boolean, release: () => void): void {
    if (this.state !== 'closed') {
      release();
      return;
    }
    if (!animated) {
      this.clearClosed();
      this.applyOpenGlows(1);
      this.buildOpen(true);
      release();
      return;
    }
    this.state = 'opening';
    this.openingStart = this.now;
    this.onRelease = release;
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.syncSilhouette, this);
    this.hero = undefined;
    [...this.owned].forEach(obj => obj.destroy());
    this.owned.clear();
    this.shots.length = 0;
  }

  // ── Per frame ───────────────────────────────────────────────────────────

  update(_time: number, delta: number, hero: Phaser.GameObjects.Sprite): void {
    this.now += delta;
    const view = this.scene.cameras.main.worldView;
    // The short opening always runs to its end, so nothing piles up for when the gate comes back into view.
    if (this.state !== 'opening' && !Phaser.Geom.Rectangle.Overlaps(view, VIEW)) return;
    this.time += delta;
    const t = this.time / 1000;
    this.hum = this.calm ? 0.5 : 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 2.4);

    if (this.state === 'closed') this.updateClosed(delta);
    else if (this.state === 'opening') this.updateOpening(delta);
    else this.updateOpen(hero);
    this.updateShots();
    this.updateNotes();
    this.updateXray(hero, delta);
    this.disc?.setAlpha(this.discAlpha);
  }

  /**
   * The monument is tall: a hero walking behind it (north of the wall) would
   * vanish. A silhouette of the hero shows through the stone instead, masked
   * by the stone's own shape so it never covers the parts of him in view.
   */
  private updateXray(hero: Phaser.GameObjects.Sprite, delta: number): void {
    // Up to the hero's rest position against the wall's north face (y 1472).
    const behind = hero.x > 418 && hero.x < 606 && hero.y > 1366 && hero.y < 1476;
    this.hero = hero;
    const step = delta / 150;
    this.xray = behind ? Math.min(1, this.xray + step) : Math.max(0, this.xray - step);
    if (this.xray <= 0) {
      this.silhouette?.setVisible(false);
      return;
    }
    if (!this.silhouette) {
      this.silhouette = this.own(this.scene.add.image(hero.x, hero.y, hero.texture.key, hero.frame.name)
        .setTintFill(0x3a2518).setDepth(G + 9 * EPS));
      this.silhouette.setMask(this.arch.createBitmapMask());
    }
    this.silhouette.setVisible(true).setAlpha(0.55 * this.xray);
    this.syncSilhouette();
  }

  private syncSilhouette(): void {
    const s = this.silhouette;
    const hero = this.hero;
    if (!s || !s.visible || !hero || !hero.scene) return;
    if (s.texture.key !== hero.texture.key || s.frame.name !== hero.frame.name) s.setTexture(hero.texture.key, hero.frame.name);
    s.setPosition(hero.x, hero.y).setOrigin(hero.originX, hero.originY).setScale(hero.scaleX, hero.scaleY).setFlipX(hero.flipX);
  }

  private gauge(): number {
    const p = this.opts.progress();
    if (p.level >= 2) return 5;
    return Math.floor(5 * clamp01(p.xp / Math.max(1, p.xpForLevel2)));
  }

  /** Crops a rune mask to rows [from, to) counted from the bottom. */
  private cropRows(img: Phaser.GameObjects.Image | undefined, from: number, to: number): void {
    if (!img) return;
    const rows = GATE_ART.runeRows;
    const m = GATE_ART.masks.runes;
    const fh = img.frame.height;
    const fw = img.frame.width;
    if (to <= from || from >= rows.length) {
      img.setCrop(0, 0, 0, 0);
      return;
    }
    const top = to >= rows.length ? m.y : (rows[to - 1].top + rows[to].bottom) / 2;
    const bottom = from <= 0 ? m.y + m.h : (rows[from - 1].top + rows[from].bottom) / 2;
    const y0 = ((top - m.y) / m.h) * fh;
    const y1 = ((bottom - m.y) / m.h) * fh;
    img.setCrop(0, y0, fw, Math.max(0, y1 - y0));
  }

  private updateClosed(delta: number): void {
    const h = this.hum;
    const sinceDeny = this.now - this.denyStart;
    const ready = this.opts.progress().level >= 2;
    const k = this.gauge();
    if (k !== this.litRows) {
      if (this.litRows >= 0 && k > this.litRows && !this.calm) {
        const rows = GATE_ART.runeRows;
        for (let r = this.litRows; r < k; r++) {
          const y = (rows[r].top + rows[r].bottom) / 2;
          for (const x of RUNE_X) this.shot(FX.spark, x, y, { w: [5.4, 12.6], alpha: [1, 0], duration: 180, color: WHITE_GOLD, depth: G + 6 * EPS });
        }
      }
      this.litRows = k;
    }
    // Deny envelope: knock, measure, red buzz, dead stop, recovery.
    const buzzing = sinceDeny >= 180 && sinceDeny < 400;
    const red = sinceDeny < 180 ? 0 : sinceDeny < 400 ? progress(sinceDeny, 180, this.calm ? 100 : 50) : 1 - progress(sinceDeny, 400, 300);
    const dead = sinceDeny >= 400 && sinceDeny < 1050
      ? (sinceDeny < 440 ? 1 - progress(sinceDeny, 400, 40) : sinceDeny < 540 ? 0 : SINE_O(progress(sinceDeny, 540, 510)))
      : 1;
    const knock = Math.max(0, 1 - sinceDeny / 250);

    const curtainBase = ready ? EMBER_SOFT : EMBER;
    const curtainAlpha = 0.26 + 0.12 * h + 0.2 * knock;
    for (const img of this.curtain) img.setTint(lerpColor(curtainBase, RED, red)).setAlpha(curtainAlpha);
    for (const img of this.backing) img.setAlpha(0.42 + 0.1 * Math.max(0, 1 - sinceDeny / 500));
    if (this.lines && !this.calm) this.lines.tilePositionY += 6 * TEXEL * (delta / 1000);
    this.pool.setTint(0xff8a3d).setAlpha(0.18 + 0.08 * h);

    // Runes: the earned rows glow; ready = all gold. During a denial the gate measures, then shows the missing rows red.
    this.cropRows(this.runes, 0, k);
    this.runes?.setTint(ready ? GOLD : EMBER_SOFT).setAlpha(ready ? 0.8 + 0.1 * h : 0.55 + 0.25 * h);
    if (this.runeOverlay) {
      if (sinceDeny < 150) {
        const sweep = this.calm ? k : Math.min(k, Math.floor(sinceDeny / 30) + 1);
        this.cropRows(this.runeOverlay, 0, sweep);
        this.runeOverlay.setTint(WHITE_GOLD).setAlpha(this.calm ? 0.6 * progress(sinceDeny, 0, 150) : 1);
      } else if (sinceDeny < 180) {
        this.runeOverlay.setAlpha((this.calm ? 0.6 : 1) * (1 - progress(sinceDeny, 150, 30)));
      } else if (sinceDeny < 700) {
        this.cropRows(this.runeOverlay, k, 5);
        this.runeOverlay.setTint(RED).setAlpha(0.85 * progress(sinceDeny, 180, 50) * (1 - progress(sinceDeny, 400, 300)));
      } else this.runeOverlay.setAlpha(0);
    }
    const studPulse = sinceDeny >= 110 && sinceDeny < 300 ? 0.3 * (1 - progress(sinceDeny, 110, 190)) : 0;
    this.studs?.setTint(lerpColor(EMBER_SOFT, RED, red)).setAlpha(0.6 + 0.25 * h + studPulse);
    if (ready && !this.calm) this.tines?.setTint(GOLD).setAlpha(0.3 + 0.3 * (0.5 + 0.5 * Math.sin((2 * Math.PI * (this.time / 1000 - 0.3)) / 2.4)));
    else this.tines?.setTint(EMBER_SOFT).setAlpha(ready ? 0.45 : 0.2);
    this.ring?.setTint(lerpColor(0xffb85a, RED, red)).setAlpha(0.55);
    const wobble = buzzing && !this.calm ? 1.5 * Math.sin(2 * Math.PI * 12 * (sinceDeny / 1000)) : 0;
    this.disc?.setAngle(90 + wobble);
    this.discWave?.setAngle(90 + wobble).setTint(lerpColor(0xffb85a, RED, red)).setAlpha(0.6 + 0.1 * h);

    // Strings.
    const stringColour = lerpColor(ready ? 0xffd27a : 0xffcf7a, RED, red);
    const ampMul = (ready ? 0.75 : 1) * dead * (this.calm ? 0.6 : 1);
    this.drawStrings(delta, ampMul, 1, stringColour, buzzing && !this.calm ? lerp(20, 14, progress(sinceDeny, 180, 220)) : 0, 1);
    this.updateEmbers(ready, 1);
  }

  /** Embers rise through the barrier. */
  private updateEmbers(ready: boolean, alphaMul: number): void {
    for (const ember of this.embers) {
      const period = ember.getData('period') as number;
      const f = ((this.time + period * 0.37) % period) / period;
      ember.setPosition((ember.getData('x') as number) + 1.5 * Math.sin(f * Math.PI * 4), lerp(1506, 1446, f))
        .setAlpha(0.7 * Math.sin(Math.PI * f) * alphaMul).setTint(ready ? 0xffe2a0 : 0xffc46b);
    }
  }

  private drawStrings(delta: number, ampMul: number, speedMul: number, colour: number, tremorHz: number, alphaMul: number, wipe = 0): void {
    const g = this.strings;
    if (!g) return;
    g.clear();
    const H = this.calm ? 1 : 0.8 + 0.2 * Math.sin((2 * Math.PI * this.time) / 2400);
    for (let n = this.pulses.length - 1; n >= 0; n--) if (this.now - this.pulses[n].t0 > 1200) this.pulses.splice(n, 1);
    for (let s = 0; s < this.strands.length; s++) {
      const strand = this.strands[s];
      if (!this.calm) strand.theta += (2 * Math.PI * (delta / 1000) * speedMul) / strand.spec.period;
      const kick = Math.max(0, Math.exp(-(this.now - strand.kickAt) / 150)) * 0.6;
      const theta = this.calm ? 1.1 : strand.theta + strand.spec.phase;
      for (let i = 0; i < POINTS; i++) {
        const u = i / (POINTS - 1);
        let y = strand.spec.amp * H * ampMul * Math.sin(strand.spec.n * Math.PI * u) * Math.sin(theta) + kick * Math.sin(Math.PI * u) * Math.sin(theta * 1.7);
        if (tremorHz > 0) y += 0.9 * (i % 2 ? -1 : 1) * Math.sin(2 * Math.PI * tremorHz * (this.now / 1000));
        for (let n = 0; n < this.pulses.length; n++) {
          const pulse = this.pulses[n];
          if (pulse.strand !== s) continue;
          const age = (this.now - pulse.t0) / 1000;
          const decay = Math.exp(-age / 0.22) * pulse.size * 0.5;
          const span = Math.max(1, strand.x1 - strand.x0);
          const spread = (280 * age) / span;
          const dl = ((u - (pulse.u0 - spread)) * span) / 5;
          const dr = ((u - (pulse.u0 + spread)) * span) / 5;
          y += decay * (Math.exp(-0.5 * dl * dl) + Math.exp(-0.5 * dr * dr));
        }
        strand.shape[i] = y;
      }
      const base = strand.colour === 0xffcf7a ? colour : strand.colour;
      for (let pass = 0; pass < 2; pass++) {
        g.lineStyle(pass === 0 ? 2.2 : 0.7, base, (pass === 0 ? 0.22 : 0.85) * alphaMul);
        g.beginPath();
        let drawing = false;
        for (let i = 0; i < POINTS; i++) {
          const u = i / (POINTS - 1);
          // The release wipes the string away from the centre outwards.
          if (wipe > 0 && Math.abs(u - 0.5) < wipe * 0.5) {
            drawing = false;
            continue;
          }
          const x = lerp(strand.x0, strand.x1, u);
          const y = lerp(strand.y0, strand.y1, u) + strand.shape[i];
          if (!drawing) { g.moveTo(x, y); drawing = true; } else g.lineTo(x, y);
        }
        g.strokePath();
      }
    }
  }

  private release(): void {
    this.released = true;
    this.onRelease?.();
    this.onRelease = undefined;
  }

  private updateOpening(delta: number): void {
    const t = this.now - this.openingStart;
    const h = this.hum;
    const calm = this.calm;
    if (!this.released && t >= 1170) this.release();

    // The gate listens, swells, then lets go.
    const listen = progress(t, 0, 250);
    const ready = this.opts.progress().level >= 2;
    this.ampMul = t < 250 ? lerp(ready ? 0.75 : 1, 0.5, listen) : t < 1170 ? lerp(0.5, 2.6, SINE_I(progress(t, 250, 800))) : t < 1290 ? lerp(3, 0, progress(t, 1170, 120)) : 0;
    this.speedMul = t < 250 ? 1 : lerp(1, 2.5, progress(t, 250, 800));
    const curtainAlpha = t < 250 ? lerp(0.26 + 0.12 * h, 0.22, listen) : 0.22 + 0.15 * progress(t, 250, 800);
    const retract = t < 1050 ? 1 : t < 1170 ? lerp(1, 0.2, CUBIC_I(progress(t, 1050, 120))) : lerp(0.2, 0, progress(t, 1170, 120));
    const curtainFade = calm ? 1 - progress(t, 1050, 300) : t < 1170 ? 1 : 1 - progress(t, 1170, 120);
    for (const img of this.curtain) {
      img.setScale(WORLD_TEXTURE_SCALE * (calm ? 1 : retract), WORLD_TEXTURE_SCALE).setAlpha(curtainAlpha * curtainFade)
        .setTint(lerpColor(ready ? EMBER_SOFT : EMBER, EMBER, listen));
    }
    for (const img of this.backing) img.setScale(WORLD_TEXTURE_SCALE * (calm ? 1 : retract), WORLD_TEXTURE_SCALE).setAlpha(0.42 * curtainFade);
    if (this.lines) {
      if (!calm) this.lines.tilePositionY += 3 * TEXEL * (delta / 1000);
      this.lines.setAlpha(0.12 * (1 - progress(t, 1050, 120)));
    }
    this.pool.setAlpha(t < 1575 ? lerp(0.18 + 0.08 * h, 0.3, progress(t, 250, 200)) : lerp(0.3, 0.12, progress(t, 1575, 925)));
    this.pool.setTint(t < 1575 ? 0xff8a3d : lerpColor(0xff8a3d, STEEL_DEEP, progress(t, 1575, 925)));

    // Tremble of the structure (never more than half a unit).
    const tremble = calm ? 0 : t < 450 ? 0.25 * progress(t, 250, 200) : t < 800 ? 0.25 : t < 1050 ? 0.4 : t < 1170 ? 0.5 : 0;
    const dx = tremble * Math.sin(2 * Math.PI * 26 * (t / 1000));
    for (const img of this.structure) img.setX((img.getData('baseX') as number) + dx);

    // Rune rows ignite bottom-up on the onsets.
    let ignited = 0;
    for (let r = 0; r < ROW_IGNITE.length; r++) if (t >= ROW_IGNITE[r]) ignited = r + 1;
    for (let r = 0; r < ROW_IGNITE.length; r++) {
      if (t >= ROW_IGNITE[r] && this.strands[r] && this.strands[r].kickAt < this.openingStart + ROW_IGNITE[r]) {
        this.strands[r].kickAt = this.now;
        this.strands[r].colour = WHITE_GOLD;
        if (!calm) {
          const row = GATE_ART.runeRows[r];
          for (const x of RUNE_X) this.shot(FX.spark, x, (row.top + row.bottom) / 2, { w: [9, 9], alpha: [1, 0], duration: 180, color: WHITE_GOLD, depth: G + 6 * EPS });
        }
      }
    }
    this.cropRows(this.runes, 0, 5);
    this.cropRows(this.runeOverlay, 0, ignited);
    if (t < 1300) {
      this.runes?.setTint(lerpColor(ready ? GOLD : EMBER_SOFT, EMBER_SOFT, listen))
        .setAlpha(lerp(ready ? 0.8 + 0.1 * h : 0.55 + 0.25 * h, 0.55 + 0.25 * h, listen));
      this.runeOverlay?.setTint(WHITE_GOLD).setAlpha(ignited ? 1 : 0);
    }
    const studFlare = t >= 1170 ? lerp(1, 0.5, progress(t, 1170, 400)) : 0.6 + 0.25 * h + 0.15 * progress(t, 250, 200) + (ignited ? 0.25 : 0);
    if (t < 1300) this.studs?.setTint(t >= 1170 ? WHITE_GOLD : EMBER_SOFT).setAlpha(studFlare);
    if (t < 1575) this.ring?.setTint(t >= 750 ? WHITE_GOLD : 0xffb85a).setAlpha(t >= 750 ? 1 : 0.55);

    // The forks ring at 800 and fall silent over the tail.
    if (t >= 800) this.tines?.setTint(WHITE_GOLD).setAlpha(t < 1575 ? progress(t, 800, 60) : 1 - SINE_IO(progress(t, 1575, 900)));

    // The disc turns like a key: two clicks.
    if (calm) {
      // Reduced motion: no rotation, a cross-dissolve to the turned disc instead.
      const turn = progress(t, 970, 200);
      this.discAlpha = turn < 0.5 ? 1 - turn * 2 * 0.6 : 0.4 + (turn - 0.5) * 2 * 0.6;
      this.disc?.setAngle(turn < 0.5 ? 90 : 0);
      this.discWave?.setAngle(turn < 0.5 ? 90 : 0);
    } else {
      const angle = t < 970 ? 90 : t < 1050 ? lerp(90, 45, BACK_O(progress(t, 970, 110))) : lerp(45, 0, BACK_O(progress(t, 1050, 110)));
      this.disc?.setAngle(angle);
      this.discWave?.setAngle(angle);
    }
    const discGlow = t < 970 ? 0.6 + 0.1 * h : t < 1170 ? 0.9 : t < 1300 ? 1 : 0;
    if (t < 1300) this.discWave?.setTint(t >= 1170 ? 0xffffff : 0xffb85a).setAlpha(discGlow);

    // After the release: cooling aftershocks, gold -> pale -> steel.
    if (t >= 1300) {
      const step = t < 1400 ? 0 : t < 1575 ? 1 : 2;
      const k = progress(t, [1300, 1400, 1575][step], 120);
      const from = [EMBER_SOFT, GOLD, PALE][step];
      const to = [GOLD, PALE, STEEL][step];
      const tint = lerpColor(from, to, k);
      const fade = progress(t, 1575, 925);
      this.runes?.setTint(tint).setAlpha(lerp(0.85, 0.42, fade));
      this.runeOverlay?.setAlpha(1 - progress(t, 1300, 300));
      this.studs?.setTint(lerpColor(tint, STEEL, fade)).setAlpha(lerp(0.5, 0.3, fade));
      this.ring?.setTint(lerpColor(tint, STEEL, fade)).setAlpha(lerp(0.7, 0.4, fade));
      const pulse = t < 2000 && !calm ? 0.06 * Math.sin(2 * Math.PI * 1.4 * (t / 1000)) : 0;
      this.discWave?.setTint(lerpColor(tint, STEEL_LIGHT, fade)).setAlpha(lerp(0.7, 0.5, fade) + pulse);
      if (this.inlay) {
        const grow = calm ? 1 : QUAD_O(progress(t, 1300, 130));
        this.inlay.setDisplaySize(64 * grow, 3).setTint(lerpColor(GOLD, STEEL_DEEP, fade)).setAlpha(lerp(0.45, 0.28, fade) * (calm ? progress(t, 1300, 200) : 1));
      }
      this.passage?.setAlpha(0.25 * fade);
    }

    // Strings: swell, then snap (wiped from the centre out).
    const wipe = t >= 1170 ? (calm ? 0 : CUBIC_I(progress(t, 1170, 200))) : 0;
    const stringAlpha = calm ? 1 - progress(t, 1050, 300) : t < 1370 ? 1 : 0;
    this.drawStrings(delta, calm ? 0.6 : this.ampMul, calm ? 0 : this.speedMul, 0xffcf7a, 0, stringAlpha, wipe);

    this.updateEmbers(ready, 1 - progress(t, 1170, 230));

    // Timed moments.
    this.momentOnce(t, 800, () => {
      if (calm) return;
      for (const x of [459, 564]) this.shot(BFX.wave, x, 1380, { w: [12, 19], h: [34, 54], alpha: [0.6, 0], duration: 420, color: WHITE_GOLD, depth: G + 6 * EPS, dy: -20 })
        .setAngle(-90);
    });
    this.momentOnce(t, 970, () => { if (!calm) this.shot(FX.spark, 512, 1396, { w: [8, 14], alpha: [1, 0], duration: 180, color: WHITE_GOLD, depth: G + 6 * EPS }); });
    this.momentOnce(t, 1050, () => { if (!calm) this.shot(FX.spark, 512, 1396, { w: [8, 14], alpha: [1, 0], duration: 180, color: WHITE_GOLD, depth: G + 6 * EPS }); });
    this.momentOnce(t, 1170, () => {
      if (calm) return;
      this.shot(FX.glow, 512, 1450, { w: [200, 200], h: [170, 170], alpha: [0.45, 0], duration: 360, color: 0xffe2b0, depth: G + 7 * EPS });
      this.shot(BFX.flare, 512, 1476, { w: [96, 96], h: [5, 5], alpha: [1, 0], duration: 280, color: WHITE_GOLD, depth: G + 7 * EPS });
      this.shot(BFX.ring, 512, GATE_ART.medallion.y, { w: [24, 110], alpha: [0.7, 0], duration: 460, color: 0xffd27a, depth: G + 7 * EPS, ease: CUBIC_O });
      this.shot(BFX.ringSoft, 512, 1504, { w: [20, 150], h: [7, 52], alpha: [0.5, 0], duration: 560, color: 0xffd27a, depth: 1.3, ease: CUBIC_O });
      if (Phaser.Geom.Rectangle.Overlaps(this.scene.cameras.main.worldView, VIEW)) this.opts.shake(260, 0.003);
      this.dust = this.own(this.scene.add.particles(0, 0, BFX.speck, {
        x: { min: 470, max: 554 }, y: { min: 1410, max: 1422 },
        lifespan: { min: 500, max: 900 }, speedY: { min: 10, max: 24 }, gravityY: 20,
        scale: { start: 2 / (4 * RENDER_SCALE), end: 1 / (4 * RENDER_SCALE) }, alpha: { start: 0.9, end: 0 },
        tint: 0xd8cbb0, quantity: 12, frequency: -1, emitting: false,
      }).setDepth(G + 7 * EPS));
      this.dust.explode(12);
    });
    this.momentOnce(t, 1300, () => {
      if (!calm) this.shot(BFX.ringSoft, 512, 1504, { w: [20, 110], h: [7, 38], alpha: [0.35, 0], duration: 560, color: GOLD, depth: 1.3, ease: CUBIC_O });
      this.buildOpen(false);
      this.floatNote(0, GOLD);
    });
    this.momentOnce(t, 1400, () => {
      if (!calm) this.shot(BFX.ringSoft, 512, 1504, { w: [20, 90], h: [7, 31], alpha: [0.25, 0], duration: 560, color: PALE, depth: 1.3, ease: CUBIC_O });
      this.floatNote(1, PALE);
    });
    this.momentOnce(t, 1575, () => {
      if (!calm) this.shot(BFX.ringSoft, 512, 1504, { w: [20, 80], h: [7, 28], alpha: [0.18, 0], duration: 560, color: STEEL, depth: 1.3, ease: CUBIC_O });
      this.floatNote(3, STEEL_LIGHT);
    });
    if (t >= 2600) {
      this.clearClosed();
      this.drop(this.dust);
      this.dust = undefined;
      this.applyOpenGlows(1);
      this.state = 'open';
    }
  }

  private readonly moments = new Set<number>();
  private momentOnce(t: number, at: number, fn: () => void): void {
    if (t < at || this.moments.has(at)) return;
    this.moments.add(at);
    fn();
  }

  private floatNote(frame: number, color: number): void {
    if (this.calm) return;
    const m = GATE_ART.medallion;
    const note = this.own(this.scene.add.image(m.x, m.y - 6, BFX.note, frame).setDisplaySize(12, 12).setTint(color).setDepth(G + 7 * EPS).setAlpha(0));
    this.notes.push({ image: note, t0: this.now, x: m.x, y: m.y - 6, deny: false });
  }

  private clearClosed(): void {
    [...this.backing, ...this.curtain, ...this.embers].forEach(obj => this.drop(obj));
    this.backing = [];
    this.curtain = [];
    this.embers = [];
    this.drop(this.lines);
    this.drop(this.strings);
    this.lines = undefined;
    this.strings = undefined;
    for (const img of this.structure) {
      const x = img.getData('baseX') as number | undefined;
      if (x !== undefined) img.setX(x);
    }
  }

  private applyOpenGlows(breath: number): void {
    this.cropRows(this.runes, 0, 5);
    this.runeOverlay?.setAlpha(0);
    this.runes?.setTint(STEEL).setAlpha(0.35 + 0.15 * breath);
    this.studs?.setTint(STEEL).setAlpha(0.3);
    this.ring?.setTint(STEEL).setAlpha(0.4);
    this.tines?.setAlpha(0);
    this.discWave?.setTint(STEEL_LIGHT).setAlpha(0.5);
    this.discAlpha = 1;
    this.disc?.setAngle(0);
    this.discWave?.setAngle(0);
    this.pool.setTint(STEEL_DEEP).setAlpha(0.12);
  }

  private updateOpen(hero: Phaser.GameObjects.Sprite): void {
    const breath = this.calm ? 0.5 : 0.5 + 0.5 * Math.sin((2 * Math.PI * this.time) / 5000);
    this.runes?.setAlpha(0.35 + 0.15 * breath);
    // Cool highland air drifts south through the passage.
    for (let i = 0; i < this.motes.length; i++) {
      const mote = this.motes[i];
      const f = ((this.time + (mote.getData('offset') as number)) % 6000) / 6000;
      mote.setPosition(492 + 20 * i + 2 * Math.sin(f * Math.PI * 3), lerp(1440, 1530, f)).setAlpha(0.3 * Math.sin(Math.PI * f));
    }
    // Footsteps on the threshold send a ripple out.
    const inside = hero.x > 480 && hero.x < 544 && hero.y > 1470 && hero.y < 1512;
    const moved = Math.hypot(hero.x - this.lastRippleX, hero.y - this.lastRippleY) >= 12;
    if (inside && moved && this.now - this.lastRipple >= 700) {
      this.lastRipple = this.now;
      this.lastRippleX = hero.x;
      this.lastRippleY = hero.y;
      this.inlayBoost = this.now;
      if (!this.calm) this.shot(BFX.ringSoft, hero.x, hero.y, { w: [8, 56], h: [3, 20], alpha: [0.45, 0], duration: 650, color: STEEL_LIGHT, depth: 1.3, ease: CUBIC_O });
    }
    if (this.inlay) this.inlay.setAlpha(0.28 + 0.15 * (1 - progress(this.now, this.inlayBoost, 300)));
  }

  private updateShots(): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      const k = clamp01((this.now - s.t0) / s.duration);
      const e = s.ease(k);
      s.image.setDisplaySize(lerp(s.w0, s.w1, e), lerp(s.h0, s.h1, e)).setAlpha(lerp(s.a0, s.a1, e));
      if (s.dy) s.image.setY(s.y0 + s.dy * e);
      if (k >= 1) {
        this.drop(s.image);
        this.shots.splice(i, 1);
      }
    }
  }

  private updateNotes(): void {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      const age = this.now - n.t0;
      if (age < 0) continue;
      const deny = n.deny;
      let y: number;
      let alpha: number;
      let end: number;
      if (deny) {
        end = 420;
        y = age < 150 ? n.y - 6 * QUAD_O(age / 150) : n.y - 6 + 10 * QUAD_I(progress(age, 150, 270));
        alpha = this.calm ? Math.sin(Math.PI * clamp01(age / end)) : age < 60 ? age / 60 : 1 - progress(age, 150, 270);
      } else {
        end = 1200;
        y = n.y - 18 * SINE_O(clamp01(age / end));
        alpha = age < 150 ? age / 150 : 1 - progress(age, 700, 500);
        n.image.setX(n.x + 1.5 * Math.sin(age / 180));
      }
      n.image.setY(y).setAlpha(Math.max(0, alpha));
      if (age >= end) {
        this.drop(n.image);
        this.notes.splice(i, 1);
      }
    }
  }
}
