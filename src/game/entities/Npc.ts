import Phaser from 'phaser';
import { NPC_TEXTURES, type NpcDirection, type NpcId } from '../assets/NpcTextures';

const NPC_SPEED = 24;
const NPC_SCALE = 0.105;
const FRAME_SIZE = 313;
const FOOT_BASELINE = 291;
const BODY_WIDTH = 116;
const BODY_HEIGHT = 70;

export interface NpcPatrolArea {
  radiusX: number;
  radiusY: number;
}

export class Npc extends Phaser.Physics.Arcade.Sprite {
  readonly npcId: NpcId;

  private readonly homeX: number;
  private readonly homeY: number;
  private readonly patrol: NpcPatrolArea;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private direction: NpcDirection = 'down';
  private currentFrame = 0;
  private frameTimer = 0;
  private decisionTimer = 0;
  private walking = false;
  private scriptedWalking = false;
  private scriptedTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    npcId: NpcId,
    patrol: NpcPatrolArea,
  ) {
    super(scene, x, y, NPC_TEXTURES[npcId].down[0]);
    this.npcId = npcId;
    this.homeX = x;
    this.homeY = y;
    this.patrol = patrol;

    this.shadow = scene.add.ellipse(x, y + 1, 18, 5, 0x110906, 0.24).setDepth(3);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(4);
    this.setOrigin(0.5, FOOT_BASELINE / FRAME_SIZE);
    this.setScale(NPC_SCALE);
    this.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(BODY_WIDTH, BODY_HEIGHT);
    body.setOffset((FRAME_SIZE - BODY_WIDTH) / 2, FOOT_BASELINE - BODY_HEIGHT);
    body.setCollideWorldBounds(true);

    this.chooseNextMotion();
  }

  update(delta: number, movementEnabled: boolean): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.scriptedWalking) {
      this.applyAnimation(delta);
      this.syncShadow();
      return;
    }

    if (!movementEnabled) {
      body.setVelocity(0, 0);
      this.walking = false;
      this.applyAnimation(delta);
      this.syncShadow();
      return;
    }

    this.decisionTimer -= delta;
    if (this.decisionTimer <= 0 || this.walkedOutsidePatrol() || this.hitObstacle(body)) {
      this.chooseNextMotion();
    }

    if (!this.walking) {
      body.setVelocity(0, 0);
    } else {
      switch (this.direction) {
        case 'left': body.setVelocity(-NPC_SPEED, 0); break;
        case 'right': body.setVelocity(NPC_SPEED, 0); break;
        case 'up': body.setVelocity(0, -NPC_SPEED); break;
        case 'down': body.setVelocity(0, NPC_SPEED); break;
      }
    }

    this.applyAnimation(delta);
    this.syncShadow();
  }

  faceToward(x: number, y: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    this.direction = Math.abs(dx) > Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');
    this.walking = false;
    this.currentFrame = 0;
    this.frameTimer = 0;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.setTexture(NPC_TEXTURES[this.npcId][this.direction][0]);
  }

  stopPatrol(): void {
    this.walking = false;
    this.currentFrame = 0;
    this.frameTimer = 0;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.setTexture(NPC_TEXTURES[this.npcId][this.direction][0]);
    this.syncShadow();
  }

  walkScriptedTo(
    x: number,
    y: number,
    duration: number,
    onComplete?: () => void,
  ): void {
    this.scriptedTween?.stop();

    const dx = x - this.x;
    const dy = y - this.y;
    this.direction = Math.abs(dx) > Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');
    this.scriptedWalking = true;
    this.walking = true;
    this.frameTimer = 0;
    this.currentFrame = 0;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;

    this.scriptedTween = this.scene.tweens.add({
      targets: this,
      x,
      y,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.syncShadow(),
      onComplete: () => {
        this.scriptedTween = undefined;
        this.scriptedWalking = false;
        this.walking = false;
        this.frameTimer = 0;
        this.currentFrame = 0;
        body.enable = true;
        body.reset(this.x, this.y);
        this.setTexture(NPC_TEXTURES[this.npcId][this.direction][0]);
        this.syncShadow();
        onComplete?.();
      },
    });
  }

  destroy(fromScene?: boolean): void {
    this.scriptedTween?.stop();
    this.shadow.destroy();
    super.destroy(fromScene);
  }

  private chooseNextMotion(): void {
    if (this.x <= this.homeX - this.patrol.radiusX) {
      this.startWalking('right');
      return;
    }
    if (this.x >= this.homeX + this.patrol.radiusX) {
      this.startWalking('left');
      return;
    }
    if (this.y <= this.homeY - this.patrol.radiusY) {
      this.startWalking('down');
      return;
    }
    if (this.y >= this.homeY + this.patrol.radiusY) {
      this.startWalking('up');
      return;
    }

    const options: Array<NpcDirection | 'idle'> = ['idle', 'idle', 'left', 'right', 'up', 'down'];

    const choice = Phaser.Utils.Array.GetRandom(options);
    this.walking = choice !== 'idle';
    if (choice !== 'idle') this.direction = choice;
    this.decisionTimer = this.walking
      ? Phaser.Math.Between(650, 1450)
      : Phaser.Math.Between(900, 2100);
  }

  private startWalking(direction: NpcDirection): void {
    this.direction = direction;
    this.walking = true;
    this.decisionTimer = Phaser.Math.Between(650, 1100);
  }

  private walkedOutsidePatrol(): boolean {
    if (this.direction === 'left' && this.x <= this.homeX - this.patrol.radiusX) return true;
    if (this.direction === 'right' && this.x >= this.homeX + this.patrol.radiusX) return true;
    if (this.direction === 'up' && this.y <= this.homeY - this.patrol.radiusY) return true;
    return this.direction === 'down' && this.y >= this.homeY + this.patrol.radiusY;
  }

  private hitObstacle(body: Phaser.Physics.Arcade.Body): boolean {
    return body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down;
  }

  private applyAnimation(delta: number): void {
    if (this.walking) {
      this.frameTimer += delta;
      if (this.frameTimer >= 170) {
        this.frameTimer = 0;
        this.currentFrame = (this.currentFrame + 1) % 4;
      }
    } else {
      this.frameTimer = 0;
      this.currentFrame = 0;
    }

    this.setTexture(NPC_TEXTURES[this.npcId][this.direction][this.currentFrame]);
  }

  private syncShadow(): void {
    this.shadow.setPosition(this.x, this.y + 1);
  }
}
