import Phaser from 'phaser';
import { MobileInput } from '../input/MobileInput';
import { PLAYER_TEXTURES, WALK_FRAMES, type PlayerDirection } from '../assets/PlayerTextures';
import { CHARACTER_FRAME, CHARACTER_TEXELS } from '../art/characters';
import { TEXEL } from '../render/RenderScale';

const SPEED = 120;
// One full stride (all walk frames) every ~560 ms at walking speed.
const WALK_FRAME_MS = 70;
const WORLD_MODEL_SCALE = 1 / TEXEL;
// Collision footprint in world units, converted to texture space for Arcade.
const BODY_WIDTH = 9.45 * TEXEL;
const BODY_HEIGHT = 5.775 * TEXEL;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private lastDirection: PlayerDirection = 'down';
  private frameTimer = 0;
  private currentFrame = 0;
  private moving = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, PLAYER_TEXTURES.down[0]);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(5 + y / 10000);
    this.setScale(WORLD_MODEL_SCALE);
    this.setOrigin(CHARACTER_FRAME.footX / CHARACTER_FRAME.w, CHARACTER_FRAME.footY / CHARACTER_FRAME.h);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(BODY_WIDTH, BODY_HEIGHT);
    // Keep the collision footprint anchored beneath the feet for every pose.
    body.setOffset(CHARACTER_FRAME.footX * CHARACTER_TEXELS - BODY_WIDTH / 2, CHARACTER_FRAME.footY * CHARACTER_TEXELS - BODY_HEIGHT);
    this.applyVisualFrame('down', 0);
    body.setCollideWorldBounds(true);

    // Keyboard setup
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = {
        up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }
  }

  update(delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    // Only the most recently pressed direction is accepted. Holding W and then
    // pressing A therefore switches to left instead of creating diagonal motion.
    const activeDirection = this.resolveActiveDirection();
    if (activeDirection) {
      this.lastDirection = activeDirection;
      switch (activeDirection) {
        case 'left': vx = -SPEED; break;
        case 'right': vx = SPEED; break;
        case 'up': vy = -SPEED; break;
        case 'down': vy = SPEED; break;
      }
    }

    body.setVelocity(vx, vy);
    this.moving = vx !== 0 || vy !== 0;

    // Frame 0 is the standing pose; walking loops through frames 1..WALK_FRAMES.
    if (this.moving) {
      if (this.currentFrame === 0) this.currentFrame = 1;
      this.frameTimer += delta;
      if (this.frameTimer > WALK_FRAME_MS) {
        this.frameTimer = 0;
        this.currentFrame = (this.currentFrame % WALK_FRAMES) + 1;
      }
      this.applyVisualFrame(this.lastDirection, this.currentFrame);
    } else {
      this.currentFrame = 0;
      this.frameTimer = 0;
      this.applyVisualFrame(this.lastDirection, 0);
    }
  }

  private resolveActiveDirection(): PlayerDirection | null {
    const keyboardInputs: Array<{
      direction: PlayerDirection;
      keys: Array<Phaser.Input.Keyboard.Key | undefined>;
    }> = [
      { direction: 'up', keys: [this.cursors?.up, this.wasd?.up] },
      { direction: 'down', keys: [this.cursors?.down, this.wasd?.down] },
      { direction: 'left', keys: [this.cursors?.left, this.wasd?.left] },
      { direction: 'right', keys: [this.cursors?.right, this.wasd?.right] },
    ];

    let newestDirection: PlayerDirection | null = null;
    let newestPressTime = -1;
    keyboardInputs.forEach(({ direction, keys }) => {
      keys.forEach(key => {
        if (key?.isDown && key.timeDown > newestPressTime) {
          newestDirection = direction;
          newestPressTime = key.timeDown;
        }
      });
    });
    if (newestDirection) return newestDirection;

    // Touch controls are mutually exclusive as well; this is a defensive
    // fallback for browsers that report overlapping pointer events.
    if (MobileInput.up) return 'up';
    if (MobileInput.down) return 'down';
    if (MobileInput.left) return 'left';
    if (MobileInput.right) return 'right';
    return null;
  }

  private applyVisualFrame(direction: PlayerDirection, frame: number): void {
    this.setTexture(PLAYER_TEXTURES[direction][frame]);
  }

  getDirection(): PlayerDirection {
    return this.lastDirection;
  }

  faceToward(x: number, y: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    this.lastDirection = Math.abs(dx) > Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');
    this.moving = false;
    this.currentFrame = 0;
    this.frameTimer = 0;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.applyVisualFrame(this.lastDirection, 0);
  }

  isMoving(): boolean {
    return this.moving;
  }

  freeze(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
  }

  unfreeze(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
  }
}
