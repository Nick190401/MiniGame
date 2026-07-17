import Phaser from 'phaser';

type Graphics = Phaser.GameObjects.Graphics;
type Draw = (graphics: Graphics) => void;

/**
 * Cohesive, code-native pixel art for the playable game.
 * Every texture is generated at integer coordinates to stay crisp at any scale.
 */
export class WorldArtFactory {
  private static readonly C = {
    ink: 0x07100c,
    outline: 0x15231c,
    grass: 0x5e7848,
    grassDark: 0x425d3b,
    grassLight: 0x79935a,
    moss: 0x8da662,
    sand: 0xbfa66a,
    sandLight: 0xd2bd80,
    sandDark: 0x927c4e,
    water: 0x347477,
    waterLight: 0x58a09a,
    waterBright: 0x82c5af,
    teal: 0x49dfbf,
    acid: 0xd7ff4a,
    orange: 0xff6b3d,
    paper: 0xeef5e9,
    wood: 0x765039,
    woodLight: 0x9a6a47,
    woodDark: 0x4e3529,
    stone: 0x768178,
    stoneLight: 0x9ba69c,
    stoneDark: 0x4a5650,
    roof: 0xa94f3b,
    roofLight: 0xce6c4d,
    roofDark: 0x713629,
    cave: 0x111b1d,
    caveMid: 0x1b2b2e,
    caveLight: 0x2c4342,
    danger: 0xff5c66,
  } as const;

