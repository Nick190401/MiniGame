import Phaser from 'phaser';
import { NPC_TEXTURES, type NpcDirection, type NpcId } from '../assets/NpcTextures';
import { WALK_FRAMES } from '../assets/PlayerTextures';
import { CHARACTER_FRAME, CHARACTER_TEXELS } from '../art/characters';
import { SpriteShadow } from '../art/castShadow';
import { TEXEL } from '../render/RenderScale';
import { FX } from '../art/fx';

const NPC_SPEED = 24;
const NPC_SCALE = 1 / TEXEL;
// Unhurried pace: a full stride takes ~800 ms.
const WALK_FRAME_MS = 190;
// Collision footprint in world units, converted to texture space for Arcade.
const BODY_WIDTH = 12.18 * TEXEL;
const BODY_HEIGHT = 7.35 * TEXEL;

export interface NpcPatrolArea {
  radiusX: number;
  radiusY: number;
}

export class Npc extends Phaser.Physics.Arcade.Sprite {
  readonly npcId: NpcId;

  private readonly homeX: number;
  private readonly homeY: number;
  private readonly patrol: NpcPatrolArea;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly castShadow: SpriteShadow;
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

    this.shadow = scene.add.image(x, y + 1, FX.shadow).setDisplaySize(16, 5.6).setAlpha(0.5).setDepth(3);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(5 + y / 10000);
    this.setOrigin(CHARACTER_FRAME.footX / CHARACTER_FRAME.w, CHARACTER_FRAME.footY / CHARACTER_FRAME.h);
    this.setScale(NPC_SCALE);
    this.castShadow = new SpriteShadow(scene, this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(BODY_WIDTH, BODY_HEIGHT);
    body.setOffset(CHARACTER_FRAME.footX * CHARACTER_TEXELS - BODY_WIDTH / 2, CHARACTER_FRAME.footY * CHARACTER_TEXELS - BODY_HEIGHT);
    body.setCollideWorldBounds(true);
    // Keep patrol movement and wall collisions, but reject pushes from the player.
    this.setPushable(false);

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
    // On scene shutdown the display list destroys the shadows itself.
    if (!fromScene) {
      this.shadow.destroy();
      this.castShadow.destroy();
    }
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
      if (this.currentFrame === 0) this.currentFrame = 1;
      this.frameTimer += delta;
      if (this.frameTimer >= WALK_FRAME_MS) {
        this.frameTimer = 0;
        this.currentFrame = (this.currentFrame % WALK_FRAMES) + 1;
      }
    } else {
      this.frameTimer = 0;
      this.currentFrame = 0;
    }

    this.setTexture(NPC_TEXTURES[this.npcId][this.direction][this.currentFrame]);
  }

  private syncShadow(): void {
    // Same foot-position depth band as the player and foreground grass.
    this.setDepth(5 + this.y / 10000);
    this.shadow.setPosition(this.x, this.y + 1);
    this.castShadow.sync();
  }
}
