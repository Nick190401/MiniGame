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

    // Exposed sides: north = 1, east = 2, south = 4, west = 8.
    // Profiles share their endpoints so neighboring variants meet without steps.
    const sandEdges = [
      [1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1],
      [1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 2, 1, 1, 1],
      [1, 1, 1, 2, 1, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 1],
    ];
    const sandPebbles = [[5, 10], [11, 6], [4, 5], [10, 12]];
    const drawSand = (g: Graphics, variant: number, edgeMask: number) => {
      const north = (edgeMask & 1) !== 0;
      const east = (edgeMask & 2) !== 0;
      const south = (edgeMask & 4) !== 0;
      const west = (edgeMask & 8) !== 0;
      const [pebbleX, pebbleY] = sandPebbles[variant];

      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          let edgeDistance = 8;
          if (north) edgeDistance = Math.min(edgeDistance, y - sandEdges[variant][x]);
          if (east) edgeDistance = Math.min(edgeDistance, 15 - x - sandEdges[(variant + 1) % 4][y]);
          if (south) edgeDistance = Math.min(edgeDistance, 15 - y - sandEdges[(variant + 2) % 4][x]);
          if (west) edgeDistance = Math.min(edgeDistance, x - sandEdges[(variant + 3) % 4][y]);

          // Round only exterior corners; transparent pixels reveal the grass below.
          if (north && west) edgeDistance = Math.min(edgeDistance, x + y - 5);
          if (north && east) edgeDistance = Math.min(edgeDistance, 15 - x + y - 5);
          if (south && west) edgeDistance = Math.min(edgeDistance, x + 15 - y - 5);
          if (south && east) edgeDistance = Math.min(edgeDistance, 30 - x - y - 5);
          if (edgeDistance < 0) continue;

          let grain = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(variant + 1, 1274126177);
          grain = Math.imul(grain ^ (grain >>> 13), 1274126177);
          grain = (grain ^ (grain >>> 16)) >>> 0;

          // A muted soil shoulder fades into a softly worn, continuous sand center.
          const base = edgeDistance === 0 ? 0x9e9364
            : edgeDistance === 1 ? 0xb09d66
            : edgeDistance === 2 ? 0xb9a269 : c.sand;
          f(g, base, x, y);
          if (edgeDistance > 2) f(g, c.sandLight, x, y, 1, 1, Math.min(0.13, (edgeDistance - 2) * 0.025));
          if (grain % 31 < 3) f(g, c.sandDark, x, y, 1, 1, 0.18);
          else if (grain % 31 > 27) f(g, c.sandLight, x, y, 1, 1, 0.26);

          // Sparse two-pixel stones stay subtle and never cross the grassy margin.
          if (variant !== 2 && edgeDistance > 2 && y === pebbleY && (x === pebbleX || x === pebbleX + 1)) {
            f(g, x === pebbleX ? 0xa99569 : 0xd4bf8b, x, y, 1, 1, 0.68);
          }
        }
      }
    };

    tile('tile-path', g => drawSand(g, 0, 0));
    for (let variant = 0; variant < 4; variant++) {
      for (let edgeMask = 0; edgeMask < 16; edgeMask++) {
        tile(`tile-path-sand-${variant}-${edgeMask}`, g => drawSand(g, variant, edgeMask));
      }
    }

    tile('tile-path-2', g => {
      f(g, 0x758075, 0, 0, 16, 16);
      f(g, c.stoneDark, 0, 7, 16); f(g, c.stoneDark, 7, 0, 1, 8);
      f(g, c.stoneDark, 4, 8, 1, 8); f(g, c.stoneLight, 1, 1, 5, 1, 0.55);
      f(g, c.stoneLight, 9, 9, 5, 1, 0.48); f(g, c.teal, 14, 3, 1, 1, 0.38);
    });

    // Quiet slate paving, offset joints and restrained wear for Neon Junction.
    // Four tiles form a continuous pattern rather than randomly mirrored bricks.
    for (let variant = 0; variant < 4; variant++) {
      tile(`tile-junction-paving-${variant}`, g => {
        f(g, 0x3c4b50, 0, 0, 16, 16);
        f(g, variant < 2 ? 0x657477 : 0x68777a, 0, 1, 16, 14);
        const joint = variant % 2 === 0 ? 4 : 12;
        f(g, 0x425358, joint, 1, 1, 14);
        f(g, 0x879592, 0, 1, 16, 1, 0.55);
        f(g, 0x82908e, joint + 1, 2, 1, 11, 0.32);
        f(g, 0x536367, 0, 14, 16, 1, 0.6);
        f(g, 0x9aa59c, (variant * 5 + 2) % 15, 6, 2, 1, 0.18);
      });
    }

    // Eight tiles form a 64 x 32 repeat: horizontal boards continue through
    // neighboring tiles, with offset joints instead of a beam on every tile.
    const drawBridgeDeck = (g: Graphics, variant: number) => {
      const patchCol = variant % 4;
      const patchRow = Math.floor(variant / 4);
      const boardColors = [0x99764f, 0x92704c, 0x9e7b52, 0x95714b];
      const boardJoints = [20, 44, 8, 36];
      for (let board = 0; board < 2; board++) {
        const index = patchRow * 2 + board;
        const y = board * 8;
        f(g, boardColors[index], 0, y, 16, 8);
        f(g, 0xc1a171, 0, y, 16, 1, 0.68);
        f(g, 0xaf8c5f, 0, y + 1, 16, 1, 0.3);
        f(g, 0x75573c, 0, y + 6, 16, 1, 0.5);
        f(g, 0x5e4b37, 0, y + 7, 16, 1);

        // Grain uses the whole board's coordinates so it crosses tile edges.
        for (let x = 0; x < 16; x++) {
          const boardX = patchCol * 16 + x;
          if ((boardX + index * 11) % 29 < 13) {
            f(g, 0x684f35, x, y + 3, 1, 1, 0.23);
          }
          if ((boardX + index * 7) % 37 < 9) {
            f(g, 0xd0b483, x, y + 5, 1, 1, 0.22);
          }
          const jointDistance = boardX - boardJoints[index];
          if (jointDistance === 0) f(g, 0x604b36, x, y + 1, 1, 6, 0.84);
          if (jointDistance === 1) f(g, 0xc1a171, x, y + 1, 1, 5, 0.5);
          if (Math.abs(jointDistance) === 3 && index % 2 === 0) {
            f(g, 0x464a41, x, y + 2, 1, 1, 0.86);
            f(g, 0xd4c6a0, x, y + 1, 1, 1, 0.3);
          }
        }
        if ((index === 1 && patchCol === 1) || (index === 3 && patchCol === 3)) {
          f(g, 0x715135, 9, y + 3, 4, 1, 0.38);
          f(g, 0x715135, 10, y + 4, 2, 1, 0.52);
          f(g, 0xc1a171, 8, y + 4, 2, 1, 0.35);
        }
      }
    };
    tile('tile-bridge', g => drawBridgeDeck(g, 0));
    for (let variant = 0; variant < 8; variant++) {
      tile(`tile-bridge-deck-${variant}`, g => drawBridgeDeck(g, variant));
    }

    WorldArtFactory.texture(scene, 'bridge-rail-segment', 10, 16, g => {
      // Continuous north/south rail; posts are separate, taller silhouettes.
      f(g, c.ink, 7, 0, 3, 16, 0.18);
      f(g, 0x352e25, 2, 0, 6, 16);
      f(g, 0xc2a173, 3, 0, 1, 16);
      f(g, 0xa08055, 4, 0, 2, 16);
      f(g, 0x715039, 6, 0, 1, 16);
      f(g, 0x715039, 5, 3, 1, 5, 0.4);
      f(g, 0xe0c794, 3, 1, 1, 5, 0.35);
      f(g, 0x4c3c2c, 4, 11, 1, 3, 0.28);
    });

    WorldArtFactory.texture(scene, 'bridge-rail-post', 12, 24, g => {
      f(g, c.ink, 1, 20, 11, 4, 0.38);
      f(g, 0x322e26, 2, 3, 8, 20);
      f(g, 0x8d6d48, 3, 5, 6, 16);
      f(g, 0xbc9a66, 3, 5, 2, 15);
      f(g, 0x604631, 8, 5, 1, 15);
      f(g, 0x715333, 6, 11, 1, 4, 0.65);
      for (const y of [8, 17]) {
        f(g, 0x303a35, 2, y, 8, 3);
        f(g, 0x6f7964, 3, y, 6, 1);
        f(g, 0xadb392, 4, y + 1, 1, 1, 0.75);
      }
      f(g, 0x493c2b, 1, 2, 10, 4);
      f(g, 0xd0b27e, 2, 1, 8, 3);
      f(g, 0xe7d09c, 3, 1, 6, 1);
      f(g, 0xa78754, 2, 4, 8, 1);
      f(g, 0x2e342c, 1, 21, 10, 2);
      f(g, 0x6d7158, 2, 21, 8, 1);
    });

    tile('tile-bridge-landing', g => {
      // Dressed stone shoulders meet continuously across the bridge width.
      f(g, 0x3e5048, 0, 0, 16, 16);
      f(g, 0x8a937b, 0, 1, 16, 10);
      f(g, 0xb3b79a, 0, 1, 16, 2, 0.72);
      f(g, 0x9da388, 0, 4, 16, 5, 0.36);
      f(g, 0x717d67, 0, 10, 16, 2);
      f(g, 0x526351, 0, 12, 16, 3);
      f(g, 0x8b9579, 0, 12, 16, 1, 0.56);
      f(g, 0x53614f, 11, 3, 1, 8, 0.6);
      f(g, 0xc2c5a6, 12, 3, 1, 6, 0.34);
      f(g, 0x66745a, 3, 6, 3, 1, 0.34);
      f(g, 0xd0cdae, 7, 8, 2, 1, 0.34);
    });

    // All water shares the village pond's continuous surface; only its small
    // reflection overlays move. Exposed shore bits use N=1, E=2, S=4, W=8.
    const pondEdges = [
      [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    ];
    const pondPalette = {
      depth: [0x486353, 0x53938b, 0x47898a, 0x3d7e84, 0x37767f, 0x326f79, 0x306b76],
      stoneLight: 0x749887, stoneDark: 0x234f5c, glimmer: 0x83bcb2,
    };
    const caveWaterPalette = {
      depth: [0x2b4140, 0x376b6c, 0x306369, 0x295963, 0x23515d, 0x204956, 0x1d4451],
      stoneLight: 0x688b83, stoneDark: 0x15303e, glimmer: 0x79b6b3,
    };
    const purifiedWaterPalette = {
      depth: [0x456753, 0x609f8d, 0x51958a, 0x448b86, 0x3b8281, 0x357a7b, 0x317577],
      stoneLight: 0x99bba0, stoneDark: 0x275d60, glimmer: 0xa6e0c6,
    };
    const pondStones = [[4, 3], [12, 10], [5, 12], [11, 4]];
    const pondGlimmers = [[9, 10], [4, 6], [10, 4], [6, 11]];
    const drawWater = (g: Graphics, variant: number, edgeMask: number, palette: typeof pondPalette) => {
      const north = (edgeMask & 1) !== 0;
      const east = (edgeMask & 2) !== 0;
      const south = (edgeMask & 4) !== 0;
      const west = (edgeMask & 8) !== 0;
      const [stoneX, stoneY] = pondStones[variant];
      const [glimmerX, glimmerY] = pondGlimmers[variant];

      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          let depth = 6;
          if (north) depth = Math.min(depth, y - pondEdges[variant][x]);
          if (east) depth = Math.min(depth, 15 - x - pondEdges[(variant + 1) % 4][y]);
          if (south) depth = Math.min(depth, 15 - y - pondEdges[(variant + 2) % 4][x]);
          if (west) depth = Math.min(depth, x - pondEdges[(variant + 3) % 4][y]);

          // Round exposed outer corners and let the terrain underlay show.
          if (north && west) depth = Math.min(depth, x + y - 4);
          if (north && east) depth = Math.min(depth, 15 - x + y - 4);
          if (south && west) depth = Math.min(depth, x + 15 - y - 4);
          if (south && east) depth = Math.min(depth, 30 - x - y - 4);
          if (depth < 0) continue;
          f(g, palette.depth[depth], x, y);

          // Muted submerged pebbles only appear in the shallow water.
          if (depth > 1 && depth < 5 && y === stoneY && (x === stoneX || x === stoneX + 1)) {
            f(g, x === stoneX ? palette.stoneLight : palette.stoneDark, x, y, 1, 1, 0.3);
          }
          // A few faint light fragments avoid a repeated stripe texture.
          if (depth > 2 && ((y === glimmerY && x >= glimmerX && x <= glimmerX + 1)
            || (variant % 2 === 0 && y === glimmerY + 1 && x === glimmerX - 1))) {
            f(g, palette.glimmer, x, y, 1, 1, 0.13);
          }
        }
      }
    };

    tile('tile-water', g => drawWater(g, 0, 0, pondPalette));
    for (let variant = 0; variant < 4; variant++) {
      for (let edgeMask = 0; edgeMask < 16; edgeMask++) {
        tile(`tile-pond-water-${variant}-${edgeMask}`, g => drawWater(g, variant, edgeMask, pondPalette));
        tile(`tile-cave-water-${variant}-${edgeMask}`, g => drawWater(g, variant, edgeMask, caveWaterPalette));
        tile(`tile-cave-water-${variant}-${edgeMask}-purified`, g => drawWater(g, variant, edgeMask, purifiedWaterPalette));
      }
    }

    tile('pond-ripple-0', g => {
      f(g, 0x91c8bb, 4, 5, 4, 1, 0.55);
      f(g, 0x76b6ae, 2, 6, 2, 1, 0.4); f(g, 0x76b6ae, 8, 6, 2, 1, 0.4);
      f(g, 0xb9ded0, 5, 5, 2, 1, 0.3);
      f(g, 0x76b6ae, 8, 10, 4, 1, 0.38); f(g, 0x91c8bb, 11, 9, 2, 1, 0.25);
    });
    tile('pond-ripple-1', g => {
      f(g, 0x91c8bb, 5, 5, 5, 1, 0.42);
      f(g, 0x76b6ae, 3, 6, 2, 1, 0.3); f(g, 0x76b6ae, 10, 6, 2, 1, 0.3);
      f(g, 0x76b6ae, 2, 7, 1, 2, 0.2); f(g, 0x76b6ae, 12, 7, 1, 2, 0.2);
      f(g, 0x91c8bb, 4, 10, 3, 1, 0.32); f(g, 0x91c8bb, 9, 10, 2, 1, 0.28);
      f(g, 0xb9ded0, 6, 5, 2, 1, 0.2);
    });
    tile('pond-lily', g => {
      f(g, 0x173e46, 3, 9, 9, 3, 0.5);
      f(g, 0x315c42, 2, 8, 7, 3); f(g, 0x315c42, 3, 7, 5, 5);
      f(g, 0x628748, 3, 7, 5, 3); f(g, 0x789a54, 4, 7, 3, 1);
      f(g, 0x306b76, 5, 10, 1, 2); f(g, 0x306b76, 6, 11);
      f(g, 0x416e45, 9, 6, 4, 3); f(g, 0x7e9d5b, 10, 6, 2, 1);
      f(g, 0x30534a, 8, 6, 3, 2);
      f(g, 0xe1a7af, 8, 4, 3, 3); f(g, 0xf1dcd1, 9, 3, 1, 4);
      f(g, 0xf1dcd1, 7, 5, 5, 1); f(g, 0xd7b765, 9, 5);
    });
    tile('pond-reeds', g => {
      f(g, 0x204c4e, 3, 13, 10, 2, 0.45);
      f(g, 0x3d6846, 5, 8, 1, 6); f(g, 0x87a266, 5, 7, 1, 4);
      f(g, 0x709056, 8, 4, 1, 10); f(g, 0x9caf70, 8, 5, 1, 4);
      f(g, 0x4c794d, 11, 6, 1, 8); f(g, 0x88a164, 11, 6, 1, 4);
      f(g, 0x3a6240, 7, 11, 1, 4); f(g, 0x739252, 6, 9, 1, 3);
      f(g, 0x4c7547, 9, 10, 1, 5); f(g, 0x88a061, 10, 8, 1, 3);
      f(g, 0x5d523b, 7, 2, 2, 4); f(g, 0x9a7950, 8, 2, 1, 3);
      f(g, 0x64543c, 10, 4, 2, 3); f(g, 0xb0955d, 11, 4, 1, 2);
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

    const tallGrassPalettes = [
      { deep: 0x29472f, mid: 0x4f713e, light: 0x769653, tip: 0x9ab568 },
      { deep: 0x304b32, mid: 0x587844, light: 0x829d58, tip: 0xa3b96c },
      { deep: 0x26432d, mid: 0x537541, light: 0x789a55, tip: 0xa1ba70 },
      { deep: 0x314d35, mid: 0x5b7b47, light: 0x86a05d, tip: 0xa9bd72 },
    ];
    const grassOffsets = [
      [2, 3, 2],
      [3, 1, 4],
      [4, 2, 1],
      [1, 4, 3],
    ];

    const drawTallGrassBase = (g: Graphics, variant: number) => {
      const palette = tallGrassPalettes[variant];
      const offsets = grassOffsets[variant];
      f(g, palette.deep, 0, 11, 16, 5, 0.78);
      f(g, c.outline, 0, 15, 16, 1, 0.24);
      drawGrassTuft(g, -2, offsets[0], palette);
      drawGrassTuft(g, 4, offsets[1], palette);
      drawGrassTuft(g, 10, offsets[2], palette);
      f(g, palette.tip, variant % 2 === 0 ? 8 : 1, 13, 2, 1, 0.7);
      f(g, palette.light, variant < 2 ? 5 : 11, 15, 3, 1, 0.55);
    };

    const drawTallGrassFront = (g: Graphics, variant: number) => {
      const palette = tallGrassPalettes[variant];
      const offsets = grassOffsets[(variant + 1) % grassOffsets.length];
      drawGrassTuft(g, -2, offsets[0], palette);
      drawGrassTuft(g, 5, offsets[1], palette);
      drawGrassTuft(g, 11, offsets[2], palette);
      f(g, palette.deep, 0, 14, 16, 2, 0.34);
    };

    ['', '-2', '-3', '-4'].forEach((suffix, variant) => {
      tile(`tile-tall-grass${suffix}`, g => drawTallGrassBase(g, variant));
      tile(`tile-tall-grass-top${suffix}`, g => drawTallGrassFront(g, variant));
    });

    const flower = (g: Graphics, alt: boolean) => {
      const petal = alt ? 0x79c8b7 : 0xe88755;
      const center = alt ? 0xf1e6a5 : 0xffd36b;
      const bloom = (x: number, y: number) => {
        f(g, c.grassDark, x, y + 2, 1, 5);
        f(g, c.grassLight, x - 2, y + 4, 2, 1);
        f(g, c.grassLight, x + 1, y + 3, 2, 1);
        f(g, petal, x - 1, y, 1, 2);
        f(g, petal, x + 1, y, 1, 2);
        f(g, petal, x, y - 1, 1, 1);
        f(g, petal, x, y + 2, 1, 1);
        f(g, center, x, y + 1, 1, 1);
      };
      bloom(5, 8);
      bloom(10, alt ? 7 : 9);
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

    // Complete landmark buildings. These are authored as single transparent
    // pixel-art silhouettes so roofs, walls and signs never read as repeated
    // tile boxes. Each function has its own massing and functional marker.
    const landmark = (key: string, width: number, height: number, draw: Draw) => {
      WorldArtFactory.texture(scene, key, width, height, draw);
    };
    const landmarkShadow = (g: Graphics, width: number, y: number) => {
      f(g, c.ink, 8, y, width - 16, 5, 0.28);
      f(g, c.ink, 14, y + 4, width - 28, 2, 0.16);
    };
    const window = (g: Graphics, x: number, y: number, tone: number = c.water) => {
      f(g, c.outline, x, y, 16, 14);
      f(g, tone, x + 2, y + 2, 12, 10);
      f(g, c.waterBright, x + 3, y + 3, 8, 2, 0.62);
      f(g, c.woodLight, x + 7, y + 2, 2, 10);
      f(g, c.woodLight, x + 2, y + 6, 12, 2);
    };
    const door = (g: Graphics, x: number, y: number, tone: number = c.wood) => {
      f(g, c.outline, x, y, 18, 26);
      f(g, tone, x + 2, y + 2, 14, 24);
      f(g, c.woodLight, x + 4, y + 3, 2, 20, 0.55);
      f(g, c.acid, x + 12, y + 13, 2, 2);
    };
    const steppedRoof = (
      g: Graphics,
      x: number,
      top: number,
      width: number,
      rows: number,
      base: number,
      light: number,
      dark: number,
    ) => {
      for (let row = 0; row < rows; row++) {
        const inset = (rows - row - 1) * 4;
        f(g, dark, x + inset - 2, top + row * 4 - 2, width - inset * 2 + 4, 6);
        f(g, base, x + inset, top + row * 4, width - inset * 2, 4);
        f(g, light, x + inset + 2, top + row * 4, Math.max(2, width - inset * 2 - 4), 1, 0.74);
      }
    };

    landmark('landmark-cottage', 112, 96, g => {
      landmarkShadow(g, 112, 88);
      f(g, c.woodDark, 13, 44, 86, 43);
      f(g, 0xd8cfb1, 16, 47, 80, 37);
      f(g, 0xeee4c5, 18, 49, 76, 5, 0.8);
      steppedRoof(g, 6, 10, 100, 10, c.roof, c.roofLight, c.roofDark);
      f(g, c.woodDark, 12, 43, 88, 5);
      window(g, 24, 57); window(g, 72, 57);
      door(g, 47, 58);
      f(g, c.grassDark, 10, 84, 92, 4); f(g, c.moss, 18, 82, 14, 3, 0.7);
    });

    landmark('landmark-professor-lab', 160, 112, g => {
      landmarkShadow(g, 160, 104);
      f(g, c.stoneDark, 10, 44, 140, 60);
      f(g, 0xc4c6ad, 14, 48, 132, 52);
      f(g, 0xe3dfbd, 17, 51, 126, 7, 0.72);
      steppedRoof(g, 5, 20, 150, 8, 0x426b71, 0x76a09f, 0x29484e);
      f(g, c.outline, 61, 9, 38, 18);
      f(g, 0x426b71, 64, 12, 32, 13);
      f(g, c.teal, 70, 16, 20, 3); f(g, c.acid, 78, 13, 4, 9);
      f(g, c.stoneDark, 120, 9, 3, 20); f(g, c.stoneLight, 121, 8, 12, 3);
      f(g, c.teal, 132, 4, 2, 5, 0.8);
      window(g, 25, 66, 0x38666a); window(g, 112, 66, 0x38666a);
      door(g, 71, 72, 0x4f6c64);
      f(g, c.outline, 52, 57, 56, 8); f(g, 0x263d38, 54, 59, 52, 4);
      f(g, c.teal, 59, 60, 8, 2); f(g, c.orange, 70, 59, 5, 3); f(g, c.teal, 79, 58, 4, 5);
      f(g, c.orange, 87, 60, 6, 2); f(g, c.acid, 97, 59, 4, 3);
    });

    landmark('landmark-clinic', 128, 96, g => {
      landmarkShadow(g, 128, 88);
      f(g, c.stoneDark, 12, 39, 104, 49);
      f(g, 0xc8c4a8, 15, 42, 98, 43);
      f(g, 0xe5dfbd, 18, 45, 92, 7, 0.72);
      steppedRoof(g, 6, 15, 116, 7, 0x467e76, 0x75aa9b, 0x28564f);
      f(g, c.outline, 51, 8, 26, 25);
      f(g, 0x315e58, 54, 11, 20, 19);
      f(g, c.orange, 61, 13, 6, 15); f(g, c.orange, 56, 18, 16, 6);
      window(g, 25, 57, 0x396e70); window(g, 87, 57, 0x396e70);
      door(g, 55, 62, 0x3e625c);
      f(g, c.teal, 15, 84, 98, 3, 0.45);
    });

    landmark('landmark-inn', 128, 96, g => {
      landmarkShadow(g, 128, 88);
      f(g, c.woodDark, 12, 41, 104, 47);
      f(g, 0x8f704f, 16, 45, 96, 39);
      f(g, c.woodLight, 18, 47, 92, 5, 0.48);
      steppedRoof(g, 5, 13, 118, 8, 0x6b7452, 0x98a06d, 0x424933);
      f(g, c.woodDark, 19, 55, 90, 4); f(g, c.woodDark, 38, 45, 4, 39); f(g, c.woodDark, 86, 45, 4, 39);
      window(g, 21, 62, 0x345f61); window(g, 91, 62, 0x345f61);
      door(g, 55, 61);
      f(g, c.woodDark, 103, 48, 3, 16); f(g, c.outline, 98, 60, 19, 16);
      f(g, 0xb68b4f, 100, 62, 15, 12); f(g, c.acid, 103, 66, 9, 2); f(g, c.orange, 108, 64, 2, 6);
    });

    landmark('landmark-workshop', 112, 80, g => {
      landmarkShadow(g, 112, 73);
      f(g, c.stoneDark, 11, 32, 90, 41);
      f(g, 0x8b8673, 14, 35, 84, 35);
      f(g, c.woodDark, 76, 4, 12, 31); f(g, c.stone, 78, 5, 8, 27); f(g, c.caveLight, 79, 5, 6, 3);
      f(g, c.outline, 5, 25, 102, 12);
      for (let x = 8; x < 104; x += 12) {
        f(g, x % 24 === 8 ? 0x9e5944 : 0xb56b4f, x, 27, 11, 8);
        f(g, 0xd18a67, x, 27, 10, 2, 0.66);
      }
      window(g, 21, 45, 0x354f55);
      f(g, c.outline, 51, 42, 36, 29); f(g, c.wood, 54, 45, 30, 26);
      for (let x = 59; x < 82; x += 7) f(g, c.woodDark, x, 45, 2, 26);
      f(g, c.orange, 91, 48, 7, 5); f(g, c.acid, 94, 49, 2, 2);
    });

    landmark('landmark-riverside-hut', 112, 80, g => {
      landmarkShadow(g, 112, 75);
      f(g, c.woodDark, 17, 38, 78, 31); f(g, 0x9d835b, 20, 41, 72, 25);
      steppedRoof(g, 11, 13, 90, 7, 0x4d7470, 0x79a09a, 0x31504d);
      window(g, 28, 47, 0x397276); door(g, 63, 44);
      f(g, c.woodDark, 22, 67, 7, 10); f(g, c.woodDark, 83, 67, 7, 10);
      f(g, c.waterLight, 6, 74, 100, 2, 0.48); f(g, c.waterBright, 24, 77, 36, 1, 0.38);
    });

    landmark('landmark-signal-station', 256, 112, g => {
      landmarkShadow(g, 256, 104);
      f(g, c.outline, 10, 44, 236, 61);
      f(g, 0x59665f, 14, 48, 228, 53);
      f(g, 0x7f8b82, 18, 51, 220, 8, 0.68);
      f(g, c.outline, 4, 29, 248, 22);
      f(g, 0x384f49, 8, 32, 240, 16);
      f(g, 0x5f7770, 12, 33, 232, 5);
      f(g, c.outline, 92, 8, 72, 30);
      f(g, 0x2b4541, 96, 12, 64, 23);
      f(g, c.teal, 104, 27, 8, 4); f(g, c.teal, 116, 21, 8, 10);
      f(g, c.orange, 128, 16, 8, 15); f(g, c.teal, 140, 23, 8, 8);
      f(g, c.acid, 151, 19, 3, 12);
      [28, 68, 172, 212].forEach(x => window(g, x, 65, 0x244c50));
      f(g, c.outline, 109, 61, 38, 41); f(g, 0x354b46, 113, 65, 30, 37);
      f(g, c.stoneLight, 116, 67, 2, 30, 0.48); f(g, c.teal, 137, 78, 3, 3);
      f(g, c.orange, 14, 97, 228, 4, 0.52);
    });

    landmark('landmark-guard-post', 112, 80, g => {
      landmarkShadow(g, 112, 73);
      f(g, c.outline, 12, 26, 88, 47); f(g, 0x59645e, 15, 29, 82, 41);
      for (let x = 12; x < 101; x += 18) f(g, c.outline, x, 18, 12, 14);
      for (let x = 15; x < 98; x += 18) f(g, c.stone, x, 21, 7, 10);
      f(g, c.stoneLight, 18, 31, 76, 4, 0.55);
      window(g, 24, 43, 0x284e51); door(g, 62, 43, 0x3d4c48);
      f(g, c.orange, 44, 41, 10, 3); f(g, c.acid, 48, 38, 3, 9);
    });

    landmark('landmark-archive-shrine', 112, 112, g => {
      landmarkShadow(g, 112, 104);
      f(g, c.outline, 24, 45, 64, 59); f(g, 0x55655c, 28, 49, 56, 51);
      steppedRoof(g, 10, 18, 92, 8, 0x3f685b, 0x71917c, 0x29463d);
      f(g, c.outline, 18, 43, 76, 7); f(g, c.stoneLight, 22, 45, 68, 3, 0.5);
      f(g, c.outline, 38, 57, 36, 44); f(g, 0x1c302a, 42, 61, 28, 40);
      f(g, c.teal, 53, 67, 6, 20, 0.58); f(g, c.acid, 48, 74, 16, 5, 0.48);
      f(g, c.stoneDark, 14, 96, 84, 8); f(g, c.moss, 18, 94, 22, 4, 0.56);
      f(g, c.orange, 54, 8, 4, 13); f(g, c.acid, 50, 12, 12, 4);
    });

    landmark('landmark-ranger-hut', 112, 80, g => {
      landmarkShadow(g, 112, 73);
      f(g, c.woodDark, 14, 35, 84, 38); f(g, 0x78684d, 18, 39, 76, 31);
      steppedRoof(g, 8, 13, 96, 7, 0x536b48, 0x7f915f, 0x354631);
      f(g, c.moss, 16, 35, 24, 4, 0.64); f(g, c.moss, 79, 37, 15, 3, 0.58);
      window(g, 25, 47, 0x345b58); door(g, 65, 44);
      f(g, c.woodDark, 7, 60, 13, 4); f(g, c.wood, 5, 56, 5, 15);
    });

    landmark('landmark-cave-mouth', 224, 96, g => {
      landmarkShadow(g, 224, 89);
      // Layered rock shoulders frame an old, dressed-stone portal.
      f(g, c.outline, 0, 48, 224, 48);
      f(g, 0x34443e, 16, 32, 192, 60);
      f(g, 0x4b5b50, 32, 20, 160, 60);
      f(g, 0x627063, 54, 10, 116, 34);
      f(g, c.stoneLight, 76, 8, 66, 4, 0.55);
      for (let side = 0; side < 2; side++) {
        const x = side === 0 ? 0 : 176;
        for (let course = 0; course < 3; course++) {
          const y = 48 + course * 16;
          f(g, 0x26362f, x + 2, y + 1, 44, 15);
          f(g, course % 2 ? 0x4b5b50 : 0x566457, x + 3, y + 2, 42, 11);
          f(g, 0x82907a, x + 5, y + 2, 25, 2, 0.55);
          f(g, c.outline, x + (course % 2 ? 15 : 30), y + 3, 2, 10);
        }
      }
      // Opening exactly matches the collision-free columns 29–34.
      f(g, 0x080f0e, 64, 32, 96, 64);
      f(g, 0x14221e, 70, 46, 84, 50);
      f(g, 0x1d3028, 76, 66, 72, 30);
      for (let y = 80; y < 96; y += 5) {
        f(g, 0x3c5044, 64, y, 96, 2);
        f(g, 0x0c1713, 80 + (y % 3) * 16, y + 2, 18, 1);
      }
      for (const x of [48, 160]) {
        f(g, c.outline, x, 28, 16, 68);
        for (let y = 32; y < 88; y += 14) {
          f(g, c.stoneDark, x + 1, y, 14, 12);
          f(g, c.stone, x + 2, y, 11, 3);
          f(g, c.stoneLight, x + 2, y + 3, 2, 7, 0.65);
        }
        f(g, 0x637264, x, 88, 16, 6);
        f(g, c.teal, x + 7, 51, 2, 12, 0.65);
        f(g, c.teal, x + 5, 55, 6, 2, 0.5);
      }
      // Jointed lintel and a recessed keystone emblem.
      f(g, c.outline, 44, 22, 136, 12);
      for (let x = 48; x < 176; x += 16) {
        f(g, c.stoneDark, x, 23, 15, 9);
        f(g, c.stone, x + 1, 23, 13, 2);
      }
      f(g, c.outline, 101, 15, 22, 23);
      f(g, c.stone, 104, 16, 16, 18);
      f(g, c.caveMid, 108, 20, 8, 10);
      f(g, c.teal, 111, 21, 2, 8, 0.8);
      f(g, c.teal, 109, 24, 6, 2, 0.6);
      for (const [x, y, width] of [[22, 43, 19], [32, 67, 13], [183, 38, 15], [191, 82, 23]]) {
        f(g, c.grassDark, x, y, width, 4);
        f(g, c.moss, x + 2, y, width - 5, 2, 0.65);
      }
    });

    tile('tile-universe-portal', g => {
      f(g, c.cave, 0, 0, 16, 16);
      f(g, 0x263b3c, 3, 2, 10, 12);
      f(g, 0x647b70, 5, 1, 6, 2);
      f(g, 0x73877a, 3, 3, 2, 9);
      f(g, 0x4d655e, 11, 3, 2, 9);
      f(g, 0x221d40, 5, 3, 6, 10);
      f(g, 0x9b80d3, 6, 4, 3, 1);
      f(g, 0x755ca7, 9, 5, 1, 5);
      f(g, 0x74c9c7, 6, 7, 1, 4);
      f(g, 0x74c9c7, 7, 10, 2, 1);
      f(g, 0x456059, 2, 13, 12, 2);
      f(g, 0x89b6a5, 3, 13, 10, 1);
      f(g, 0xa1e0ce, 3, 6, 1, 2);
      f(g, 0xa1e0ce, 11, 8, 1, 2);
    });

    landmark('landmark-universe-portal', 96, 96, g => {
      // One upright, weathered stone ring; its opening is centered at (48, 43).
      // The transparent shoulder lets both cave floor palettes show through.
      landmarkShadow(g, 96, 87);
      for (let y = 1; y < 86; y += 2) {
        for (let x = 8; x < 88; x += 2) {
          const dx = (x - 48) / 34;
          const dy = (y - 43) / 39;
          const radius = Math.hypot(dx, dy);
          if (radius > 1 && radius < 1.16) {
            f(g, 0x7965cf, x, y, 2, 2, (1.16 - radius) * 0.65);
          }
        }
      }

      for (let y = 5; y < 83; y += 2) {
        for (let x = 14; x < 82; x += 2) {
          const dx = (x - 48) / 34;
          const dy = (y - 43) / 39;
          const radius = Math.hypot(dx, dy);
          const opening = Math.hypot((x - 48) / 23, (y - 43) / 28);
          if (radius > 1) continue;

          if (opening < 1) {
            // Violet clouds fall away into a dark center, with no flat fill.
            const angle = Math.atan2((y - 43) / 28, (x - 48) / 23);
            const curl = Math.sin(angle * 2.5 - opening * 10);
            const tone = opening < 0.28 ? 0x0b1020
              : curl > 0.4 ? 0x30234f : curl < -0.4 ? 0x151b34 : 0x211d3e;
            f(g, tone, x, y, 2, 2);
            if (opening > 0.87) {
              f(g, dx < 0 ? 0x6fbebd : 0x9270d0, x, y, 2, 2, 0.66);
            }
            continue;
          }

          // Individual voussoirs, chipped edges and restrained mineral grain.
          const angle = Math.atan2(dy, dx);
          const course = (angle + Math.PI) / (Math.PI * 2) * 12;
          const joint = Math.abs(course - Math.round(course)) < 0.07;
          const grain = (x * 13 + y * 7) % 19;
          const highlight = dx + dy < -0.6;
          const tone = radius > 0.96 ? 0x142025
            : opening < 1.1 ? 0x25383d
            : joint ? 0x263036
            : highlight ? (grain < 4 ? 0x84918a : 0x697975)
            : grain < 4 ? 0x61716d : 0x475955;
          f(g, tone, x, y, 2, 2);
          if (radius > 0.86 && radius < 0.92 && highlight && !joint) {
            f(g, 0xb0b8a3, x, y, 2, 1, 0.45);
          }
        }
      }

      // Small carved glyphs sit on stone, separate from the moving energy.
      const runes = [
        { x: 45, y: 10, rows: ['01110', '01010', '11111', '00100', '00100'] },
        { x: 24, y: 22, rows: ['10001', '01010', '00100', '01010', '01010'] },
        { x: 17, y: 42, rows: ['11100', '00100', '01110', '00100', '00111'] },
        { x: 25, y: 62, rows: ['00100', '01110', '10101', '00100', '01110'] },
        { x: 66, y: 22, rows: ['01110', '01000', '01110', '00010', '01110'] },
        { x: 74, y: 42, rows: ['00100', '01110', '00100', '00101', '00110'] },
        { x: 64, y: 62, rows: ['01010', '01010', '01110', '00100', '00100'] },
      ];
      for (const { x, y, rows } of runes) {
        f(g, 0x16272c, x - 1, y - 1, 7, 7, 0.68);
        rows.forEach((row, rowIndex) => {
          for (let col = 0; col < row.length; col++) {
            if (row[col] === '1') f(g, 0x87d9cd, x + col, y + rowIndex, 1, 1, 0.88);
          }
        });
      }

      // A substantial plinth and two feet anchor the vertical ring to the floor.
      f(g, 0x102023, 19, 77, 58, 13);
      f(g, 0x3b504b, 21, 78, 54, 9);
      f(g, 0x7a9080, 23, 78, 50, 2);
      f(g, 0x1e3233, 29, 83, 38, 4);
      f(g, 0x526b62, 31, 83, 34, 2);
      f(g, 0x7cc5b7, 35, 80, 26, 1, 0.56);
      for (const x of [12, 66]) {
        f(g, 0x142327, x, 73, 18, 17);
        f(g, 0x4a5e56, x + 2, 74, 14, 13);
        f(g, 0x859383, x + 2, 74, 14, 2);
        f(g, 0x64786a, x + 2, 76, 3, 8);
        f(g, 0x283d3b, x + 5, 82, 11, 5);
        f(g, 0x112024, x - 2, 87, 22, 4);
        f(g, 0x52685d, x, 87, 18, 2);
      }
      f(g, 0x4d7970, 9, 90, 5, 2, 0.75);
      f(g, 0x6f8170, 81, 90, 4, 2, 0.65);
    });

    WorldArtFactory.texture(scene, 'universe-portal-energy', 48, 56, g => {
      // This transparent inset can breathe independently of the stone ring.
      for (let arm = 0; arm < 2; arm++) {
        for (let step = 0; step < 90; step++) {
          const t = step / 89;
          const radius = 0.14 + t * 0.72;
          const angle = arm * Math.PI + t * Math.PI * 2.05;
          const x = Math.round(24 + Math.cos(angle) * 22 * radius);
          const y = Math.round(28 + Math.sin(angle) * 26 * radius);
          const color = arm === 0 ? 0x87d9d7 : 0xb79aee;
          f(g, color, x - 1, y - 1, 3, 3, 0.09 + t * 0.06);
          if (step % 7 < 4) f(g, color, x, y, 1, 1, 0.3 + t * 0.38);
        }
      }
      for (const [x, y] of [[15, 12], [31, 17], [10, 31], [35, 37], [20, 46]]) {
        f(g, 0x9dbddc, x - 1, y, 3, 1, 0.3);
        f(g, 0xd6eae5, x, y, 1, 1, 0.82);
      }
      f(g, 0xb89fed, 26, 27, 2, 1, 0.68);
    });

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

    const caveFloor = (g: Graphics, variant: number, purified: boolean) => {
      const base = purified ? 0x29493d : variant === 1 ? 0x182425 : variant === 2 ? 0x151f21 : c.cave;
      const mid = purified ? 0x3b6252 : variant === 1 ? 0x243535 : variant === 2 ? 0x202f31 : c.caveMid;
      const light = purified ? 0x62806d : c.caveLight;
      f(g, base, 0, 0, 16, 16);
      f(g, mid, variant === 1 ? 1 : 8, variant === 2 ? 2 : 9, variant === 1 ? 7 : 6, 3, 0.72);
      f(g, light, variant === 2 ? 2 : 10, variant === 1 ? 12 : 3, 4, 1, 0.62);
      f(g, purified ? 0x1d352d : 0x091011, variant === 1 ? 10 : 3, variant === 1 ? 4 : 12, 5, 2, 0.7);
      f(g, purified ? c.teal : 0x3b7770, 2 + variant * 4, 6 + variant * 3, 1, 1, purified ? 0.72 : 0.32);
      if (purified) f(g, c.acid, 13 - variant * 3, 13, 1, 1, 0.48);
    };
    ['', '-2', '-3'].forEach((suffix, variant) => {
      tile(`tile-cave-floor${suffix}`, g => caveFloor(g, variant, false));
      tile(`tile-cave-floor${suffix}-purified`, g => caveFloor(g, variant, true));
    });

    const caveWall = (g: Graphics, variant: boolean, purified: boolean) => {
      const deep = purified ? 0x152923 : 0x090f10;
      const base = purified ? (variant ? 0x35584a : 0x304f43) : (variant ? 0x213133 : c.caveMid);
      const light = purified ? 0x5e7b68 : c.caveLight;
      f(g, deep, 0, 0, 16, 16);
      f(g, base, 1, 1, 14, 15);
      f(g, light, variant ? 8 : 2, 2, variant ? 5 : 4, 2, 0.74);
      f(g, deep, variant ? 4 : 9, 0, 2, variant ? 7 : 9);
      f(g, deep, 0, variant ? 8 : 10, 16, 2);
      f(g, light, variant ? 2 : 10, 12, 4, 1, 0.56);
      f(g, purified ? 0x203d33 : c.outline, 0, 15, 16);
      if (purified) f(g, c.teal, variant ? 13 : 1, variant ? 4 : 6, 1, 2, 0.42);
    };
    tile('tile-cave-wall', g => caveWall(g, false, false));
    tile('tile-cave-wall-2', g => caveWall(g, true, false));
    tile('tile-cave-wall-purified', g => caveWall(g, false, true));
    tile('tile-cave-wall-2-purified', g => caveWall(g, true, true));

    const caveWallFace = (g: Graphics, purified: boolean) => {
      f(g, purified ? 0x36594b : 0x223335, 0, 0, 16, 16);
      f(g, purified ? 0x62806d : c.caveLight, 0, 0, 16, 3, 0.82);
      f(g, purified ? 0x1b332b : 0x0a1112, 0, 12, 16, 4);
      f(g, purified ? 0x294b3f : 0x172426, 1, 4, 14, 8);
      f(g, purified ? 0x527260 : 0x344a49, 2, 5, 5, 2, 0.66);
      f(g, purified ? 0x183028 : 0x0c1415, 8, 3, 2, 9);
      f(g, purified ? c.teal : 0x376f69, 13, 6, 1, 4, purified ? 0.48 : 0.24);
    };
    tile('tile-cave-wall-face', g => caveWallFace(g, false));
    tile('tile-cave-wall-face-purified', g => caveWallFace(g, true));

    tile('tile-cave-water', g => drawWater(g, 0, 0, caveWaterPalette));
    tile('tile-cave-water-purified', g => drawWater(g, 0, 0, purifiedWaterPalette));

    const caveStairs = (g: Graphics, purified: boolean) => {
      caveFloor(g, 1, purified);
      for (let step = 0; step < 5; step++) {
        const inset = step;
        f(g, purified ? 0x668b73 : 0x435451, inset, 3 + step * 2, 16 - inset * 2, 2);
        f(g, purified ? 0x294a3e : 0x162325, inset, 5 + step * 2, 16 - inset * 2, 1);
      }
    };
    tile('tile-cave-stairs', g => caveStairs(g, false));
    tile('tile-cave-stairs-purified', g => caveStairs(g, true));

    const caveBoulder = (g: Graphics, purified: boolean) => {
      f(g, purified ? 0x183129 : 0x091011, 2, 12, 12, 3, 0.42);
      f(g, purified ? 0x3d6252 : 0x253638, 2, 6, 12, 8);
      f(g, purified ? 0x557764 : c.caveLight, 4, 3, 8, 10);
      f(g, purified ? 0x77917b : 0x566462, 6, 2, 5, 3);
      f(g, purified ? 0x244439 : 0x172325, 3, 9, 4, 4);
      f(g, purified ? c.teal : 0x39736c, 10, 6, 1, 4, purified ? 0.44 : 0.22);
    };
    tile('tile-cave-boulder', g => caveBoulder(g, false));
    tile('tile-cave-boulder-purified', g => caveBoulder(g, true));

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
    // Same framed MR monogram as public/assets/mr-logo.svg, drawn into the
    // texture itself so pickup/reveal animations carry the branding with them.
    const drawMark = (g: Graphics, x: number, y: number, width: number, color: number) => {
      const scale = width / 150;
      const line = (points: number[][], weight: number) => {
        g.lineStyle(weight * scale, color, 1);
        g.beginPath();
        points.forEach(([px, py], i) => {
          if (i === 0) g.moveTo(x + px * scale, y + py * scale);
          else g.lineTo(x + px * scale, y + py * scale);
        });
        g.strokePath();
      };
      line([[10, 8], [146, 6], [144, 88], [4, 88], [10, 8]], 3.5);
      const mark = [[20, 77], [25, 19], [54, 76], [90, 19], [111, 19]];
      const curve = (p0: number[], p1: number[], p2: number[], p3: number[]) => {
        for (let i = 1; i <= 12; i++) {
          const t = i / 12;
          const u = 1 - t;
          mark.push([0, 1].map(axis => u ** 3 * p0[axis] + 3 * u ** 2 * t * p1[axis]
            + 3 * u * t ** 2 * p2[axis] + t ** 3 * p3[axis]));
        }
      };
      curve([111, 19], [124, 19], [133, 23], [132, 33]);
      curve([132, 33], [131, 45], [117, 51], [102, 53]);
      mark.push([126, 76]);
      line(mark, 6);
    };

    const drawRecord = (g: Graphics, size: number, master: boolean) => {
      const unit = size / (master ? 48 : 24);
      const center = size / 2;
      const radius = center - 2 * unit;
      const label = master ? 0xe8c477 : 0xe88d54;
      const rim = master ? 0xe8b465 : 0x6ea8d8;
      // Dark vinyl, a fine metallic rim and concentric pressing grooves.
      g.fillStyle(0x05090d); g.fillCircle(center, center, radius + unit);
      g.lineStyle((master ? 1.4 : 0.8) * unit, rim, 0.9);
      g.strokeCircle(center, center, radius);
      g.fillStyle(0x101923); g.fillCircle(center, center, radius - unit);
      for (let r = radius - 2 * unit; r > radius * 0.64; r -= (master ? 2 : 1.2) * unit) {
        g.lineStyle((master ? 0.7 : 0.5) * unit, 0x46586b, 0.85);
        g.strokeCircle(center, center, r);
      }
      // Two narrow light reflections make it read as vinyl, without a glow.
      for (const [start, end] of [[3.65, 4.55], [0.48, 1.22]]) {
        g.lineStyle((master ? 1.4 : 0.8) * unit, 0xb9d4de, 0.7);
        g.beginPath(); g.arc(center, center, radius - 2 * unit, start, end); g.strokePath();
      }
      const labelRadius = radius * 0.65;
      g.fillStyle(label); g.fillCircle(center, center, labelRadius);
      g.lineStyle((master ? 0.8 : 0.5) * unit, 0x74482c, 1);
      g.strokeCircle(center, center, labelRadius - 0.8 * unit);
      const markWidth = labelRadius * 1.78;
      drawMark(g, center - markWidth / 2, center - labelRadius * 0.66, markWidth, 0x17130f);
      // The spindle sits below the logo rather than cutting through the letters.
      g.fillStyle(0x17130f); g.fillCircle(center, center + labelRadius * 0.64, (master ? 1.2 : 0.65) * unit);
      if (master) {
        // Gold master pressing: distinct four-point glints on the outer rim.
        for (const [x, y] of [[8, 9], [39, 36]]) {
          g.fillStyle(0xffe9af);
          g.fillRect(x - 3, y, 7, 1);
          g.fillRect(x, y - 3, 1, 7);
        }
      }
    };

    // Supersample the small pickups so the framed MR strokes survive rendering.
    WorldArtFactory.texture(scene, 'item-fragment-mr', 96, 96, g => drawRecord(g, 96, false));
    WorldArtFactory.texture(scene, 'item-lost-track', 48, 48, g => drawRecord(g, 48, true));
  }

  static createAll(scene: Phaser.Scene): void {
    WorldArtFactory.createTileTextures(scene);
    WorldArtFactory.createCharacterTextures(scene);
    WorldArtFactory.createEnemyTextures(scene);
    WorldArtFactory.createBossTextures(scene);
    WorldArtFactory.createItemTextures(scene);
  }
}