  private static texture(scene: Phaser.Scene, key: string, width: number, height: number, draw: Draw): void {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(graphics);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  private static fill(graphics: Graphics, color: number, x: number, y: number, width = 1, height = 1, alpha = 1): void {
    graphics.fillStyle(color, alpha);
    graphics.fillRect(x, y, width, height);
  }

  private static tile(scene: Phaser.Scene, key: string, draw: Draw): void {
    WorldArtFactory.texture(scene, key, 16, 16, draw);
  }

  static createTileTextures(scene: Phaser.Scene): void {
    const c = WorldArtFactory.C;
    const f = WorldArtFactory.fill;
    const tile = (key: string, draw: Draw) => WorldArtFactory.tile(scene, key, draw);

    tile('tile-grass', g => {
      f(g, c.grass, 0, 0, 16, 16);
      f(g, c.grassDark, 1, 4, 1, 2); f(g, c.grassLight, 2, 3);
      f(g, c.moss, 10, 2); f(g, c.grassLight, 11, 3); f(g, c.grassDark, 12, 4);
      f(g, c.grassDark, 6, 11, 1, 2); f(g, c.grassLight, 7, 10);
      f(g, c.grassLight, 14, 13); f(g, c.grassDark, 15, 12);
      f(g, 0x6b8650, 4, 7); f(g, 0x526b40, 9, 14);
    });

    tile('tile-grass-2', g => {
      f(g, 0x5b7547, 0, 0, 16, 16);
      f(g, c.grassDark, 0, 8, 16, 1, 0.12);
      f(g, c.grassLight, 3, 2); f(g, c.grassDark, 4, 3, 1, 2);
      f(g, c.moss, 12, 6); f(g, c.grassLight, 13, 5);
      f(g, c.grassDark, 7, 13); f(g, c.grassLight, 8, 12);
      f(g, 0x91a65f, 1, 14); f(g, 0x48603a, 15, 1);
    });

    tile('tile-path', g => {
      f(g, c.sand, 0, 0, 16, 16);
      f(g, c.sandLight, 0, 0, 16, 2, 0.22);
      f(g, c.sandDark, 2, 3); f(g, c.sandLight, 9, 2, 2, 1);
      f(g, 0xa58e59, 13, 7); f(g, c.sandLight, 4, 11);
      f(g, c.sandDark, 7, 14, 2, 1); f(g, 0xd9c88d, 15, 12);
    });

    tile('tile-path-2', g => {
      f(g, 0x758075, 0, 0, 16, 16);
      f(g, c.stoneDark, 0, 7, 16); f(g, c.stoneDark, 7, 0, 1, 8);
      f(g, c.stoneDark, 4, 8, 1, 8); f(g, c.stoneLight, 1, 1, 5, 1, 0.55);
      f(g, c.stoneLight, 9, 9, 5, 1, 0.48); f(g, c.teal, 14, 3, 1, 1, 0.38);
    });

    tile('tile-water', g => {
      f(g, c.water, 0, 0, 16, 16);
      f(g, 0x2d666c, 0, 5, 16, 3);
      f(g, c.waterLight, 0, 2, 6); f(g, c.waterLight, 9, 2, 5);
      f(g, c.waterBright, 4, 8, 7); f(g, c.waterLight, 0, 13, 4); f(g, c.waterLight, 11, 13, 5);
      f(g, c.paper, 7, 3, 2, 1, 0.32); f(g, c.teal, 12, 9, 2, 1, 0.38);
    });

    tile('tile-wall', g => {
      f(g, c.grassDark, 0, 0, 16, 3); f(g, c.grassLight, 0, 0, 16, 1);
      f(g, 0x526052, 0, 3, 16, 13);
      f(g, c.stoneDark, 0, 8, 16, 1); f(g, c.stoneDark, 7, 3, 1, 5); f(g, c.stoneDark, 4, 9, 1, 7);
      f(g, 0x6d786c, 1, 4, 5, 1); f(g, c.stoneLight, 9, 10, 5, 1, 0.48);
      f(g, c.outline, 0, 15, 16, 1, 0.42);
    });

    const drawTreeTop = (g: Graphics, variant: boolean) => {
      const base = variant ? 0x36533a : 0x3f6040;
      f(g, c.outline, 2, 3, 12, 12);
      f(g, base, 1, 5, 14, 8); f(g, base, 3, 2, 10, 13);
      f(g, variant ? 0x5d7c49 : 0x668651, 4, 3, 6, 4);
      f(g, c.grassLight, 5, 3, 3, 2, 0.74);
      f(g, 0x294231, 3, 10, 10, 4); f(g, c.moss, 11, 7, 2, 2, 0.55);
      f(g, c.outline, 5, 15, 6, 1, 0.72);
    };
    tile('tile-tree-top', g => drawTreeTop(g, false));
    tile('tile-tree-top-2', g => drawTreeTop(g, true));

    const drawTrunk = (g: Graphics, variant: boolean) => {
      f(g, c.woodDark, 5, 0, 6, 16); f(g, variant ? 0x765744 : c.wood, 6, 0, 4, 15);
      f(g, c.woodLight, 7, 1, 1, 10, 0.6); f(g, c.woodDark, 2, 14, 12, 2);
      f(g, c.grassDark, 1, 15, 14); f(g, c.moss, variant ? 10 : 4, 12, 2, 2, 0.55);
    };
    tile('tile-tree-trunk', g => drawTrunk(g, false));
    tile('tile-tree-trunk-2', g => drawTrunk(g, true));

    // Dense, readable grass clumps inspired by classic monster-RPG routes.
    // Uneven blade heights and overlapping tufts avoid the old fence-like stripes.
    const drawGrassTuft = (
      g: Graphics,
      x: number,
      y: number,
      palette: { deep: number; mid: number; light: number; tip: number },
    ) => {
      f(g, palette.deep, x, y + 7, 2, 7);
      f(g, palette.mid, x + 1, y + 5, 2, 9);
      f(g, palette.light, x + 2, y + 3, 1, 11);
      f(g, palette.tip, x + 2, y + 2, 1, 2);
      f(g, palette.mid, x + 3, y + 4, 1, 10);
      f(g, palette.deep, x + 4, y + 6, 1, 8);
      f(g, palette.mid, x + 5, y + 8, 1, 6);
      f(g, palette.light, x + 4, y + 5, 1, 2, 0.72);
      // Small stepped leaves create the familiar pointed silhouette.
      f(g, palette.mid, x - 1, y + 8, 1, 2);
      f(g, palette.mid, x, y + 7, 1, 2);
      f(g, palette.deep, x + 5, y + 7, 1, 2);
      f(g, palette.deep, x + 6, y + 8, 1, 2);
    };

    const tallGrassPalette = { deep: 0x29472f, mid: 0x4f713e, light: 0x769653, tip: 0x9ab568 };
    const tallGrassAltPalette = { deep: 0x304b32, mid: 0x587844, light: 0x829d58, tip: 0xa3b96c };

    const drawTallGrassBase = (g: Graphics, alt: boolean) => {
      const palette = alt ? tallGrassAltPalette : tallGrassPalette;
      f(g, palette.deep, 0, 11, 16, 5, 0.78);
      f(g, c.outline, 0, 15, 16, 1, 0.24);
      drawGrassTuft(g, -2, alt ? 3 : 2, palette);
      drawGrassTuft(g, 4, alt ? 1 : 3, palette);
      drawGrassTuft(g, 10, alt ? 4 : 2, palette);
      f(g, palette.tip, alt ? 1 : 8, 13, 2, 1, 0.7);
      f(g, palette.light, alt ? 12 : 5, 15, 3, 1, 0.55);
    };

    const drawTallGrassFront = (g: Graphics, alt: boolean) => {
      const palette = alt ? tallGrassAltPalette : tallGrassPalette;
      drawGrassTuft(g, -2, alt ? 3 : 1, palette);
      drawGrassTuft(g, 5, alt ? 2 : 4, palette);
      drawGrassTuft(g, 11, alt ? 4 : 2, palette);
      f(g, palette.deep, 0, 14, 16, 2, 0.34);
    };

    tile('tile-tall-grass', g => drawTallGrassBase(g, false));
    tile('tile-tall-grass-2', g => drawTallGrassBase(g, true));
    tile('tile-tall-grass-top', g => drawTallGrassFront(g, false));
    tile('tile-tall-grass-top-2', g => drawTallGrassFront(g, true));

    const flower = (g: Graphics, alt: boolean) => {
      f(g, c.grass, 0, 0, 16, 16);
      f(g, c.grassDark, 7, 7, 2, 8); f(g, c.grassLight, 5, 11, 3, 1); f(g, c.grassLight, 9, 10, 3, 1);
      const petal = alt ? c.teal : c.orange;
      f(g, petal, 6, 4, 2, 2); f(g, petal, 9, 4, 2, 2); f(g, petal, 7, 2, 3, 2); f(g, petal, 7, 6, 3, 2);
      f(g, c.acid, 8, 4, 2, 2);
    };
    tile('tile-flower', g => flower(g, false));
    tile('tile-flower-2', g => flower(g, true));

    const plasterWall = (g: Graphics, window: boolean) => {
      f(g, 0xd8cfb1, 0, 0, 16, 16); f(g, 0xeee4c5, 1, 1, 14, 3);
      f(g, c.woodDark, 0, 0, 2, 16); f(g, c.wood, 14, 0, 2, 16); f(g, c.wood, 0, 13, 16, 3);
      f(g, c.sandDark, 4, 7); f(g, c.sandDark, 12, 4); f(g, 0xbbaa87, 7, 11);
      if (window) {
        f(g, c.outline, 4, 4, 8, 7); f(g, c.water, 5, 5, 6, 5);
        f(g, c.waterBright, 6, 5, 4, 1); f(g, c.paper, 6, 6, 2, 1, 0.55);
        f(g, c.woodLight, 7, 5, 1, 5); f(g, c.woodLight, 5, 8, 6, 1);
      }
    };
    tile('tile-building-wall', g => plasterWall(g, false));
    tile('tile-bldg-wall-win', g => plasterWall(g, true));

    const stoneWall = (g: Graphics, window: boolean) => {
      f(g, c.stone, 0, 0, 16, 16); f(g, c.stoneDark, 0, 7, 16, 1); f(g, c.stoneDark, 7, 0, 1, 8);
      f(g, c.stoneDark, 4, 8, 1, 8); f(g, c.stoneLight, 1, 1, 5, 1, 0.6); f(g, c.stoneLight, 9, 9, 5, 1, 0.55);
      if (window) {
        f(g, c.outline, 4, 3, 8, 9); f(g, 0x24484b, 5, 4, 6, 7);
        f(g, c.teal, 6, 4, 4, 1, 0.5); f(g, c.acid, 6, 6, 1, 1, 0.7);
      }
    };
    tile('tile-bldg-stone', g => stoneWall(g, false));
    tile('tile-bldg-stone-win', g => stoneWall(g, true));

    const roof = (g: Graphics, base: number, light: number, dark: number) => {
      f(g, dark, 0, 0, 16, 16);
      for (let y = 0; y < 16; y += 4) {
        f(g, base, 0, y, 16, 3); f(g, light, 0, y, 16, 1, 0.72);
        for (let x = (y / 4) % 2 === 0 ? 0 : 4; x < 16; x += 8) f(g, dark, x, y + 2, 1, 2);
      }
    };
    tile('tile-building-roof', g => roof(g, c.roof, c.roofLight, c.roofDark));
    tile('tile-roof-blue', g => roof(g, 0x426b71, 0x669293, 0x29484e));
    tile('tile-roof-gray', g => roof(g, 0x5c665f, 0x818c82, 0x3c4741));

    tile('tile-building-door', g => {
      plasterWall(g, false); f(g, c.outline, 3, 2, 10, 14); f(g, c.wood, 4, 3, 8, 13);
      f(g, c.woodLight, 5, 4, 1, 10); f(g, c.woodDark, 9, 3, 1, 13); f(g, c.acid, 9, 9);
    });
    tile('tile-door-iron', g => {
      stoneWall(g, false); f(g, c.outline, 3, 1, 10, 15); f(g, 0x394844, 4, 2, 8, 14);
      f(g, c.stoneLight, 5, 3, 1, 11, 0.55); f(g, c.teal, 9, 8, 2, 1);
    });

    tile('tile-sign', g => {
      f(g, c.woodDark, 7, 8, 2, 8); f(g, c.outline, 2, 2, 12, 9);
      f(g, c.wood, 3, 3, 10, 7); f(g, c.woodLight, 4, 4, 8, 1);
      f(g, c.acid, 5, 6, 6, 1); f(g, c.orange, 10, 5, 1, 3);
    });

    tile('tile-barrel', g => {
      f(g, c.outline, 3, 1, 10, 15); f(g, c.wood, 4, 1, 8, 15); f(g, c.woodLight, 5, 2, 2, 12, 0.55);
      f(g, c.stoneDark, 3, 4, 10, 2); f(g, c.stoneDark, 3, 11, 10, 2);
    });

    tile('tile-chest', g => {
      f(g, c.outline, 1, 5, 14, 10); f(g, c.wood, 2, 6, 12, 8); f(g, c.woodLight, 3, 6, 10, 2);
      f(g, c.stoneDark, 1, 9, 14, 2); f(g, c.acid, 7, 9, 2, 3);
    });

    tile('tile-roof-peak-l', g => { f(g, c.roofDark, 0, 15, 16); for (let i = 0; i < 16; i++) f(g, i % 3 ? c.roof : c.roofLight, i, 15 - i, 1, i + 1); });
    tile('tile-roof-peak-r', g => { f(g, c.roofDark, 0, 15, 16); for (let i = 0; i < 16; i++) f(g, i % 3 ? c.roof : c.roofLight, i, i, 1, 16 - i); });
    tile('tile-rroof-peak-l', g => { f(g, 0x29484e, 0, 15, 16); for (let i = 0; i < 16; i++) f(g, i % 3 ? 0x426b71 : 0x669293, i, 15 - i, 1, i + 1); });
    tile('tile-rroof-peak-r', g => { f(g, 0x29484e, 0, 15, 16); for (let i = 0; i < 16; i++) f(g, i % 3 ? 0x426b71 : 0x669293, i, i, 1, 16 - i); });
    tile('tile-wood-bottom', g => { f(g, c.woodDark, 0, 0, 16, 16); f(g, c.wood, 0, 0, 16, 12); f(g, c.woodLight, 0, 1, 16); f(g, c.outline, 0, 12, 16, 4); });
    tile('tile-stone-bottom', g => { stoneWall(g, false); f(g, c.outline, 0, 13, 16, 3); });

    tile('tile-arena', g => {
      f(g, 0x101816, 0, 0, 16, 16); f(g, 0x192622, 1, 1, 14, 14);
      f(g, 0x27362f, 0, 7, 16); f(g, 0x27362f, 7, 0, 1, 16);
      f(g, c.orange, 7, 7, 2, 2, 0.55); f(g, c.acid, 1, 1, 1, 1, 0.35);
    });

    tile('tile-arena-purified', g => {
      f(g, 0x234137, 0, 0, 16, 16); f(g, 0x315648, 1, 1, 14, 14);
      f(g, 0x47725e, 0, 7, 16, 1, 0.72); f(g, 0x47725e, 7, 0, 1, 16, 0.72);
      f(g, c.teal, 7, 7, 2, 2, 0.72); f(g, c.acid, 1, 1, 1, 1, 0.66);
      f(g, 0x88b983, 12, 12, 2, 1, 0.58);
    });

    // Palette/editor preview; the playable world uses the coherent multi-tile
    // frame and sliding panels below instead of repeating this tile eight times.
    tile('tile-gate', g => {
      f(g, c.outline, 0, 0, 16, 16);
      f(g, 0x26362f, 2, 1, 12, 15);
      f(g, c.stoneDark, 4, 1, 2, 15); f(g, c.stoneDark, 10, 1, 2, 15);
      f(g, c.stoneLight, 5, 2, 1, 12, 0.42); f(g, c.teal, 11, 3, 1, 10, 0.34);
      f(g, 0x354a40, 1, 5, 14, 2); f(g, 0x354a40, 1, 12, 14, 2);
      f(g, c.orange, 7, 7, 2, 4); f(g, c.acid, 8, 8, 1, 2, 0.82);
    });

    const drawGatePanel = (g: Graphics, mirrored: boolean) => {
      const px = (x: number, width = 1) => mirrored ? 32 - x - width : x;
      const panelFill = (color: number, x: number, y: number, width = 1, height = 1, alpha = 1) =>
        f(g, color, px(x, width), y, width, height, alpha);

      f(g, c.outline, 0, 0, 32, 32);
      f(g, 0x1c2c26, 2, 1, 30, 31);
      f(g, 0x293d34, 4, 2, 26, 28);
      panelFill(c.stoneDark, 4, 1, 3, 30);
      panelFill(c.stoneLight, 5, 2, 1, 27, 0.45);
      panelFill(c.stoneDark, 14, 1, 2, 30);
      panelFill(c.teal, 15, 3, 1, 25, 0.25);
      panelFill(0x17231f, 24, 1, 4, 30);
      panelFill(0x40564b, 2, 6, 28, 3);
      panelFill(0x40564b, 2, 23, 28, 3);
      panelFill(c.stoneLight, 3, 6, 26, 1, 0.38);
      panelFill(c.teal, 8, 12, 11, 1, 0.28);
      panelFill(c.teal, 10, 18, 10, 1, 0.2);
      // A restrained lock seam replaces the repeated neon cross pattern.
      panelFill(c.orange, 27, 12, 3, 8, 0.9);
      panelFill(c.acid, 28, 14, 2, 3, 0.78);
      panelFill(c.outline, 29, 15, 1, 1);
    };

    WorldArtFactory.texture(scene, 'gate-panel-left', 32, 32, g => drawGatePanel(g, false));
    WorldArtFactory.texture(scene, 'gate-panel-right', 32, 32, g => drawGatePanel(g, true));

    WorldArtFactory.texture(scene, 'gate-frame', 80, 48, g => {
      // Recessed shadow gives the opening physical depth without becoming a black box.
      f(g, 0x050908, 0, 3, 80, 10, 0.45);
      f(g, c.outline, 0, 0, 80, 12);
      f(g, c.stoneDark, 2, 1, 76, 9);
      f(g, c.stone, 3, 2, 74, 6);
      f(g, c.stoneLight, 4, 2, 72, 1, 0.62);
      f(g, 0x35473e, 11, 3, 14, 5); f(g, 0x35473e, 55, 3, 14, 5);
      f(g, c.outline, 0, 8, 10, 40); f(g, c.outline, 70, 8, 10, 40);
      f(g, c.stoneDark, 2, 9, 7, 37); f(g, c.stoneDark, 71, 9, 7, 37);
      f(g, c.stone, 3, 10, 5, 34); f(g, c.stone, 72, 10, 5, 34);
      f(g, c.stoneLight, 3, 10, 1, 31, 0.58); f(g, c.stoneLight, 72, 10, 1, 31, 0.42);
      f(g, c.teal, 8, 13, 1, 26, 0.35); f(g, c.teal, 71, 13, 1, 26, 0.35);
      f(g, c.outline, 0, 43, 13, 5); f(g, c.outline, 67, 43, 13, 5);
      f(g, c.stone, 2, 42, 10, 4); f(g, c.stone, 68, 42, 10, 4);
      // Small frequency indicator: visible, but no longer frames the whole gate in neon.
      f(g, 0x1a2822, 31, 1, 18, 8);
      f(g, c.teal, 34, 4, 5, 1, 0.68); f(g, c.teal, 41, 4, 5, 1, 0.68);
      f(g, c.acid, 39, 3, 2, 3, 0.9);
    });

    tile('tile-cave-floor', g => {
      f(g, c.cave, 0, 0, 16, 16); f(g, c.caveMid, 1, 2, 5, 2); f(g, c.caveLight, 10, 3, 3, 1);
      f(g, 0x0a1113, 5, 9, 8, 3); f(g, c.teal, 2, 13, 1, 1, 0.35); f(g, c.orange, 14, 11, 1, 1, 0.26);
    });

    tile('tile-cave-floor-purified', g => {
      f(g, 0x244238, 0, 0, 16, 16); f(g, 0x315548, 1, 2, 6, 2); f(g, 0x4d7562, 10, 3, 3, 1);
      f(g, 0x1c352d, 5, 9, 8, 3); f(g, c.teal, 2, 13, 1, 1, 0.72); f(g, c.acid, 14, 11, 1, 1, 0.56);
      f(g, 0x6f996b, 8, 6, 2, 1, 0.55); f(g, 0x9fc47d, 9, 5, 1, 1, 0.6);
    });

    tile('tile-cave-wall', g => {
      f(g, 0x0b1113, 0, 0, 16, 16); f(g, c.caveMid, 1, 1, 14, 15);
      f(g, c.caveLight, 2, 2, 4, 2); f(g, 0x0c1416, 8, 0, 2, 9); f(g, 0x0c1416, 0, 10, 16, 2);
      f(g, 0x314c49, 10, 12, 4, 1); f(g, c.outline, 0, 15, 16);
    });

    tile('tile-cave-wall-purified', g => {
      f(g, 0x172b25, 0, 0, 16, 16); f(g, 0x365449, 1, 1, 14, 15);
      f(g, 0x587564, 2, 2, 4, 2); f(g, 0x223c33, 8, 0, 2, 9); f(g, 0x223c33, 0, 10, 16, 2);
      f(g, 0x6e8d6b, 10, 12, 4, 1); f(g, 0x1a3028, 0, 15, 16);
      f(g, 0x7ca268, 1, 5, 3, 1, 0.7); f(g, c.teal, 13, 3, 1, 2, 0.48);
    });

    tile('tile-crystal', g => {
      f(g, c.teal, 7, 2, 3, 13, 0.82); f(g, 0x257b72, 4, 7, 3, 8); f(g, c.acid, 10, 6, 3, 9, 0.82);
      f(g, c.paper, 8, 3, 1, 7, 0.7); f(g, c.outline, 4, 15, 9, 1);
    });

    tile('tile-crystal-purified', g => {
      f(g, 0x75dfba, 7, 2, 3, 13, 0.92); f(g, 0x4eaa88, 4, 7, 3, 8); f(g, 0xd7ff4a, 10, 6, 3, 9, 0.92);
      f(g, 0xf4fff0, 8, 3, 1, 7, 0.9); f(g, 0x1b3c31, 4, 15, 9, 1);
    });

    tile('tile-pillar', g => {
      f(g, c.outline, 2, 0, 12, 16); f(g, c.caveLight, 3, 0, 10, 16); f(g, 0x49605c, 5, 1, 2, 13, 0.48);
      f(g, c.teal, 3, 4, 10, 1, 0.36); f(g, c.acid, 8, 8, 1, 2, 0.45);
    });

    tile('tile-pillar-purified', g => {
      f(g, 0x183229, 2, 0, 12, 16); f(g, 0x557467, 3, 0, 10, 16); f(g, 0x81a27e, 5, 1, 2, 13, 0.54);
      f(g, c.teal, 3, 4, 10, 1, 0.72); f(g, c.acid, 8, 8, 1, 2, 0.86);
    });

    tile('tile-wall-rune', g => {
      f(g, c.caveMid, 0, 0, 16, 16); f(g, c.caveLight, 1, 1, 14, 14, 0.45);
      f(g, c.orange, 7, 2, 2, 12); f(g, c.orange, 3, 7, 10, 2); f(g, c.danger, 5, 5, 6, 6, 0.3);
    });

    tile('tile-wall-rune-purified', g => {
      f(g, 0x2d4d41, 0, 0, 16, 16); f(g, 0x557466, 1, 1, 14, 14, 0.55);
      f(g, c.teal, 2, 8, 2, 2); f(g, c.teal, 5, 6, 2, 5); f(g, c.acid, 8, 4, 2, 8); f(g, c.teal, 11, 7, 2, 4);
      f(g, c.paper, 8, 5, 1, 1, 0.82);
    });

    tile('tile-void-fissure', g => {
      f(g, 0x020505, 7, 0, 3, 5, 0.92); f(g, 0x020505, 5, 4, 4, 4, 0.96);
      f(g, 0x020505, 3, 7, 4, 4, 0.92); f(g, 0x020505, 1, 10, 4, 6, 0.88);
      f(g, 0xff5c66, 8, 1, 1, 4, 0.72); f(g, 0xff6b3d, 6, 5, 1, 3, 0.68);
      f(g, 0x49dfbf, 4, 8, 1, 3, 0.4); f(g, 0xff5c66, 2, 12, 1, 4, 0.64);
    });

    tile('tile-skull', g => {
      f(g, c.stoneLight, 4, 4, 8, 7); f(g, c.paper, 5, 3, 6, 7, 0.6); f(g, c.outline, 5, 6, 2, 2); f(g, c.outline, 9, 6, 2, 2);
      f(g, c.stoneDark, 6, 10, 4, 3); f(g, c.outline, 7, 10, 1, 3);
    });

    tile('tile-stalactite', g => {
      f(g, c.caveLight, 3, 0, 10, 3); f(g, c.stone, 5, 2, 6, 5); f(g, c.stoneDark, 7, 6, 3, 7); f(g, c.teal, 8, 4, 1, 5, 0.4);
    });
  }

  static createCharacterTextures(scene: Phaser.Scene): void {
    const c = WorldArtFactory.C;
    const f = WorldArtFactory.fill;

    const drawPlayer = (g: Graphics, direction: 'down' | 'up' | 'right', frame: number) => {
      const bob = frame % 2 === 1 ? 1 : 0;
      const stride = frame === 1 ? -1 : frame === 3 ? 1 : 0;
      // Miniature translation of player_model.PNG: MR cap, yellow hoodie,
      // black puffer vest, green cargo trousers and white trainers.
      const skin = 0xd98e5a;
      const skinLight = 0xf4bd83;
      const hair = 0x4a2618;
      const cap = 0x171a25;
      const capLight = 0x303442;
      const vest = 0x171b24;
      const vestLight = 0x30343e;
      const hoodie = 0xf2e66e;
      const hoodieShade = 0xbeb552;
      const green = 0x42ad4f;
      const greenLight = 0x61cd62;
      const greenDark = 0x24793d;

      if (direction === 'right') {
        f(g, c.outline, 12, 23 + bob, 5, 7); f(g, c.outline, 17 + stride, 23 + bob, 6, 7);
        f(g, greenDark, 13, 23 + bob, 4, 6); f(g, green, 18 + stride, 23 + bob, 4, 6);
        f(g, greenLight, 19 + stride, 24 + bob, 2, 2); f(g, c.outline, 20 + stride, 26 + bob, 3, 2);
        f(g, c.paper, 11, 29 + bob, 7, 2); f(g, c.paper, 18 + stride, 29 + bob, 7, 2);
        f(g, c.outline, 9, 14 + bob, 15, 11); f(g, vest, 11, 14 + bob, 10, 10);
        f(g, vestLight, 12, 17 + bob, 8, 1); f(g, vestLight, 12, 21 + bob, 8, 1);
        f(g, hoodie, 9, 15 + bob, 3, 8); f(g, green, 20, 15 + bob, 4, 8); f(g, greenLight, 21, 16 + bob, 2, 3);
        f(g, skin, 20, 8 + bob, 7, 7); f(g, skinLight, 22, 9 + bob, 5, 5);
        f(g, hair, 18, 6 + bob, 4, 7); f(g, hair, 23, 7 + bob, 4, 3);
        f(g, c.outline, 17, 3 + bob, 11, 6); f(g, cap, 18, 3 + bob, 10, 5); f(g, capLight, 21, 4 + bob, 6, 1);
        f(g, c.outline, 15, 7 + bob, 8, 2); f(g, cap, 16, 7 + bob, 8, 1);
        f(g, c.outline, 25, 10 + bob, 2, 2); f(g, greenLight, 25, 10 + bob, 1, 1);
      } else {
        f(g, c.outline, 9 + stride, 23 + bob, 6, 8); f(g, c.outline, 17 - stride, 23 + bob, 6, 8);
        f(g, greenDark, 10 + stride, 23 + bob, 5, 6); f(g, green, 17 - stride, 23 + bob, 5, 6);
        f(g, greenLight, 11 + stride, 24 + bob, 2, 2); f(g, c.outline, 19 - stride, 25 + bob, 3, 2);
        f(g, c.paper, 8 + stride, 29 + bob, 8, 2); f(g, c.paper, 16 - stride, 29 + bob, 8, 2);
        f(g, c.outline, 8, 14 + bob, 16, 11); f(g, hoodie, 9, 14 + bob, 14, 10);
        f(g, hoodie, 9, 15 + bob, 3, 8); f(g, green, 20, 15 + bob, 3, 8);
        f(g, vest, 12, 14 + bob, 8, 10); f(g, vestLight, 13, 17 + bob, 6, 1); f(g, vestLight, 13, 21 + bob, 6, 1);
        f(g, hoodieShade, 14, 14 + bob, 4, 2); f(g, c.acid, 17, 18 + bob, 1, 3);
        if (direction === 'down') {
          f(g, skin, 10, 7 + bob, 12, 8); f(g, skinLight, 12, 8 + bob, 8, 5);
          f(g, hair, 9, 7 + bob, 3, 6); f(g, hair, 20, 7 + bob, 3, 6);
          f(g, c.outline, 8, 3 + bob, 16, 7); f(g, cap, 9, 3 + bob, 14, 6); f(g, capLight, 11, 4 + bob, 10, 1);
          f(g, c.outline, 6, 8 + bob, 15, 2); f(g, cap, 7, 8 + bob, 14, 1);
          // Readable two-pixel "MR" cap signature at overworld scale.
          f(g, c.paper, 13, 5 + bob, 1, 2); f(g, c.paper, 15, 5 + bob, 1, 2); f(g, c.paper, 17, 5 + bob, 2, 1); f(g, c.paper, 17, 6 + bob, 1, 1);
          f(g, c.outline, 13, 11 + bob, 2, 2); f(g, c.outline, 18, 11 + bob, 2, 2);
          f(g, greenLight, 14, 11 + bob, 1, 1); f(g, greenLight, 19, 11 + bob, 1, 1);
          f(g, hair, 11, 9 + bob, 2, 2); f(g, hair, 20, 9 + bob, 2, 2);
          f(g, 0x9d4e35, 15, 14 + bob, 3, 1);
        } else {
          f(g, hair, 9, 7 + bob, 14, 7);
          f(g, c.outline, 8, 3 + bob, 16, 7); f(g, cap, 9, 3 + bob, 14, 6); f(g, capLight, 11, 4 + bob, 10, 1);
          f(g, hoodie, 10, 12 + bob, 12, 5); f(g, hoodieShade, 13, 13 + bob, 6, 2);
        }
      }
    };

    // TextureFactory supplies the detailed, contoured overworld sprite. This
    // block remains as a fallback for isolated scene previews only.
    if (!scene.textures.exists('player-idle')) {
      const directions: Array<'down' | 'up' | 'right'> = ['down', 'up', 'right'];
      directions.forEach(direction => {
        for (let frame = 0; frame < 4; frame++) {
          WorldArtFactory.texture(scene, `player-${direction}-${frame}`, 32, 32, g => drawPlayer(g, direction, frame));
        }
      });
      WorldArtFactory.texture(scene, 'player-idle', 32, 32, g => drawPlayer(g, 'down', 0));
    }

    // The supplied portrait is loaded under this key in production. Keep a
    // matching fallback for development contexts where public assets are absent.
    if (!scene.textures.exists('player-battle')) WorldArtFactory.texture(scene, 'player-battle', 48, 56, g => {
      f(g, c.outline, 8, 40, 13, 12); f(g, c.outline, 25, 39, 14, 13);
      f(g, 0x24793d, 10, 40, 10, 10); f(g, 0x42ad4f, 27, 39, 10, 11);
      f(g, c.paper, 6, 50, 16, 4); f(g, c.paper, 26, 50, 16, 4);
      f(g, c.outline, 6, 23, 34, 20); f(g, 0x171b24, 8, 23, 30, 18);
      f(g, 0xf2e66e, 8, 25, 7, 15); f(g, 0x42ad4f, 33, 25, 6, 15); f(g, 0x30343e, 17, 28, 14, 2);
      f(g, 0xf4bd83, 12, 9, 22, 16); f(g, 0x4a2618, 10, 9, 5, 12); f(g, 0x4a2618, 31, 9, 5, 10);
      f(g, c.outline, 9, 3, 28, 11); f(g, 0x171a25, 11, 3, 25, 9); f(g, 0x303442, 16, 4, 16, 2);
      f(g, c.outline, 6, 11, 20, 3); f(g, 0x171a25, 8, 11, 19, 2);
      f(g, c.paper, 19, 6, 3, 4); f(g, c.paper, 24, 6, 4, 2); f(g, c.paper, 24, 8, 2, 2);
      f(g, 0x61cd62, 17, 16, 3, 2); f(g, 0x61cd62, 28, 16, 3, 2);
    });

    const npc = (key: string, coat: number, accent: number, hair: number, extra: Draw) => {
      WorldArtFactory.texture(scene, key, 16, 22, g => {
        f(g, c.outline, 5, 17, 3, 5); f(g, c.outline, 9, 17, 3, 5); f(g, c.paper, 4, 20, 4, 2); f(g, c.paper, 9, 20, 4, 2);
        f(g, c.outline, 3, 9, 10, 10); f(g, coat, 4, 10, 8, 9); f(g, accent, 5, 11, 2, 7);
        f(g, 0xd7a97a, 5, 3, 6, 7); f(g, hair, 4, 1, 8, 4); f(g, c.outline, 6, 6, 1, 1); f(g, c.outline, 9, 6, 1, 1);
        extra(g);
      });
    };
    npc('npc-professor', 0x315d58, c.teal, 0xd0d6cc, g => { f(g, c.paper, 2, 9, 3, 9); f(g, c.paper, 11, 9, 3, 9); f(g, c.orange, 7, 13, 2, 2); });
    npc('npc-guard', 0x26372f, c.acid, 0x18211b, g => { f(g, c.outline, 3, 0, 10, 4); f(g, c.acid, 5, 1, 6, 1); f(g, c.orange, 11, 12, 2, 5); });
    npc('npc-musician', 0x7f4636, c.orange, 0x2b1e18, g => { f(g, c.wood, 11, 11, 4, 8); f(g, c.acid, 12, 12, 2, 2); f(g, c.teal, 2, 13, 2, 4); });
  }

  static createEnemyTextures(scene: Phaser.Scene): void {
    const c = WorldArtFactory.C;
    const f = WorldArtFactory.fill;

    WorldArtFactory.texture(scene, 'enemy-static-noise', 28, 28, g => {
      f(g, c.teal, 6, 8, 16, 13, 0.28); f(g, c.outline, 5, 9, 18, 12);
      f(g, 0x276a64, 7, 10, 14, 10); f(g, c.teal, 8, 10, 12, 3); f(g, c.paper, 9, 14, 4, 3); f(g, c.paper, 16, 14, 4, 3);
      f(g, c.outline, 10, 15, 2, 2); f(g, c.outline, 17, 15, 2, 2); f(g, c.acid, 12, 5, 5, 4);
      f(g, c.acid, 4, 3, 2, 7); f(g, c.orange, 22, 4, 2, 7); f(g, c.teal, 8, 22, 2, 4); f(g, c.teal, 14, 22, 2, 5); f(g, c.teal, 20, 22, 2, 4);
      f(g, c.acid, 2, 12, 3, 2); f(g, c.orange, 23, 16, 3, 2);
    });

    WorldArtFactory.texture(scene, 'enemy-broken-signal', 28, 28, g => {
      f(g, c.orange, 4, 5, 20, 19, 0.22); f(g, c.outline, 3, 6, 22, 18);
      f(g, 0x7c332c, 5, 8, 18, 14); f(g, c.danger, 5, 8, 18, 4); f(g, c.outline, 4, 13, 20, 3); f(g, c.orange, 6, 14, 16, 2);
      f(g, c.acid, 7, 10, 5, 2); f(g, c.acid, 17, 10, 4, 2); f(g, c.outline, 9, 10, 1, 2); f(g, c.outline, 18, 10, 1, 2);
      f(g, c.orange, 8, 18, 12, 2); f(g, c.danger, 0, 9, 5, 2); f(g, c.teal, 22, 17, 6, 2); f(g, c.danger, 2, 22, 8, 2);
      f(g, c.outline, 6, 22, 5, 5); f(g, c.outline, 18, 22, 5, 5);
    });

    WorldArtFactory.texture(scene, 'enemy-silence', 28, 32, g => {
      f(g, c.teal, 3, 4, 22, 25, 0.1); f(g, c.outline, 6, 5, 16, 24); f(g, 0x10171a, 8, 3, 12, 27);
      f(g, 0x1e3031, 6, 10, 4, 16); f(g, 0x1e3031, 20, 10, 4, 16); f(g, 0x08100f, 9, 7, 10, 10);
      f(g, c.teal, 10, 10, 3, 2); f(g, c.teal, 16, 10, 3, 2); f(g, c.paper, 11, 10, 1, 1); f(g, c.paper, 17, 10, 1, 1);
      f(g, c.danger, 13, 18, 3, 2); f(g, c.teal, 3, 19, 3, 7, 0.55); f(g, c.danger, 23, 16, 3, 8, 0.48);
      f(g, c.outline, 5, 28, 5, 4); f(g, c.outline, 12, 27, 5, 5); f(g, c.outline, 20, 28, 5, 4);
    });
  }

  static createBossTextures(scene: Phaser.Scene): void {
    const c = WorldArtFactory.C;
    const f = WorldArtFactory.fill;
    const drawBoss = (g: Graphics, phase: number) => {
      const edge = [c.teal, c.orange, c.danger][phase];
      const core = [c.acid, c.orange, 0xffd3a1][phase];
      f(g, edge, 2, 7, 28, 29, 0.12 + phase * 0.04);
      f(g, c.outline, 4, 9, 24, 29); f(g, phase === 0 ? 0x13231e : phase === 1 ? 0x2a2019 : 0x35181a, 6, 10, 20, 27);
      f(g, c.outline, 8, 2, 16, 17); f(g, 0x050908, 10, 5, 12, 10);
      f(g, edge, 10, 9, 4 + phase, 2 + (phase > 1 ? 1 : 0)); f(g, edge, 18 - phase, 9, 4 + phase, 2 + (phase > 1 ? 1 : 0));
      f(g, c.paper, 11, 9, 2, 1); f(g, c.paper, 19, 9, 2, 1);
      f(g, edge, 4, 17, 4, 16); f(g, edge, 24, 17, 4, 16); f(g, core, 7, 17, 18, 2);
      f(g, c.outline, 11, 18, 3, 19); f(g, c.outline, 18, 18, 3, 19);
      f(g, edge, 0, 23, 6, 6); f(g, edge, 26, 23, 6, 6); f(g, core, 1, 24, 3, 3); f(g, core, 28, 24, 3, 3);
      if (phase > 0) { f(g, c.danger, 2, 12, 5, 2); f(g, c.orange, 25, 15, 6, 2); }
      if (phase > 1) { f(g, core, 13, 21, 6, 9); f(g, c.danger, 9, 31, 14, 3); }
    };
    WorldArtFactory.texture(scene, 'boss-gatekeeper', 32, 40, g => drawBoss(g, 0));
    WorldArtFactory.texture(scene, 'boss-gatekeeper-phase2', 32, 40, g => drawBoss(g, 1));
    WorldArtFactory.texture(scene, 'boss-gatekeeper-phase3', 32, 40, g => drawBoss(g, 2));
  }

  static createItemTextures(scene: Phaser.Scene): void {
    const c = WorldArtFactory.C;
    const f = WorldArtFactory.fill;
    WorldArtFactory.texture(scene, 'item-fragment', 20, 20, g => {
      // Stepped vinyl silhouette keeps the collectible crisp and unmistakably musical.
      f(g, c.outline, 7, 1, 6, 1);
      f(g, c.outline, 5, 2, 10, 1);
      f(g, c.outline, 3, 3, 14, 2);
      f(g, c.outline, 2, 5, 16, 2);
      f(g, c.outline, 1, 7, 18, 6);
      f(g, c.outline, 2, 13, 16, 2);
      f(g, c.outline, 3, 15, 14, 2);
      f(g, c.outline, 5, 17, 10, 1);
      f(g, c.outline, 7, 18, 6, 1);

      // Dark teal record body with broken groove highlights.
      f(g, 0x17372f, 7, 2, 6, 1);
      f(g, 0x17372f, 5, 3, 10, 2);
      f(g, 0x17372f, 3, 5, 14, 2);
      f(g, 0x17372f, 2, 7, 16, 6);
      f(g, 0x17372f, 3, 13, 14, 2);
      f(g, 0x17372f, 5, 15, 10, 2);
      f(g, 0x17372f, 7, 17, 6, 1);
      f(g, c.teal, 5, 4, 5, 1, 0.62); f(g, c.teal, 3, 7, 1, 5, 0.48);
      f(g, c.teal, 14, 6, 2, 1, 0.34); f(g, c.teal, 14, 14, 1, 1, 0.42);
      f(g, c.paper, 6, 3, 3, 1, 0.7);

      // Oversized acid eighth note with an orange pixel-shadow for instant readability.
      f(g, c.orange, 11, 6, 2, 8, 0.92);
      f(g, c.orange, 12, 6, 4, 2, 0.92);
      f(g, c.orange, 8, 12, 4, 3, 0.92);
      f(g, c.acid, 10, 5, 2, 8);
      f(g, c.acid, 11, 5, 4, 2);
      f(g, c.acid, 7, 11, 4, 3);
      f(g, c.paper, 10, 5, 1, 1, 0.76);
    });
    WorldArtFactory.texture(scene, 'item-lost-track', 48, 48, g => {
      // Finale master record: broad silhouette, readable grooves and a restored waveform label.
      g.fillStyle(c.teal, 0.1); g.fillCircle(24, 24, 23);
      g.lineStyle(2, c.teal, 0.34); g.strokeCircle(24, 24, 21);
      g.fillStyle(0x030706, 1); g.fillCircle(24, 24, 19);
      g.lineStyle(1, 0x28473d, 0.9); g.strokeCircle(24, 24, 16); g.strokeCircle(24, 24, 13); g.strokeCircle(24, 24, 10);
      g.lineStyle(1, c.teal, 0.45); g.beginPath(); g.arc(24, 24, 15, 3.6, 5.3); g.strokePath();
      g.lineStyle(1, c.orange, 0.5); g.beginPath(); g.arc(24, 24, 12, 0.25, 1.75); g.strokePath();
      g.fillStyle(c.acid); g.fillCircle(24, 24, 7); g.fillStyle(0x385b43); g.fillCircle(24, 24, 4); g.fillStyle(c.paper); g.fillCircle(24, 24, 1.5);
      // Tiny equalizer/waveform etched across the center label.
      f(g, 0x10251d, 18, 23, 2, 2); f(g, 0x10251d, 21, 21, 2, 6);
      f(g, 0x10251d, 24, 19, 2, 10); f(g, 0x10251d, 27, 22, 2, 4);
      f(g, c.paper, 14, 8, 4, 2, 0.72); f(g, c.paper, 16, 6, 2, 6, 0.72);
      f(g, c.teal, 34, 33, 3, 2, 0.82); f(g, c.orange, 11, 34, 2, 4, 0.78);
    });
  }

  static createAll(scene: Phaser.Scene): void {
    WorldArtFactory.createTileTextures(scene);
    WorldArtFactory.createCharacterTextures(scene);
    WorldArtFactory.createEnemyTextures(scene);
    WorldArtFactory.createBossTextures(scene);
    WorldArtFactory.createItemTextures(scene);
  }
}
