import Phaser from 'phaser';

/**
 * Generates all game textures programmatically using Phaser's Graphics API.
 * No external sprite sheets required.
 */
export class TextureFactory {

  // ── Player ────────────────────────────────────────────────────────────────

  static createPlayerTextures(scene: Phaser.Scene): void {
    const W = 16, H = 16;

    // Helper to draw a simple player figure on a graphics object
    const drawPlayer = (g: Phaser.GameObjects.Graphics, facing: 'down' | 'up' | 'left' | 'right', frame: 0 | 1) => {
      g.clear();

      // Body – warm orange tunic
      g.fillStyle(0xe07830);
      g.fillRect(5, 7, 6, 7);

      // Head
      g.fillStyle(0xf4c07a);
      g.fillRect(5, 2, 6, 5);

      // Eyes
      g.fillStyle(0x1a0a2e);
      if (facing === 'down') {
        g.fillRect(6, 4, 1, 1);
        g.fillRect(9, 4, 1, 1);
      } else if (facing === 'up') {
        // No eyes shown (back of head)
      } else {
        // side
        const eyeX = facing === 'right' ? 10 : 5;
        g.fillRect(eyeX, 4, 1, 1);
      }

      // Hair / hat accent
      g.fillStyle(0x3d1f00);
      g.fillRect(5, 2, 6, 2);

      // Legs with walk animation
      g.fillStyle(0x3a6b8a);
      if (frame === 0) {
        g.fillRect(5, 13, 3, 3);
        g.fillRect(8, 14, 3, 2);
      } else {
        g.fillRect(5, 14, 3, 2);
        g.fillRect(8, 13, 3, 3);
      }

      // Arms
      g.fillStyle(0xe07830);
      g.fillRect(3, 8, 2, 4);
      g.fillRect(11, 8, 2, 4);
    };

    const directions = ['down', 'up', 'left', 'right'] as const;
    directions.forEach(dir => {
      for (let frame = 0; frame < 2; frame++) {
        const key = `player-${dir}-${frame}`;
        if (scene.textures.exists(key)) return;
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        drawPlayer(g, dir, frame as 0 | 1);
        g.generateTexture(key, W, H);
        g.destroy();
      }
    });

    // Idle = down frame 0
    if (!scene.textures.exists('player-idle')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      drawPlayer(g, 'down', 0);
      g.generateTexture('player-idle', W, H);
      g.destroy();
    }
  }

  // ── Enemies ───────────────────────────────────────────────────────────────

  static createEnemyTexture(scene: Phaser.Scene, key: string, primaryColor: number, accentColor: number): void {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    // Ghost blob body
    g.fillStyle(primaryColor, 0.9);
    g.fillEllipse(8, 9, 12, 11);

    // "Wavy" bottom (pixel art)
    g.fillStyle(primaryColor, 0.9);
    g.fillRect(3, 12, 2, 3);
    g.fillRect(7, 13, 2, 2);
    g.fillRect(11, 12, 2, 3);

    // Eyes glow
    g.fillStyle(accentColor);
    g.fillRect(5, 7, 2, 2);
    g.fillRect(9, 7, 2, 2);

    // Dark pupils
    g.fillStyle(0x000000);
    g.fillRect(6, 8, 1, 1);
    g.fillRect(10, 8, 1, 1);

    g.generateTexture(key, 16, 16);
    g.destroy();
  }

  static createAllEnemyTextures(scene: Phaser.Scene): void {
    // Static Noise – electric cyan
    TextureFactory.createEnemyTexture(scene, 'enemy-static-noise', 0x006699, 0x00ffff);
    // Broken Signal – red distortion
    TextureFactory.createEnemyTexture(scene, 'enemy-broken-signal', 0x8b1a1a, 0xff4444);
    // Silence – deep purple void
    TextureFactory.createEnemyTexture(scene, 'enemy-silence', 0x2d0050, 0xcc44ff);
  }

  // ── Boss ──────────────────────────────────────────────────────────────────

