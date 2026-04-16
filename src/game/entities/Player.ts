import Phaser from 'phaser';
import { MobileInput } from '../input/MobileInput';

const SPEED = 120;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private lastDirection: 'down' | 'up' | 'left' | 'right' = 'down';
  private frameTimer = 0;
  private currentFrame = 0;
  private moving = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(5);
    this.setOrigin(0.5, 0.75);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 8);
    body.setOffset(3, 8);
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

    const up = this.cursors?.up?.isDown || this.wasd?.up?.isDown || MobileInput.up;
    const down = this.cursors?.down?.isDown || this.wasd?.down?.isDown || MobileInput.down;
    const left = this.cursors?.left?.isDown || this.wasd?.left?.isDown || MobileInput.left;
    const right = this.cursors?.right?.isDown || this.wasd?.right?.isDown || MobileInput.right;

    if (left) { vx = -SPEED; this.lastDirection = 'left'; }
    else if (right) { vx = SPEED; this.lastDirection = 'right'; }

    if (up) { vy = -SPEED; this.lastDirection = 'up'; }
    else if (down) { vy = SPEED; this.lastDirection = 'down'; }

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    body.setVelocity(vx, vy);
    this.moving = vx !== 0 || vy !== 0;

    // Flip for left direction
    this.setFlipX(this.lastDirection === 'left');

    // 4-frame walk cycle: 0 → 1 → 2 → 3 → 0 (stand → stride L → stand → stride R)
    if (this.moving) {
      this.frameTimer += delta;
      if (this.frameTimer > 140) {
        this.frameTimer = 0;
        this.currentFrame = (this.currentFrame + 1) % 4;
      }
      const dir = this.lastDirection === 'left' ? 'right' : this.lastDirection;
      this.setTexture(`player-${dir}-${this.currentFrame}`);
    } else {
      this.currentFrame = 0;
      this.frameTimer = 0;
      const dir = this.lastDirection === 'left' ? 'right' : this.lastDirection;
      this.setTexture(`player-${dir}-0`);
    }
  }

  getDirection(): 'down' | 'up' | 'left' | 'right' {
    return this.lastDirection;
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
