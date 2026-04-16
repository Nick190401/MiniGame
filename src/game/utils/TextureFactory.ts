import Phaser from 'phaser';

export class TextureFactory {

  // ── Pixel map helper ───────────────────────────────────────────────────────
  // Renders string-array pixel art onto a graphics object.
  // Each character → a (scale × scale) filled rectangle. '.' = skip.
  private static drawPixelMap(
    g: Phaser.GameObjects.Graphics,
    rows: string[],
    palette: Record<string, number>,
    scale = 1
  ): void {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const color = palette[ch];
        if (color === undefined) return;
        g.fillStyle(color);
        g.fillRect(x * scale, y * scale, scale, scale);
      });
    });
  }

  // ── Player (Sound Keeper — full 16×16 pixel art) ──────────────────────────
  static createPlayerTextures(scene: Phaser.Scene): void {
    // Full 16×16 resolution (scale=1) for maximum detail
    const SCALE = 1;

    const pal: Record<string, number> = {
      // Hair — auburn, 4 shades (light from above, gradient top→bottom)
      H: 0x4a1808,  // darkest (outline, underside)
      h: 0x7a2818,  // dark (main mass)
      a: 0xb04828,  // mid (edge highlights, curved surface)
      r: 0xd86840,  // bright (tips, top rim light)
      // Skin
      S: 0xf8d0a0,  // light
      s: 0xd8a878,  // shadow (chin edge, nape)
      // Eyes — large 2×2 for expressiveness
      E: 0x181020,  // pupil (near-black)
      W: 0xf0f0f8,  // eye white
      // Headphones — signature accessory (Sound Keeper!)
      P: 0x404858,  // frame (dark metal)
      p: 0x6878a0,  // cushion (blue-gray)
      // Jacket — teal, the character's signature colour
      J: 0x1a6858,  // dark
      j: 0x288878,  // mid / base
      K: 0x40b898,  // highlight stripe
      // Undershirt
      T: 0x181828,  // very dark (visible at V-neck opening)
      // Belt / gold accent
      G: 0xd0a030,  // buckle + headphone LED indicator
      // Pants
      L: 0x242038,  // dark
      l: 0x343050,  // inner highlight
      // Boots
      O: 0x382418,  // dark leather
      o: 0x503828,  // highlight
    };

    // ── DOWN — front view, 4-frame walk cycle ───────────────────────────
    //  Sequence: 0 (stand) → 1 (left stride + bob) → 2 (stand) → 3 (right stride + bob)
    //  Body drops 1px on stride frames for natural walk bounce
    const down0 = [
      '....rahr........',  // hair tips (asymmetric spikes)
      '...rahhhar......',  // hair crown
      '..ahhhhhha......',  // hair wide
      '..HhhhhhhH......',  // hair base
      '..SWWSSWWS......',  // face + 2×2 eye whites
      '..SWESSEWS......',  // face + pupils
      '...sSSSSs.......',  // chin
      '...PpGppP.......',  // headphones + amber LED
      '..jJJJJJJj......',  // jacket shoulders
      '..jJKJTJKj......',  // jacket body
      '...jJGGJj.......',  // belt
      '...LL..LL.......',  // legs neutral
      '...Ll..lL.......',
      '...Oo..oO.......',  // boots even
      '................',
      '................',
    ];
    const down1 = [                    // left stride — body drops 1px
      '................',
      '....rahr........',
      '...rahhhar......',
      '..ahhhhhha......',
      '..HhhhhhhH......',
      '..SWWSSWWS......',
      '..SWESSEWS......',
      '...sSSSSs.......',
      '...PpGppP.......',
      '..jJJJJJJj......',
      '..jJKJTJKj......',
      '...jJGGJj.......',
      '..LL....LL......',  // left leg swings wide-left
      '..Ll.....L......',  // left leg detail, right pulled in
      '..Oo....oO......',  // left boot extended
      '................',
    ];
    const down2 = [                    // stand (same as 0 — pass-through)
      '....rahr........',
      '...rahhhar......',
      '..ahhhhhha......',
      '..HhhhhhhH......',
      '..SWWSSWWS......',
      '..SWESSEWS......',
      '...sSSSSs.......',
      '...PpGppP.......',
      '..jJJJJJJj......',
      '..jJKJTJKj......',
      '...jJGGJj.......',
      '...LL..LL.......',
      '...Ll..lL.......',
      '...Oo..oO.......',
      '................',
      '................',
    ];
    const down3 = [                    // right stride — body drops 1px
      '................',
      '....rahr........',
      '...rahhhar......',
      '..ahhhhhha......',
      '..HhhhhhhH......',
      '..SWWSSWWS......',
      '..SWESSEWS......',
      '...sSSSSs.......',
      '...PpGppP.......',
      '..jJJJJJJj......',
      '..jJKJTJKj......',
      '...jJGGJj.......',
      '...LL....LL.....',  // right leg swings wide-right
      '...L.....lL.....',  // right leg detail, left pulled in
      '...Oo....oO.....',  // right boot extended
      '................',
    ];

    // ── UP — back view, 4-frame walk cycle ────────────────────────────
    const up0 = [
      '....rahr........',
      '...rahhhar......',
      '..ahhhhhha......',
      '..HhhhhhhH......',
      '..hhaahahh......',  // back-of-head texture
      '...hHHHHh.......',  // nape
      '...PppppP.......',  // headphone band
      '..jJJJJJJj......',  // jacket back
      '..jJJjjJJj......',  // center seam
      '..jJjJJjJj......',  // side folds
      '...jJJJJj.......',
      '...LL..LL.......',
      '...Ll..lL.......',
      '...Oo..oO.......',
      '................',
      '................',
    ];
    const up1 = [                      // left stride + bob
      '................',
      '....rahr........',
      '...rahhhar......',
      '..ahhhhhha......',
      '..HhhhhhhH......',
      '..hhaahahh......',
      '...hHHHHh.......',
      '...PppppP.......',
      '..jJJJJJJj......',
      '..jJJjjJJj......',
      '..jJjJJjJj......',
      '...jJJJJj.......',
      '..LL....LL......',
      '..Ll.....L......',
      '..Oo....oO......',
      '................',
    ];
    const up2 = [                      // stand (pass-through)
      '....rahr........',
      '...rahhhar......',
      '..ahhhhhha......',
      '..HhhhhhhH......',
      '..hhaahahh......',
      '...hHHHHh.......',
      '...PppppP.......',
      '..jJJJJJJj......',
      '..jJJjjJJj......',
      '..jJjJJjJj......',
      '...jJJJJj.......',
      '...LL..LL.......',
      '...Ll..lL.......',
      '...Oo..oO.......',
      '................',
      '................',
    ];
    const up3 = [                      // right stride + bob
      '................',
      '....rahr........',
      '...rahhhar......',
      '..ahhhhhha......',
      '..HhhhhhhH......',
      '..hhaahahh......',
      '...hHHHHh.......',
      '...PppppP.......',
      '..jJJJJJJj......',
      '..jJJjjJJj......',
      '..jJjJJjJj......',
      '...jJJJJj.......',
      '...LL....LL.....',
      '...L.....lL.....',
      '...Oo....oO.....',
      '................',
    ];

    // ── RIGHT — side profile, 4-frame walk cycle (flipX → left) ──────
    //  0: stand, 1: stride A (legs apart), 2: legs cross, 3: stride B
    const right0 = [
      '.....rah........',
      '....ahhhh.......',
      '...Hhhhhha......',
      '...hhhhha.......',
      '....SSWWS.......',
      '....SSWES.......',
      '.....Sss........',
      '....PppP........',
      '...jJJJJj.......',
      '...jJJKJj.......',
      '....jGJj........',
      '....LLL.........',  // legs together
      '....LlL.........',
      '....OoO.........',
      '................',
      '................',
    ];
    const right1 = [                   // stride A — legs apart + bob
      '................',
      '.....rah........',
      '....ahhhh.......',
      '...Hhhhhha......',
      '...hhhhha.......',
      '....SSWWS.......',
      '....SSWES.......',
      '.....Sss........',
      '....PppP........',
      '...jJJJJj.......',
      '...jJJKJj.......',
      '....jGJj........',
      '...L...L........',  // back leg + front leg spread
      '...l...l........',
      '...O...O........',  // boots far apart
      '................',
    ];
    const right2 = [                   // legs crossing (pass-through)
      '.....rah........',
      '....ahhhh.......',
      '...Hhhhhha......',
      '...hhhhha.......',
      '....SSWWS.......',
      '....SSWES.......',
      '.....Sss........',
      '....PppP........',
      '...jJJJJj.......',
      '...jJJKJj.......',
      '....jGJj........',
      '....LL..........',  // legs close together, shifted
      '....lL..........',
      '....oO..........',
      '................',
      '................',
    ];
    const right3 = [                   // stride B — legs apart opposite + bob
      '................',
      '.....rah........',
      '....ahhhh.......',
      '...Hhhhhha......',
      '...hhhhha.......',
      '....SSWWS.......',
      '....SSWES.......',
      '.....Sss........',
      '....PppP........',
      '...jJJJJj.......',
      '...jJJKJj.......',
      '....jGJj........',
      '....L..L........',  // legs apart (slightly different spacing)
      '....l..l........',
      '....O..O........',  // boots apart
      '................',
    ];

    const frames: Array<[string, string[]]> = [
      ['player-down-0', down0],
      ['player-down-1', down1],
      ['player-down-2', down2],
      ['player-down-3', down3],
      ['player-up-0', up0],
      ['player-up-1', up1],
      ['player-up-2', up2],
      ['player-up-3', up3],
      ['player-right-0', right0],
      ['player-right-1', right1],
      ['player-right-2', right2],
      ['player-right-3', right3],
      ['player-idle', down0],
    ];

    frames.forEach(([key, rows]) => {
      if (scene.textures.exists(key)) return;
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      TextureFactory.drawPixelMap(g, rows, pal, SCALE);
      g.generateTexture(key, 16, 16);
      g.destroy();
    });
  }

  // ── Enemies (creature-like, GBA Pokémon monster style) ───────────────────
  static createAllEnemyTextures(scene: Phaser.Scene): void {

    // Static Noise — electric jellyfish: cyan oval body, yellow lightning spikes
    if (!scene.textures.exists('enemy-static-noise')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      // Body
      g.fillStyle(0x00bbdd);
      g.fillEllipse(8, 10, 13, 10);
      // Electric spikes on top
      g.fillStyle(0xffee00);
      g.fillTriangle(5, 7, 3, 1, 7, 6);
      g.fillTriangle(8, 5, 7, 0, 9, 0);
      g.fillTriangle(11, 7, 13, 1, 9, 6);
      // Eye stripe (dark)
      g.fillStyle(0x003355);
      g.fillRect(3, 9, 10, 2);
      // Eye glows (cyan)
      g.fillStyle(0x00ffff);
      g.fillRect(4, 9, 3, 2);
      g.fillRect(9, 9, 3, 2);
      // Pupils
      g.fillStyle(0x001122);
      g.fillRect(5, 10, 1, 1);
      g.fillRect(10, 10, 1, 1);
      // Tentacles
      g.fillStyle(0x009aaa);
      g.fillRect(3, 14, 2, 2);
      g.fillRect(7, 15, 2, 2);
      g.fillRect(11, 14, 2, 2);
      g.generateTexture('enemy-static-noise', 16, 16);
      g.destroy();
    }

    // Broken Signal — glitch cube creature: red body, black glitch bars, chip eyes
    if (!scene.textures.exists('enemy-broken-signal')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      // Main body block
      g.fillStyle(0xcc1111);
      g.fillRect(2, 3, 12, 11);
      // Body highlight top
      g.fillStyle(0xee2222);
      g.fillRect(2, 3, 12, 2);
      // Glitch bars (horizontal black lines)
      g.fillStyle(0x000000);
      g.fillRect(2, 6, 12, 1);
      g.fillRect(2, 10, 12, 1);
      // Eyes (glowing amber)
      g.fillStyle(0xff8800);
      g.fillRect(4, 7, 3, 2);
      g.fillRect(9, 7, 3, 2);
      // Pupils
      g.fillStyle(0xffff00);
      g.fillRect(5, 8, 1, 1);
      g.fillRect(10, 8, 1, 1);
      // Body shadow
      g.fillStyle(0x880000);
      g.fillRect(2, 12, 12, 2);
      // Stumpy legs
      g.fillStyle(0x990000);
      g.fillRect(3, 13, 3, 3);
      g.fillRect(10, 13, 3, 3);
      // Glitch fringe pixels (corruption effect)
      g.fillStyle(0xff2222);
      g.fillRect(0, 7, 2, 1);
      g.fillRect(14, 9, 2, 1);
      g.fillRect(1, 11, 1, 2);
      g.generateTexture('enemy-broken-signal', 16, 16);
      g.destroy();
    }

    // Silence — dark void wraith: tall purple figure, hollow glowing eye sockets
    if (!scene.textures.exists('enemy-silence')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      // Outer glow (purple mist)
      g.fillStyle(0x440044, 0.5);
      g.fillRect(1, 1, 14, 15);
      // Main body (tall and narrow)
      g.fillStyle(0x440066);
      g.fillRect(4, 3, 8, 12);
      // Tapered head
      g.fillStyle(0x5500aa);
      g.fillRect(5, 0, 6, 5);
      g.fillRect(4, 2, 8, 3);
      // Hollow eye sockets (very dark)
      g.fillStyle(0x0a000f);
      g.fillRect(5, 4, 2, 3);
      g.fillRect(9, 4, 2, 3);
      // Eye glow (purple) inside sockets
      g.fillStyle(0xcc44ff);
      g.fillRect(5, 4, 1, 1);
      g.fillRect(9, 4, 1, 1);
      // Purple edge glow
      g.fillStyle(0x6600bb);
      g.fillRect(2, 5, 2, 8);
      g.fillRect(12, 5, 2, 8);
      // Wispy bottom tendrils
      g.fillStyle(0x330055);
      g.fillRect(3, 14, 2, 2);
      g.fillRect(6, 15, 2, 2);
      g.fillRect(10, 14, 2, 2);
      // Highlight on head
      g.fillStyle(0x8800cc);
      g.fillRect(6, 1, 2, 2);
      g.generateTexture('enemy-silence', 16, 16);
      g.destroy();
    }
  }

  // ── Boss (32×32) ──────────────────────────────────────────────────────────
  static createBossTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists('boss-gatekeeper')) return;

    type DrawFn = (g: Phaser.GameObjects.Graphics) => void;

    const drawPhase1: DrawFn = (g) => {
      // Cloak base — deep purple
      g.fillStyle(0x1a0035);
      g.fillRect(4, 12, 24, 20);
      // Cloak sides — lighter purple edge
      g.fillStyle(0x2d0060);
      g.fillRect(4, 12, 3, 20);
      g.fillRect(25, 12, 3, 20);
      // Cloak vertical folds
      g.fillStyle(0x0d001a);
      g.fillRect(13, 14, 2, 18);
      g.fillRect(17, 14, 2, 18);
      // Hood — very dark
      g.fillStyle(0x0f0020);
      g.fillRect(7, 2, 18, 14);
      // Hood top arc
      g.fillStyle(0x1a0035);
      g.fillRect(9, 0, 14, 4);
      g.fillRect(8, 1, 16, 3);
      // Deep shadow inside hood
      g.fillStyle(0x000000);
      g.fillRect(9, 5, 14, 7);
      // Gold chain/necklace
      g.fillStyle(0xffd700);
      g.fillRect(10, 12, 12, 2);
      g.fillRect(11, 11, 10, 1);  // chain upper curve
      // Gold trim cloak bottom
      g.fillStyle(0xcc9900);
      g.fillRect(4, 30, 24, 2);
      // Glowing white eyes
      g.fillStyle(0xffffff);
      g.fillRect(10, 8, 4, 2);
      g.fillRect(18, 8, 4, 2);
      // Eye inner glow (pale blue)
      g.fillStyle(0xaaddff);
      g.fillRect(11, 8, 2, 2);
      g.fillRect(19, 8, 2, 2);
      // Purple orb hands
      g.fillStyle(0x6600cc);
      g.fillCircle(3, 23, 4);
      g.fillCircle(29, 23, 4);
      g.fillStyle(0xaa44ff);
      g.fillCircle(3, 22, 2);
      g.fillCircle(29, 22, 2);
    };

    const drawPhase2: DrawFn = (g) => {
      // Brighter purple — cloak tearing
      g.fillStyle(0x2d0060);
      g.fillRect(4, 12, 24, 20);
      g.fillStyle(0x5500aa);
      g.fillRect(4, 12, 3, 20);
      g.fillRect(25, 12, 3, 20);
      g.fillStyle(0x1a0040);
      g.fillRect(13, 14, 2, 18);
      g.fillRect(17, 14, 2, 18);
      // Cloak tears (dark rips)
      g.fillStyle(0x000000);
      g.fillRect(7, 18, 2, 7);
      g.fillRect(23, 21, 2, 9);
      g.fillStyle(0x1a0040);
      g.fillRect(7, 2, 18, 14);
      g.fillStyle(0x2d0060);
      g.fillRect(9, 0, 14, 4);
      g.fillRect(8, 1, 16, 3);
      g.fillStyle(0x000000);
      g.fillRect(9, 5, 14, 7);
      // Brighter gold chain
      g.fillStyle(0xffdd00);
      g.fillRect(10, 12, 12, 2);
      g.fillRect(11, 11, 10, 1);
      g.fillStyle(0xffaa00);
      g.fillRect(4, 30, 24, 2);
      // Orange-red eyes
      g.fillStyle(0xff6600);
      g.fillRect(10, 8, 4, 2);
      g.fillRect(18, 8, 4, 2);
      g.fillStyle(0xffcc00);
      g.fillRect(11, 8, 2, 2);
      g.fillRect(19, 8, 2, 2);
      // Magenta orbs
      g.fillStyle(0xff00ff);
      g.fillCircle(3, 23, 4);
      g.fillCircle(29, 23, 4);
      g.fillStyle(0xff88ff);
      g.fillCircle(3, 22, 2);
      g.fillCircle(29, 22, 2);
    };

    const drawPhase3: DrawFn = (g) => {
      // Blood red cloak
      g.fillStyle(0x3d0000);
      g.fillRect(4, 12, 24, 20);
      g.fillStyle(0x8b0000);
      g.fillRect(4, 12, 3, 20);
      g.fillRect(25, 12, 3, 20);
      g.fillStyle(0x1a0000);
      g.fillRect(13, 14, 2, 18);
      g.fillRect(17, 14, 2, 18);
      // Heavy cloak tears
      g.fillStyle(0x000000);
      g.fillRect(6, 15, 2, 10);
      g.fillRect(24, 18, 2, 12);
      g.fillRect(11, 20, 1, 12);
      g.fillRect(20, 22, 1, 10);
      g.fillStyle(0x1a0000);
      g.fillRect(7, 2, 18, 14);
      g.fillStyle(0x3d0000);
      g.fillRect(9, 0, 14, 4);
      g.fillRect(8, 1, 16, 3);
      g.fillStyle(0x000000);
      g.fillRect(9, 5, 14, 7);
      // Burning orange chain
      g.fillStyle(0xff8800);
      g.fillRect(10, 12, 12, 2);
      g.fillRect(11, 11, 10, 1);
      g.fillStyle(0xff3300);
      g.fillRect(4, 30, 24, 2);
      // Flame red eyes (bigger, angrier)
      g.fillStyle(0xff0000);
      g.fillRect(9, 7, 5, 3);
      g.fillRect(18, 7, 5, 3);
      g.fillStyle(0xff8800);
      g.fillRect(10, 8, 3, 1);
      g.fillRect(19, 8, 3, 1);
      // Enraged fire orbs
      g.fillStyle(0xff0000);
      g.fillCircle(2, 23, 5);
      g.fillCircle(30, 23, 5);
      g.fillStyle(0xff6600);
      g.fillCircle(2, 22, 3);
      g.fillCircle(30, 22, 3);
      // White-hot center
      g.fillStyle(0xffff00);
      g.fillCircle(2, 22, 1);
      g.fillCircle(30, 22, 1);
    };

    const phases: Array<[string, DrawFn]> = [
      ['boss-gatekeeper', drawPhase1],
      ['boss-gatekeeper-phase2', drawPhase2],
      ['boss-gatekeeper-phase3', drawPhase3],
    ];

    phases.forEach(([key, drawFn]) => {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      drawFn(g);
      g.generateTexture(key, 32, 32);
      g.destroy();
    });
  }

  // ── Tiles (GBA Pokémon palette — rich pixel art) ──────────────────────────
  static createTileTextures(scene: Phaser.Scene): void {
    const makeTile = (key: string, drawFn: (g: Phaser.GameObjects.Graphics) => void) => {
      if (scene.textures.exists(key)) return;
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      drawFn(g);
      g.generateTexture(key, 16, 16);
      g.destroy();
    };

    const makePixelTile = (key: string, rows: string[], pal: Record<string, number>) => {
      if (scene.textures.exists(key)) return;
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      TextureFactory.drawPixelMap(g, rows, pal, 1);
      g.generateTexture(key, 16, 16);
      g.destroy();
    };

    // ── Grass — organic GBA green with natural detail ────────────────────────
    const grassPal: Record<string, number> = {
      d: 0x5a9840, g: 0x68a848, G: 0x78b858, l: 0x88cc68, e: 0x4e883a, b: 0x90d870,
    };
    makePixelTile('tile-grass', [
      'gGGlgGGlgGGlgGGl',
      'GllGGllGGllGGllG',
      'GlbGGllGGlbGGllG',
      'gGGlgGGlgGGlgGGl',
      'ddgGddgGddgGddgG',
      'gGGlgGGlgGGlgGGl',
      'GllGGllGGllGGllG',
      'GllGGleGGllGGllG',
      'gGGlgGGlgGGlgGGl',
      'ddgGddgGddgGddgG',
      'gGGlgGGlgGGlgGGl',
      'GllGGllGGllGGllG',
      'GllGGllGGllGGlbG',
      'gGGlgGGlgGGlgGGl',
      'ddgGddgGddgGddgG',
      'gGGegGGlgGGlgGGl',
    ].map(r => r.slice(0, 16)), grassPal);

    // ── Path — worn dirt with pebbles and ruts ───────────────────────────────
    const pathPal: Record<string, number> = {
      P: 0xd0a868, p: 0xc09050, d: 0xb08040, h: 0xe0c088, g: 0xa07838, s: 0x907030, r: 0xb89048,
    };
    makePixelTile('tile-path', [
      'PPPhPPPrPPPhPPPP',
      'PPPPpPPPPPPPpPPP',
      'PPhPPPPPPhPPPPrP',
      'PPPPPdPPPPPPPPPP',
      'ddddgddddddgdddd',
      'PPPPPPPPhPPPPPPP',
      'PPhPPsPPPPPPhPPP',
      'PPPPPPPPPPpPPPPP',
      'PPrPPPPPPhPPPsPP',
      'PPPPPPPPPPPPPPPr',
      'dddddddgdddddddg',
      'PPPhPPPPPPPhPPPP',
      'PPPPPPrPPPPPPPPP',
      'PPhPPPPPPPsPPPPP',
      'PPPPsPPPhPPPPPPP',
      'PPPPPPPPPPPPrPPP',
    ].map(r => r.slice(0, 16)), pathPal);

    // ── Wall / cliff — layered stone with moss ───────────────────────────────
    makeTile('tile-wall', g => {
      // Cliff top highlight
      g.fillStyle(0xb0a070); g.fillRect(0, 0, 16, 2);
      g.fillStyle(0xa09060); g.fillRect(0, 2, 16, 1);
      // Face — two stone rows
      g.fillStyle(0x887058); g.fillRect(0, 3, 16, 5);
      g.fillStyle(0x786048); g.fillRect(0, 8, 16, 5);
      // Bottom shadow
      g.fillStyle(0x604830); g.fillRect(0, 13, 16, 3);
      // Mortar lines
      g.fillStyle(0x605038); g.fillRect(0, 7, 16, 1);
      // Vertical mortar (offset rows)
      g.fillRect(5, 3, 1, 4); g.fillRect(11, 3, 1, 4);
      g.fillRect(3, 8, 1, 5); g.fillRect(8, 8, 1, 5); g.fillRect(14, 8, 1, 5);
      // Stone highlights
      g.fillStyle(0x988068); g.fillRect(1, 3, 3, 1); g.fillRect(7, 3, 3, 1);
      g.fillRect(4, 8, 3, 1); g.fillRect(10, 8, 3, 1);
      // Moss spots
      g.fillStyle(0x587840); g.fillRect(1, 5, 2, 1); g.fillRect(13, 10, 2, 1);
      g.fillStyle(0x6a8848); g.fillRect(2, 5, 1, 1); g.fillRect(14, 10, 1, 1);
    });

    // ── Tree top — lush round canopy with depth ──────────────────────────────
    const treePal: Record<string, number> = {
      D: 0x1a3810, d: 0x285818, M: 0x387828, m: 0x489838, L: 0x60b048, l: 0x78c860, H: 0x8ad870,
    };
    makePixelTile('tile-tree-top', [
      '..dMMLLMMMLLMd..',
      '.dMMLlLlLlLMMdd.',
      'dMMLllLlLllMMMdD',
      'MMLlHlLLlHllMMLM',
      'MMLlllLLlllLMMMM',
      'MMMLLLlLLLMMMMmM',
      'mMMMMLLMMMMMmmdM',
      'dMMMmMMMMMMmDDdM',
      'DdMmMmMmMmDDDDdd',
      'DDdMmMmMmdDDDDDD',
      'DDDdddddddDDDDDD',
      'DDDDDDdddDDDDDDD',
      'DDDDDDDDDDDDDDDd',
      'dDDDDDDDDDDDDDDD',
      'DDdDDDDDDDDDdDDD',
      'dDDDDDDDDDDDDDDd',
    ].map(r => r.slice(0, 16)), treePal);

    // ── Tree top variant 2 — warmer, bushier canopy ─────────────────────────
    const treePal2: Record<string, number> = {
      D: 0x1e3818, d: 0x2c5820, M: 0x3c7830, m: 0x509840, L: 0x68b050, l: 0x80c868, H: 0x90d878,
    };
    makePixelTile('tile-tree-top-2', [
      '....dMLLLMd.....',
      '..dMMLlLlLMMd...',
      'dMMllLlLllLMMMdD',
      'MMlHllLLllHlMMLM',
      'MMLllLLLlllLMMMM',
      'MMMMLLlLLLMMMmMM',
      'mMMMMMLMMMMMmmdM',
      'dMMMmMMMMMmDDDdM',
      'DdMmMmMmMmDDDDdd',
      'DDdMmMmMmdDDDDDD',
      'DDDdddddddDDDDDD',
      'DDDDDDdddDDDDDDD',
      'DDDDDDDDDDDDDDDd',
      'dDDDDDDDDDDDDDDD',
      'DDdDDDDDDDDDdDDD',
      'dDDDDDDDDDDDDDDd',
    ].map(r => r.slice(0, 16)), treePal2);

    // ── Tree trunk — bark detail on grass ────────────────────────────────────
    const trunkPal: Record<string, number> = {
      g: 0x68a848, G: 0x78b858, l: 0x88cc68,
      T: 0x6a4028, t: 0x804830, h: 0x986040, k: 0x583018, r: 0x503010,
      D: 0x1a3810, d: 0x285818, M: 0x387828,
    };
    makePixelTile('tile-tree-trunk', [
      'DDDDDDDDDDDDDDDd',
      'dDDddMMMMdddDDDd',
      '..dd.thk.dd.....',
      '.....thk........',
      '.....thk........',
      '.....thk........',
      '.....thh........',
      '.....thk........',
      '.....thk........',
      '.....thk........',
      '.....thh........',
      '.....thk........',
      '....rthkr.......',
      '...rrthkrr......',
      '..rr.thh.rr.....',
      '.rr..thk..rr....',
    ].map(r => r.slice(0, 16)), trunkPal);

    // ── Tall grass — distinct blade shapes ───────────────────────────────────
    const tallPal: Record<string, number> = {
      B: 0x2a6818, b: 0x387828, m: 0x489838, t: 0x60b048, h: 0x78c860, d: 0x1e5010,
    };
    makePixelTile('tile-tall-grass', [
      'tBh.tBh.tBh.tBh.',
      'mBb.mBb.mBb.mBb.',
      'bBd.bBd.bBd.bBd.',
      'bBd.bBd.bBd.bBd.',
      '.tBh.tBh.tBh.tBh',
      '.mBb.mBb.mBb.mBb',
      '.bBd.bBd.bBd.bBd',
      '.bBd.bBd.bBd.bBd',
      'tBh.tBh.tBh.tBh.',
      'mBb.mBb.mBb.mBb.',
      'bBd.bBd.bBd.bBd.',
      'bBd.bBd.bBd.bBd.',
      '.tBh.tBh.tBh.tBh',
      '.mBb.mBb.mBb.mBb',
      '.bBd.bBd.bBd.bBd',
      '.bBd.bBd.bBd.bBd',
    ].map(r => r.slice(0, 16)), tallPal);

    // ── Water — deep blue with foam and waves ────────────────────────────────
    const waterPal: Record<string, number> = {
      D: 0x2060c8, d: 0x2868d8, W: 0x3878f0, w: 0x4888ff, L: 0x58a0ff, f: 0xc0e0ff, s: 0x90c8ff,
    };
    makePixelTile('tile-water', [
      'WWwwWWwwWWwwWWww',
      'WwLwWwLwWwLwWwLw',
      'wLfsWwLwwLfswLLw',
      'WWwwWWwwWWwwWWww',
      'ddDDddDDddDDddDD',
      'WWwwWWwwWWwwWWww',
      'WwLwWwLwWwLwWwLw',
      'wLLwwLfswLLwwLsw',
      'WWwwWWwwWWwwWWww',
      'ddDDddDDddDDddDD',
      'WWwwWWwwWWwwWWww',
      'WwLwWwLwWwLwWwLw',
      'wLswwLLwwLfswLLw',
      'WWwwWWwwWWwwWWww',
      'ddDDddDDddDDddDD',
      'WWwwWWwwWWwwWWww',
    ].map(r => r.slice(0, 16)), waterPal);

    // ── Gate — imposing golden energy bars ───────────────────────────────────
    makeTile('tile-gate', g => {
      g.fillStyle(0x1a0c00); g.fillRect(0, 0, 16, 16);
      // Gold bars with gradient
      const bars = [1, 6, 11];
      bars.forEach(x => {
        g.fillStyle(0xcc9900); g.fillRect(x, 0, 4, 16);
        g.fillStyle(0xffd700); g.fillRect(x + 1, 0, 2, 16);
        g.fillStyle(0xffee88); g.fillRect(x + 1, 0, 1, 16);
      });
      // Horizontal crossbars
      g.fillStyle(0xaa7700); g.fillRect(0, 3, 16, 2); g.fillRect(0, 11, 16, 2);
      g.fillStyle(0xddaa00); g.fillRect(0, 4, 16, 1); g.fillRect(0, 12, 16, 1);
      // Energy glow between bars
      g.fillStyle(0xff880044); g.fillRect(5, 0, 1, 16); g.fillRect(10, 0, 1, 16);
      g.fillStyle(0xffaa0033); g.fillRect(0, 7, 16, 2);
    });

    // Gate open — grass (swap in WorldScene when gate opens)
    makeTile('tile-gate-open', g => {
      g.fillStyle(0x78b858); g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x68a848); g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8);
    });

    // ── Building wall — warm wood planks (Echo Village) ──────────────────────
    const woodPal: Record<string, number> = {
      P: 0x9a7050, p: 0x8a6040, H: 0xb08058, h: 0xa87848,
      g: 0x684828, n: 0x584020, k: 0x785838,
    };
    makePixelTile('tile-building-wall', [
      'PHhPPHhPPPHhPPPH',
      'PPPPpPPPPPPPpPPP',
      'PPHhPPPPPHhPPPPP',
      'gggggggggggggggg',
      'pPPPHhPPpPPPHhPP',
      'PPnPPPPPPPPPPPnP',
      'pPPPPPHhPPPPPPPP',
      'gggggggggggggggg',
      'PPHhPPPPkHhPPPPP',
      'PPPPPnPPPPPPpPPP',
      'PPHhPPPPPHhPPPPP',
      'gggggggggggggggg',
      'pPPPPHhPpPPPPHhP',
      'PPPPPPPPPPnPPPPP',
      'pPPHhPPPPPPPHhPP',
      'gggggggggggggggg',
    ].map(r => r.slice(0, 16)), woodPal);

    // ── Wood wall with window ───────────────────────────────────────────────
    const woodWinPal: Record<string, number> = {
      P: 0x9a7050, p: 0x8a6040, H: 0xb08058, h: 0xa87848,
      g: 0x684828, n: 0x584020, k: 0x785838,
      N: 0x402818, Q: 0xb8d8f0, q: 0x88a8c8, Z: 0xa0c0e0,
    };
    makePixelTile('tile-bldg-wall-win', [
      'PPPPpPPPPPPPpPPP',
      'PHhPPPPPPPHhPPPH',
      'PPPPNNNNNNnPPPPP',
      'PPHhNQZZQNnhPPPP',
      'ggggNqZZqNnggPPg',
      'pPPhNQZZQNnPHhPP',
      'PPPPNNNNNNnPPPPP',
      'gggggggggggggggg',
      'pPPPHhPPpPPPHhPP',
      'PPPPPPPPPPPPPPnP',
      'PPHhPPPPPHhPPPPP',
      'gggggggggggggggg',
      'pPPPPHhPpPPPPHhP',
      'PPPPPPPPPPPPPPPp',
      'pPPHhPPPPPPPHhPP',
      'gggggggggggggggg',
    ].map(r => r.slice(0, 16)), woodWinPal);

    // ── Building wall — cool gray stone (Neon Junction) ──────────────────────
    const stonePal: Record<string, number> = {
      S: 0x808890, s: 0x707880, H: 0x98a0a8, d: 0x606870, m: 0x505860, v: 0x8890a0,
    };
    makePixelTile('tile-bldg-stone', [
      'HSSSSSSdmHSSSSSSd',
      'SSSvSSSdmSSSSvSSd',
      'SSSSSSSdmSSSSSSSd',
      'SSSSSSsdmSSSSSSsd',
      'mmmmmmmmmmmmmmmm',
      'mHSSsdmHSSSSSSdmH',
      'mSSSsdmSSSSvSSdmS',
      'mSSSsdmSSSSSSSdmS',
      'mmmmmmmmmmmmmmmm',
      'HSSSSSSdmHSSSSSd',
      'SvSSSSSdmSSSSvSd',
      'SSSSSSSdmSSSSSSd',
      'SSSSSSsdmSSSSSsd',
      'mmmmmmmmmmmmmmmm',
      'mHSSSSdmHSSSSSSdm',
      'mSSvSSdmSSSSSSSdm',
    ].map(r => r.slice(0, 16)), stonePal);

    // ── Stone wall with window ──────────────────────────────────────────────
    const stoneWinPal: Record<string, number> = {
      S: 0x808890, s: 0x707880, H: 0x98a0a8, d: 0x606870, m: 0x505860, v: 0x8890a0,
      N: 0x404050, Q: 0xb8d8f0, q: 0x88a8c8, Z: 0xa0c0e0,
    };
    makePixelTile('tile-bldg-stone-win', [
      'HSSSSSSdmHSSSSSS',
      'SSSvNNNNNNSvSSSS',
      'SSSSNQZZQNSSSSSd',
      'SSSSNqZZqNSSSSsd',
      'mmmmNNNNNNmmmmmm',
      'mHSSsdmHSSSSSSdm',
      'mSSSsdmSSSSvSSdm',
      'mSSSsdmSSSSSSSdm',
      'mmmmmmmmmmmmmmmm',
      'HSSSSSSdmHSSSSSd',
      'SvSSSSSdmSSSSvSd',
      'SSSSSSSdmSSSSSSd',
      'SSSSSSsdmSSSSSsd',
      'mmmmmmmmmmmmmmmm',
      'mHSSSSdmHSSSSSSd',
      'mSSvSSdmSSSSSSSd',
    ].map(r => r.slice(0, 16)), stoneWinPal);

    // ── Building roof — brown wooden shingles (Echo Village) ─────────────────
    const roofBrownPal: Record<string, number> = {
      R: 0x9a5030, r: 0x884020, h: 0xb86840, s: 0x703018, d: 0x602810, l: 0xc87848,
    };
    makePixelTile('tile-building-roof', [
      'hhRRRRhhRRRRhhRR',
      'RRRRRRRRRRRRrRRR',
      'RRrRRRRRRRRRRRRR',
      'rrssrrssrrssrrss',
      'ssddssddssddssdd',
      'RRhhRRRRhhRRRRhh',
      'RRRRRRrRRRRRRRRR',
      'RRRRRRRRRRrRRRRR',
      'rrssrrssrrssrrss',
      'ssddssddssddssdd',
      'hhRRRRhhRRRRhhRR',
      'RRRRrRRRRRRRRRRR',
      'RRRRRRRRRRRRrRRR',
      'rrssrrssrrssrrss',
      'ssddssddssddssdd',
      'ddddddddddddddd',
    ].map(r => r.slice(0, 16)), roofBrownPal);

    // ── Building roof — blue ceramic (Muse's Study) ──────────────────────────
    const roofBluePal: Record<string, number> = {
      B: 0x3868a8, b: 0x284880, h: 0x4888c8, s: 0x203868, d: 0x182850, l: 0x58a0d8,
    };
    makePixelTile('tile-roof-blue', [
      'hhBBBBhhBBBBhhBB',
      'BBBBBBBBBBBBbBBB',
      'BBbBBBBBBBBBBBBB',
      'bbssbbssbbssbbss',
      'ssddssddssddssdd',
      'BBhhBBBBhhBBBBhh',
      'BBBBBBbBBBBBBBBB',
      'BBBBBBBBBBbBBBBB',
      'bbssbbssbbssbbss',
      'ssddssddssddssdd',
      'hhBBBBhhBBBBhhBB',
      'BBBBbBBBBBBBBBBB',
      'BBBBBBBBBBBBbBBB',
      'bbssbbssbbssbbss',
      'ssddssddssddssdd',
      'dddddddddddddddd',
    ].map(r => r.slice(0, 16)), roofBluePal);

    // ── Building roof — gray slate (Neon Junction) ───────────────────────────
    const roofGrayPal: Record<string, number> = {
      G: 0x607080, g: 0x506068, h: 0x788898, s: 0x404850, d: 0x303840, v: 0x8898a8,
    };
    makePixelTile('tile-roof-gray', [
      'hhGGGGhhGGGGhhGG',
      'GGGGGGGGGGGGgGGG',
      'GGgGGGGGGGGGGGGG',
      'ggssggssggssggss',
      'ssddssddssddssdd',
      'GGhhGGGGhhGGGGhh',
      'GGGGGGgGGGGGGGGG',
      'GGGGGGGGGGgGGGGG',
      'ggssggssggssggss',
      'ssddssddssddssdd',
      'hhGGGGhhGGGGhhGG',
      'GGGGgGGGGGGGGGGG',
      'GGGGGGGGGGGGgGGG',
      'ggssggssggssggss',
      'ssddssddssddssdd',
      'dddddddddddddddd',
    ].map(r => r.slice(0, 16)), roofGrayPal);

    // ── Door — warm wooden (Echo Village) ────────────────────────────────────
    const doorWoodPal: Record<string, number> = {
      W: 0x9a7050, // surrounding wall
      F: 0x684028, // frame
      D: 0x503018, // door dark
      d: 0x684028, // door mid
      h: 0x785030, // door highlight
      G: 0xffd700, // gold handle
      g: 0xccaa00, // handle shadow
      L: 0xb8d8f0, // window light
      l: 0x88a8c0, // window frame
    };
    makePixelTile('tile-building-door', [
      'WWWWWWWWWWWWWWWw',
      'WWWWWWWWWWWWWWWw',
      'WWWFFFFFFFFFFWWw',
      'WWWF.llll..FDWWw',
      'WWWF.LLLL..FDWWw',
      'WWWF.LLLL..FDWWw',
      'WWWF.llll..FDWWw',
      'WWWFDDDDDDDFDWWw',
      'WWWFDhDDDhDFDWWw',
      'WWWFDDDDDDDFDWWw',
      'WWWFDhDGgDDFDWWw',
      'WWWFDDDgDDDFDWWw',
      'WWWFDhDDDhDFDWWw',
      'WWWFDDDDDDDFDWWw',
      'WWWFDDDDDDDF.WWw',
      'WWWFFFFFFFFFFWWw',
    ].map(r => r.slice(0, 16)), doorWoodPal);

    // ── Door — iron reinforced (Neon Junction) ───────────────────────────────
    const doorIronPal: Record<string, number> = {
      S: 0x808890, // surrounding stone
      F: 0x404850, // frame
      D: 0x585868, // door main
      d: 0x4a4a58, // door shadow
      h: 0x6a6a78, // door highlight
      R: 0x383840, // rivet
      H: 0x888898, // handle
      L: 0xc8d8e8, // window light
      l: 0x606878, // window frame
    };
    makePixelTile('tile-door-iron', [
      'SSSSSSSSSSSSSSSSs',
      'SSSSSSSSSSSSSSSSs',
      'SSSFFFFFFFFFFSSSs',
      'SSSF.llll..FdSSSs',
      'SSSF.LLLL..FdSSSs',
      'SSSF.LLLL..FdSSSs',
      'SSSF.llll..FdSSSs',
      'SSSFDhRDRhDFdSSSs',
      'SSSFDDDDDDDFdSSSs',
      'SSSFDRDDDRDFdSSSs',
      'SSSFDDDHDDDFdSSSs',
      'SSSFDDDHDDDFdSSSs',
      'SSSFDRDDDRDFdSSSs',
      'SSSFDDDDDDDFdSSSs',
      'SSSFDDDDDDDFF.SSs',
      'SSSFFFFFFFFFFSSSs',
    ].map(r => r.slice(0, 16)), doorIronPal);

    // ── Flower — colorful blooms on grass ───────────────────────────────────
    const flowerPal: Record<string, number> = {
      g: 0x68a848, G: 0x78b858, l: 0x88cc68,
      P: 0xff4488, p: 0xdd3070, // pink flower
      Y: 0xffee00, y: 0xddcc00, // yellow flower
      W: 0xffffff, w: 0xeeddee, // white flower
      c: 0xffff88, // center
      s: 0x3a7828, // stem
    };
    makePixelTile('tile-flower', [
      'gGGlgGGlgGGlgGGl',
      'GllGGsPGGllGGllG',
      'GlsGPcPGGlsGGllG',
      'gGsGgPGlgGsGgGGl',
      'gGGlgGGlgGslgGGl',
      'GllGGllGGlYGGllG',
      'GllGGllGYcYGGllG',
      'gGGlgGGlgYGlgGGl',
      'gGGlgGGlgGGlgGGl',
      'GlWGGllGGllGGslG',
      'WcWGGllGGllGsPpG',
      'gWGlgGGlgGGlpcpl',
      'gGGlgGGlgGGlgpGl',
      'GllGGslGGllGGGlG',
      'GllGYcYGGllGGllG',
      'gGGlgYGlgGGlgGGl',
    ].map(r => r.slice(0, 16)), flowerPal);

    // ── Boss arena floor — dark stone with glowing cracks ────────────────────
    makeTile('tile-arena', g => {
      g.fillStyle(0x08080f); g.fillRect(0, 0, 16, 16);
      // Stone checker
      g.fillStyle(0x10101c); g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8);
      g.fillStyle(0x0c0c18); g.fillRect(8, 0, 8, 8); g.fillRect(0, 8, 8, 8);
      // Mortar grid
      g.fillStyle(0x060610); g.fillRect(0, 7, 16, 1); g.fillRect(7, 0, 1, 16);
      // Red cracks with glow
      g.fillStyle(0x4a0808); g.fillRect(3, 7, 10, 1); g.fillRect(7, 3, 1, 10);
      g.fillStyle(0x6a1010); g.fillRect(5, 7, 6, 1); g.fillRect(7, 5, 1, 6);
      g.fillStyle(0x8a1818, 0.5); g.fillRect(7, 7, 1, 1);
      // Subtle highlights
      g.fillStyle(0x181828); g.fillRect(1, 1, 2, 1); g.fillRect(10, 10, 2, 1);
    });

    // ── Sign — detailed wooden signpost ──────────────────────────────────────
    const signPal: Record<string, number> = {
      P: 0x5a3000, p: 0x704018, // post
      B: 0x8b6020, b: 0x7a5018, // board frame
      F: 0xf0d070, f: 0xd8b850, // face
      T: 0x8b6020, // text
    };
    makePixelTile('tile-sign', [
      '..BBBBBBBBBB....',
      '..BFFFFFFFFFB...',
      '..BFTTTTTTTFB...',
      '..BFFFFFFFFfB...',
      '..BFFTTTTFFfB...',
      '..BFFFFFFFFfB...',
      '..BFTTTFFFFB....',
      '..BBBBBBBBBB....',
      '......Pp........',
      '......Pp........',
      '......Pp........',
      '......Pp........',
      '......Pp........',
      '......Pp........',
      '......Pp........',
      '......Pp........',
    ].map(r => r.slice(0, 16)), signPal);

    // Cave floor — dark purplish stone
    if (!scene.textures.exists('tile-cave-floor')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x1e1630);
      g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x2a2040, 0.8);
      g.fillRect(0, 0, 7, 7);
      g.fillRect(9, 9, 7, 7);
      g.fillStyle(0x16101e);
      g.fillRect(0, 8, 6, 1);
      g.fillRect(8, 2, 6, 1);
      g.fillRect(3, 13, 5, 1);
      g.fillRect(11, 5, 4, 1);
      g.fillStyle(0x2e2244, 0.5);
      g.fillRect(0, 0, 16, 1);
      g.fillRect(0, 0, 1, 16);
      g.generateTexture('tile-cave-floor', 16, 16);
      g.destroy();
    }

    // Cave wall — rocky collision tile
    if (!scene.textures.exists('tile-cave-wall')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x2c2240);
      g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x201830);
      g.fillRect(1, 1, 6, 6);
      g.fillRect(9, 9, 6, 6);
      g.fillStyle(0x382a50, 0.6);
      g.fillRect(1, 9, 6, 6);
      g.fillRect(9, 1, 6, 6);
      g.fillStyle(0x120c20);
      g.fillRect(7, 0, 2, 16);
      g.fillRect(0, 7, 16, 2);
      g.fillStyle(0x4a3860, 0.4);
      g.fillRect(0, 0, 16, 1);
      g.fillRect(0, 0, 1, 16);
      g.generateTexture('tile-cave-wall', 16, 16);
      g.destroy();
    }

    // Crystal — glowing teal shard (decorative)
    if (!scene.textures.exists('tile-crystal')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x1e1630);
      g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x004444, 0.35);
      g.fillCircle(8, 8, 7);
      g.fillStyle(0x00ccaa);
      g.fillTriangle(8, 2, 3, 8, 8, 8);
      g.fillTriangle(8, 2, 8, 8, 13, 8);
      g.fillStyle(0x009988);
      g.fillTriangle(3, 8, 8, 14, 8, 8);
      g.fillTriangle(8, 8, 8, 14, 13, 8);
      g.fillStyle(0x80ffee, 0.7);
      g.fillRect(6, 4, 2, 3);
      g.generateTexture('tile-crystal', 16, 16);
      g.destroy();
    }
  }

  // ── Items ─────────────────────────────────────────────────────────────────
  static createItemTextures(scene: Phaser.Scene): void {
    // Sound Fragment — glowing music note
    if (!scene.textures.exists('item-fragment')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x4080ff);
      g.fillRect(6, 2, 4, 1);
      g.fillRect(9, 2, 1, 6);
      g.fillCircle(6, 9, 3);
      g.fillStyle(0x80c0ff);
      g.fillRect(6, 2, 2, 1);
      g.fillCircle(6, 8, 2);
      g.generateTexture('item-fragment', 16, 16);
      g.destroy();
    }

    // Lost Track — glowing cyan crystal
    if (!scene.textures.exists('item-lost-track')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      // Outer glow
      g.fillStyle(0x00ffff, 0.15);
      g.fillCircle(16, 16, 14);
      // Crystal body
      g.fillStyle(0x00ccff);
      g.fillTriangle(16, 4, 8, 18, 24, 18);
      // Inner highlight
      g.fillStyle(0xffffff, 0.8);
      g.fillTriangle(16, 7, 12, 16, 18, 16);
      // Crystal base
      g.fillStyle(0x0088cc);
      g.fillRect(8, 18, 16, 4);
      // Inner glow
      g.fillStyle(0x80ffff, 0.4);
      g.fillTriangle(16, 9, 13, 16, 19, 16);
      // Sparkle dots
      g.fillStyle(0xffffff);
      g.fillRect(4, 6, 2, 2);
      g.fillRect(26, 8, 2, 2);
      g.fillRect(10, 24, 2, 2);
      g.fillRect(22, 26, 2, 2);
      g.generateTexture('item-lost-track', 32, 32);
      g.destroy();
    }

    // Professor NPC sprite — lab coat, glasses, brown hair
    if (!scene.textures.exists('npc-professor')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      // Hair
      g.fillStyle(0x704020);
      g.fillRect(4, 0, 8, 4);
      g.fillRect(2, 2, 2, 4);
      g.fillRect(12, 2, 2, 4);
      // Face
      g.fillStyle(0xffd890);
      g.fillRect(4, 3, 8, 5);
      // Glasses frame
      g.fillStyle(0x303030);
      g.fillRect(4, 5, 3, 2);
      g.fillRect(9, 5, 3, 2);
      g.fillRect(7, 5, 2, 1);  // bridge
      // Glasses lens
      g.fillStyle(0x88ccff);
      g.fillRect(5, 5, 2, 2);
      g.fillRect(9, 5, 2, 2);
      // Eyes behind glasses
      g.fillStyle(0x201008);
      g.fillRect(5, 6, 1, 1);
      g.fillRect(10, 6, 1, 1);
      // Lab coat body
      g.fillStyle(0xf0f0f0);
      g.fillRect(3, 8, 10, 6);
      // Coat lapel detail
      g.fillStyle(0xd0d0d0);
      g.fillRect(6, 8, 2, 3);
      g.fillRect(8, 8, 2, 3);
      // Shirt/tie (small colour accent)
      g.fillStyle(0xcc2200);
      g.fillRect(7, 9, 2, 2);
      // Pants
      g.fillStyle(0x4060c0);
      g.fillRect(4, 13, 3, 3);
      g.fillRect(9, 13, 3, 3);
      // Shoes
      g.fillStyle(0x302010);
      g.fillRect(3, 15, 4, 1);
      g.fillRect(9, 15, 4, 1);
      g.generateTexture('npc-professor', 16, 16);
      g.destroy();
    }

    // Guard NPC — dark cloaked figure for Neon Junction
    if (!scene.textures.exists('npc-guard')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x303040); g.fillRect(3, 0, 10, 4); g.fillRect(2, 2, 2, 4); g.fillRect(12, 2, 2, 4);
      g.fillStyle(0xd0a060); g.fillRect(4, 3, 8, 5);
      g.fillStyle(0x201008); g.fillRect(5, 6, 2, 1); g.fillRect(9, 6, 2, 1);
      g.fillStyle(0x202030); g.fillRect(3, 8, 10, 6);
      g.fillStyle(0x3a3a50); g.fillRect(3, 8, 1, 6); g.fillRect(12, 8, 1, 6);
      g.fillStyle(0x888899); g.fillRect(6, 11, 4, 1);
      g.fillStyle(0x181820); g.fillRect(4, 13, 3, 3); g.fillRect(9, 13, 3, 3);
      g.generateTexture('npc-guard', 16, 16);
      g.destroy();
    }

    // Musician NPC — colourful worn coat figure
    if (!scene.textures.exists('npc-musician')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x804020); g.fillRect(2, 0, 12, 5); g.fillRect(1, 2, 2, 4); g.fillRect(13, 2, 2, 4);
      g.fillStyle(0xffd890); g.fillRect(4, 4, 8, 5);
      g.fillStyle(0x201008); g.fillRect(5, 6, 1, 2); g.fillRect(10, 6, 1, 2);
      g.fillStyle(0x6a3010); g.fillRect(3, 9, 10, 6);
      g.fillStyle(0xcc6020); g.fillRect(7, 9, 2, 5);
      g.fillStyle(0x806040); g.fillRect(3, 10, 1, 4);
      g.fillStyle(0x2a2a2a); g.fillRect(4, 14, 3, 2); g.fillRect(9, 14, 3, 2);
      g.generateTexture('npc-musician', 16, 16);
      g.destroy();
    }
  }

  // ── UI Elements ───────────────────────────────────────────────────────────
  static createUITextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('ui-battle-bg')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x08000f, 0.97);
      g.fillRect(0, 0, 640, 480);
      g.fillStyle(0xffd700);
      g.fillRect(0, 0, 640, 3);
      g.fillRect(0, 477, 640, 3);
      g.generateTexture('ui-battle-bg', 640, 480);
      g.destroy();
    }
    if (!scene.textures.exists('ui-hp-fill')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x40c040);
      g.fillRect(0, 0, 100, 8);
      g.fillStyle(0x60e060);
      g.fillRect(0, 0, 100, 2);
      g.generateTexture('ui-hp-fill', 100, 8);
      g.destroy();
    }
    if (!scene.textures.exists('ui-mp-fill')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x4080ff);
      g.fillRect(0, 0, 100, 8);
      g.fillStyle(0x80b0ff);
      g.fillRect(0, 0, 100, 2);
      g.generateTexture('ui-mp-fill', 100, 8);
      g.destroy();
    }
    if (!scene.textures.exists('ui-attack-btn')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x1a1a3a);
      g.fillRect(0, 0, 140, 36);
      g.fillStyle(0x3a3a6a);
      g.fillRect(0, 0, 140, 3);
      g.fillStyle(0x4040a0);
      g.fillRect(0, 33, 140, 3);
      g.generateTexture('ui-attack-btn', 140, 36);
      g.destroy();
    }
    if (!scene.textures.exists('ui-attack-btn-hover')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x2a2a5a);
      g.fillRect(0, 0, 140, 36);
      g.fillStyle(0xffd700);
      g.fillRect(0, 0, 140, 3);
      g.fillRect(0, 33, 140, 3);
      g.generateTexture('ui-attack-btn-hover', 140, 36);
      g.destroy();
    }
  }

  /** Call once in PreloadScene to generate all textures. */
  static generateAll(scene: Phaser.Scene): void {
    TextureFactory.createTileTextures(scene);
    TextureFactory.createPlayerTextures(scene);
    TextureFactory.createAllEnemyTextures(scene);
    TextureFactory.createBossTextures(scene);
    TextureFactory.createItemTextures(scene);
    TextureFactory.createUITextures(scene);
  }
}
