import Phaser from 'phaser';
import { MobileInput } from '../input/MobileInput';
import { PLAYER_TEXTURES, type PlayerDirection } from '../assets/PlayerTextures';

const SPEED = 120;
const WORLD_MODEL_SCALE = 0.105;

// Subject centre and foot baseline inside each standalone 313px texture.
const PLAYER_ORIGINS: Record<PlayerDirection, ReadonlyArray<readonly [number, number]>> = {
  down: [[169, 291], [157, 291], [151, 291], [148, 291]],
  up: [[167, 281], [157, 281], [149, 281], [146, 281]],
  left: [[157, 263], [154, 261], [145, 263], [141, 261]],
  right: [[162, 239], [141, 239], [152, 239], [141, 239]],
};

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

    this.setDepth(5);
    this.setScale(WORLD_MODEL_SCALE);
    this.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(90, 55);
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

    // 4-frame walk cycle: 0 → 1 → 2 → 3 → 0 (stand → stride L → stand → stride R)
    if (this.moving) {
      this.frameTimer += delta;
      if (this.frameTimer > 140) {
        this.frameTimer = 0;
        this.currentFrame = (this.currentFrame + 1) % 4;
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
    const [centerX, baselineY] = PLAYER_ORIGINS[direction][frame];
    this.setOrigin(centerX / 313, baselineY / 313);

    // Keep the collision footprint anchored beneath the feet for every pose.
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setOffset(centerX - 45, baselineY - 55);
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