  static createBossTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists('boss-gatekeeper')) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    // Cloak base
    g.fillStyle(0x1a0030);
    g.fillRect(4, 10, 24, 22);

    // Cloak highlights
    g.fillStyle(0x3d0080);
    g.fillRect(4, 10, 3, 22);
    g.fillRect(25, 10, 3, 22);

    // Head / hood
    g.fillStyle(0x0a0018);
    g.fillRect(8, 2, 16, 12);

    // Hood shadow
    g.fillStyle(0x000000);
    g.fillRect(10, 4, 12, 8);

    // Glowing eyes
    g.fillStyle(0xffd700);
    g.fillRect(10, 7, 4, 3);
    g.fillRect(18, 7, 4, 3);

    // Pupils
    g.fillStyle(0xff8800);
    g.fillRect(11, 8, 2, 1);
    g.fillRect(19, 8, 2, 1);

    // Gold trim on cloak
    g.fillStyle(0xffd700);
    g.fillRect(4, 10, 24, 2);
    g.fillRect(4, 30, 24, 2);
    g.fillRect(14, 10, 4, 22);  // center stripe

    // Hands / orbs
    g.fillStyle(0x8800ff);
    g.fillCircle(2, 22, 3);
    g.fillCircle(30, 22, 3);

    // Orb glow
    g.fillStyle(0xcc44ff, 0.6);
    g.fillCircle(2, 21, 2);
    g.fillCircle(30, 21, 2);

    g.generateTexture('boss-gatekeeper', 32, 32);
    g.destroy();

    // Phase 2 – brighter
    const g2 = scene.make.graphics({ x: 0, y: 0 }, false);
    g2.fillStyle(0x2d0050);
    g2.fillRect(4, 10, 24, 22);
    g2.fillStyle(0x6600cc);
    g2.fillRect(4, 10, 3, 22);
    g2.fillRect(25, 10, 3, 22);
    g2.fillStyle(0x1a003a);
    g2.fillRect(8, 2, 16, 12);
    g2.fillStyle(0x0d001a);
    g2.fillRect(10, 4, 12, 8);
    g2.fillStyle(0xffaa00);
    g2.fillRect(10, 7, 4, 3);
    g2.fillRect(18, 7, 4, 3);
    g2.fillStyle(0xff4400);
    g2.fillRect(11, 8, 2, 1);
    g2.fillRect(19, 8, 2, 1);
    g2.fillStyle(0xffaa00);
    g2.fillRect(4, 10, 24, 2);
    g2.fillRect(4, 30, 24, 2);
    g2.fillRect(14, 10, 4, 22);
    g2.fillStyle(0xff00ff);
    g2.fillCircle(2, 22, 3);
    g2.fillCircle(30, 22, 3);
    g2.generateTexture('boss-gatekeeper-phase2', 32, 32);
    g2.destroy();

    // Phase 3 – enraged
    const g3 = scene.make.graphics({ x: 0, y: 0 }, false);
    g3.fillStyle(0x3d0000);
    g3.fillRect(4, 10, 24, 22);
    g3.fillStyle(0x8b0000);
    g3.fillRect(4, 10, 3, 22);
    g3.fillRect(25, 10, 3, 22);
    g3.fillStyle(0x1a0000);
    g3.fillRect(8, 2, 16, 12);
    g3.fillStyle(0x000000);
    g3.fillRect(10, 4, 12, 8);
    g3.fillStyle(0xff0000);
    g3.fillRect(10, 7, 4, 3);
    g3.fillRect(18, 7, 4, 3);
    g3.fillStyle(0xff6600);
    g3.fillRect(11, 8, 2, 1);
    g3.fillRect(19, 8, 2, 1);
    g3.fillStyle(0xff3300);
    g3.fillRect(4, 10, 24, 2);
    g3.fillRect(4, 30, 24, 2);
    g3.fillRect(14, 10, 4, 22);
    g3.fillStyle(0xff0000);
    g3.fillCircle(2, 22, 4);
    g3.fillCircle(30, 22, 4);
    g3.generateTexture('boss-gatekeeper-phase3', 32, 32);
    g3.destroy();
  }

  // ── Tiles ─────────────────────────────────────────────────────────────────

  static createTileTextures(scene: Phaser.Scene): void {
    const makeTile = (key: string, drawFn: (g: Phaser.GameObjects.Graphics) => void) => {
      if (scene.textures.exists(key)) return;
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      drawFn(g);
      g.generateTexture(key, 16, 16);
      g.destroy();
    };

    // Grass
    makeTile('tile-grass', g => {
      g.fillStyle(0x2d5a1b);
      g.fillRect(0, 0, 16, 16);
      // Texture variation
      g.fillStyle(0x3a7025, 0.4);
      g.fillRect(2, 3, 3, 2);
      g.fillRect(10, 8, 2, 3);
      g.fillRect(6, 12, 4, 2);
    });

    // Path / dirt
    makeTile('tile-path', g => {
      g.fillStyle(0x8b7355);
      g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x7a6245, 0.5);
      g.fillRect(3, 5, 2, 2);
      g.fillRect(10, 2, 3, 1);
      g.fillRect(7, 11, 2, 2);
    });

    // Wall / rock
    makeTile('tile-wall', g => {
      g.fillStyle(0x3d3d4a);
      g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x555565);
      g.fillRect(1, 1, 6, 6);
      g.fillRect(9, 1, 6, 6);
      g.fillRect(1, 9, 6, 6);
      g.fillRect(9, 9, 6, 6);
      g.fillStyle(0x2a2a35);
      g.fillRect(7, 0, 2, 16);
      g.fillRect(0, 7, 16, 2);
    });

    // Boss arena floor (dark stone)
    makeTile('tile-arena', g => {
      g.fillStyle(0x0a0a14);
      g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x1a1a28, 0.8);
      g.fillRect(0, 0, 8, 8);
      g.fillRect(8, 8, 8, 8);
      g.fillStyle(0x0d0d1f);
      g.fillRect(8, 0, 8, 8);
      g.fillRect(0, 8, 8, 8);
      // Red accent cracks
      g.fillStyle(0x3d0808, 0.4);
      g.fillRect(4, 7, 8, 1);
      g.fillRect(7, 4, 1, 8);
    });

    // Gate (locked)
    makeTile('tile-gate', g => {
      g.fillStyle(0x4a3800);
      g.fillRect(0, 0, 16, 16);
      g.fillStyle(0xffd700);
      g.fillRect(1, 1, 14, 14);
      g.fillStyle(0x4a3800);
      g.fillRect(3, 3, 10, 10);
      g.fillStyle(0xffd700);
      g.fillRect(7, 0, 2, 16);
      g.fillRect(0, 7, 16, 2);
    });

    // Gate (open)
    makeTile('tile-gate-open', g => {
      g.fillStyle(0x2d5a1b);
      g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x3a7025, 0.3);
      g.fillRect(4, 4, 8, 8);
    });

    // Water / decorative
    makeTile('tile-water', g => {
      g.fillStyle(0x1a3a6e);
      g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x2a5aa0, 0.5);
      g.fillRect(2, 4, 12, 2);
      g.fillRect(4, 10, 8, 2);
    });

    // Sign / NPC marker
    makeTile('tile-sign', g => {
      g.fillStyle(0x5a3000);
      g.fillRect(6, 10, 4, 6);
      g.fillStyle(0x8b6000);
      g.fillRect(2, 2, 12, 9);
      g.fillStyle(0xffd700);
      g.fillRect(4, 4, 8, 5);
      g.fillStyle(0x8b6000);
      g.fillRect(5, 6, 6, 1);
    });
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  static createItemTextures(scene: Phaser.Scene): void {
    // Sound Fragment (XP collectible) — small glowing note
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

    // Lost Track (the reward) — glowing audio crystal
    if (!scene.textures.exists('item-lost-track')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);

      // Outer glow (soft, large)
      g.fillStyle(0x00ffff, 0.15);
      g.fillCircle(16, 16, 14);

      // Crystal body
      g.fillStyle(0x00ccff);
      g.fillTriangle(16, 4, 8, 18, 24, 18);

      // Crystal inner highlight
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

    // NPC marker
    if (!scene.textures.exists('npc-guide')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      // Body
      g.fillStyle(0x886633);
      g.fillRect(5, 7, 6, 7);
      // Head
      g.fillStyle(0xf4c07a);
      g.fillRect(5, 2, 6, 5);
      // Hair
      g.fillStyle(0x5a3000);
      g.fillRect(5, 2, 6, 2);
      // Eyes
      g.fillStyle(0x1a0a2e);
      g.fillRect(6, 4, 1, 1);
      g.fillRect(9, 4, 1, 1);
      // Robe accent
      g.fillStyle(0xffd700);
      g.fillRect(5, 8, 6, 1);
      // Legs
      g.fillStyle(0x4a2800);
      g.fillRect(5, 13, 3, 3);
      g.fillRect(8, 13, 3, 3);
      g.generateTexture('npc-guide', 16, 16);
      g.destroy();
    }
  }

  // ── UI Elements ───────────────────────────────────────────────────────────

  static createUITextures(scene: Phaser.Scene): void {
    // Battle background panel
    if (!scene.textures.exists('ui-battle-bg')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x0a0018, 0.95);
      g.fillRect(0, 0, 640, 480);
      // Top decorative line
      g.fillStyle(0xffd700);
      g.fillRect(0, 0, 640, 3);
      g.fillRect(0, 477, 640, 3);
      g.generateTexture('ui-battle-bg', 640, 480);
      g.destroy();
    }

    // HP bar fill
    if (!scene.textures.exists('ui-hp-fill')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xe03030);
      g.fillRect(0, 0, 100, 10);
      g.fillStyle(0xff6060);
      g.fillRect(0, 0, 100, 3);
      g.generateTexture('ui-hp-fill', 100, 10);
      g.destroy();
    }

    // MP bar fill
    if (!scene.textures.exists('ui-mp-fill')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x4080ff);
      g.fillRect(0, 0, 100, 10);
      g.fillStyle(0x80b0ff);
      g.fillRect(0, 0, 100, 3);
      g.generateTexture('ui-mp-fill', 100, 10);
      g.destroy();
    }

    // Attack button base
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

    // Attack button hover
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

  /** Call this once in PreloadScene to generate all textures. */
  static generateAll(scene: Phaser.Scene): void {
    TextureFactory.createTileTextures(scene);
    TextureFactory.createPlayerTextures(scene);
    TextureFactory.createAllEnemyTextures(scene);
    TextureFactory.createBossTextures(scene);
    TextureFactory.createItemTextures(scene);
    TextureFactory.createUITextures(scene);
  }
}
