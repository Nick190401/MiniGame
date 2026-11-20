import Phaser from 'phaser';
import { logicalSize, useLogicalCamera } from '../render/RenderScale';
import { EventBus, EVENTS, type BattleUiPayload } from '../EventBus';
import { useGameStore } from '../../store/gameStore';
import { ATTACKS, applyDamageVariance } from '../systems/AttackSystem';
import { BOSS_DEFINITION } from '../entities/Enemy';
import { BOSS_PHASES } from '../entities/Boss';
import { createBattleFxTextures } from '../art/battleFx';
import { BATTLE_HERO_SCALE } from '../art/characters';
import { BattleFx } from '../battle/BattleFx';
import { Combatant } from '../battle/Combatant';
import type { Hit, MoveContext, MoveScript } from '../battle/moves';
import { PLAYER_MOVES, heroCutIn, heroWindup } from '../battle/playerMoves';
import { enemyMove, foeTelegraph } from '../battle/enemyMoves';
import { enrage, unleash } from '../battle/bossPhases';
import { heroDefeat } from '../battle/defeat';
import { foeDefeat, heroLevelUp } from '../battle/victory';
import type { EnemyData, EnemyAttack, Attack } from '../../types/game.types';

type TurnState = 'intro' | 'player-choose' | 'player-attack' | 'enemy-attack' | 'phase-change' | 'battle-end';

/** What a move reports back to the turn logic. */
interface StrikeHooks {
  hit(share: number, hit: Hit): void;
  /** The target has no HP left. */
  down(): boolean;
  done(): void;
}

/** Longest any move may run before the turn moves on regardless. */
const MOVE_TIMEOUT_MS = 6000;

/** Above every effect: the opaque floor under the arena hides whatever falls past it. */
const FLOOR_DEPTH = 40;

/**
 * The portrait sky band sits over the effects' dim and vignettes (4.55–4.65),
 * so those darken the painted arena only, not the flat band above it.
 */
const SKY_DEPTH = 4.7;

/** Bounding box of a texture's non-transparent pixels, in source-image space. */
interface ContentBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}

// Attack‑type icons drawn as small pixel glyphs
const ATTACK_ICONS: Record<string, string[]> = {
  'bass-drop':    ['  ██  ', ' ████ ', '██████', '██████', ' ████ ', '  ██  '],
  'echo-wave':    ['█     ', '██    ', '███   ', '███   ', '██    ', '█     '],
  'hook-impact':  ['    ██', '   ██ ', '  ██  ', ' ██   ', '██    ', '██████'],
  'reverb-strike':['██████', '█    █', '█ ██ █', '█ ██ █', '█    █', '██████'],
};

/** The hero's three-quarter battle stance, facing the opponent. */
const PLAYER_BATTLE_TEXTURE = 'player-battle-stance';

export class BattleScene extends Phaser.Scene {
  // Battle data
  private enemyData!: EnemyData;
  private isBoss = false;
  private currentEnemyHp = 0;
  private bossPhaseIndex = 0;
  /** The phase whose form is on screen; it changes on the transformation frame. */
  private shownPhaseIndex = 0;
  /** Fades the DOM battle controls out while a defeat plays. */
  private uiFading = false;

  // UI references
  private enemySprite!: Phaser.GameObjects.Sprite;
  private playerSprite!: Phaser.GameObjects.Sprite;
  /** Holds the hero for the idle motion, so attack tweens keep the sprite to themselves. */
  private playerRig?: Phaser.GameObjects.Container;
  private playerFeet = { x: 0, y: 0 };
  private playerIdleWeight = 0;
  /** Holds the opponent so blows can displace it while its idle bob runs on the sprite. */
  private enemyRig?: Phaser.GameObjects.Container;
  private fx?: BattleFx;
  private hero?: Combatant;
  private foe?: Combatant;
  private heroJitter = { x: 0, y: 0 };
  private enemyHpBar!: Phaser.GameObjects.Graphics;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private enemyHpText!: Phaser.GameObjects.Text;
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyNameText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private attackButtons: { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; attack: Attack; unlocked: boolean }[] = [];
  private messageText!: Phaser.GameObjects.Text;
  private msgContinueIndicator!: Phaser.GameObjects.Text;
  private turnStatusText!: Phaser.GameObjects.Text;

  // HP bar layout
  private ehpBarX = 0; private ehpBarY = 0; private ehpBarW = 0; private ehpBarH = 0;
  private phpBarX = 0; private phpBarY = 0; private phpBarW = 0; private phpBarH = 0;

  // Layout refs for animations
  private enemyPlatform = { x: 0, y: 0 };
  private enemyTargetHeight = 0;

  // Arena/controls split, as fractions of the canvas, handed to the DOM
  // overlay so both halves of the battle UI stay in step at any aspect ratio.
  private uiLayout = { arena: 0.6, messageTop: 0.6, messageHeight: 0.1375, menuTop: 0.7458 };

  // Ambient particles
  private ambientParticles: Phaser.GameObjects.Graphics[] = [];
  private enemyEffects = new Set<Phaser.GameObjects.Graphics>();
  private enemyEffectTimers = new Set<Phaser.Time.TimerEvent>();
  private enemyEffectTweens = new Set<Phaser.Tweens.Tween>();

  // Opaque-pixel bounds per texture, so characters can be sized and planted
  // by what is actually *visible* rather than by their padded canvas.
  private static contentBoundsCache = new Map<string, ContentBounds>();

  // Typewriter state
  private typewriterTimer?: Phaser.Time.TimerEvent;
  private fullMessageText = '';
  private messageReady = false;

  // State
  private turnState: TurnState = 'intro';
  private inputBlocked = true;

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: { enemyData: EnemyData; isBoss: boolean }): void {
    this.enemyData = data.isBoss ? BOSS_DEFINITION : data.enemyData;
    this.isBoss = data.isBoss;
    this.currentEnemyHp = this.enemyData.maxHp;
    this.bossPhaseIndex = 0;
    this.shownPhaseIndex = 0;
    this.uiFading = false;
    this.attackButtons = [];
    this.ambientParticles = [];
    this.turnState = 'intro';
    this.inputBlocked = true;
    this.messageReady = false;
  }

  create(): void {
    useLogicalCamera(this);
    const { width: W, height: H } = logicalSize(this);
    EventBus.emit(EVENTS.BATTLE_START, { enemyId: this.enemyData.id, isBoss: this.isBoss });

    // ── Background art ───────────────────────────────────────────────────
    // Hand-painted arenas (one per encounter type). In landscape the artwork
    // is cover-fitted to the arena. Whatever overflows is cropped:
    // horizontally from both sides (centred), and vertically by `cropTopSrc`,
    // which picks which slice of the source survives. That is deliberately
    // per-artwork — the boss dais sits high in its piece, so cropping the top
    // there would eat exactly the headroom its tall silhouette needs and clip
    // the creature.
    // Platform centres measured off the artwork itself, as fractions of the
    // source. Combatants are anchored to these instead of generic layout
    // percentages, and sized against them for correct perspective. Fractions,
    // not pixels, so the numbers survive the artwork being re-exported at a
    // different resolution.
    const arena = this.isBoss
      ? {
        key: 'battle-bg-boss',
        cropTop: 0,
        enemy: { x: 0.645, y: 0.37 },
        player: { x: 0.26, y: 0.68 },
      }
      : {
        key: 'battle-bg-normal',
        cropTop: 0.064,
        enemy: { x: 0.69, y: 0.485 },
        player: { x: 0.335, y: 0.715 },
      };

    // Measured off the decoded texture rather than hard-coded, because the
    // browser is the one that decides how big the image actually is. Safari
    // halves the resolution of a PNG carrying an EXIF block, for instance —
    // assuming the authoring size there left the arena drawn at half scale
    // with the paused overworld showing through the gap.
    // The arena streams in after the world opens (see AssetStream.ts); if it
    // failed to arrive, lay out at the authoring size and paint a stand-in.
    const hasArenaArt = this.textures.exists(arena.key);
    const bgSource = hasArenaArt ? this.textures.get(arena.key).getSourceImage() : undefined;
    const BG_SRC_W = bgSource?.width || 1672;
    const BG_SRC_H = bgSource?.height || 941;

    // A phone in portrait is roughly twice as tall as it is wide — far taller
    // than the 16:9 artwork. Cover-fitting there would throw away half the
    // painting's width, so portrait fits the art to the full width instead and
    // sits it on the arena floor, with a sky band filling the space above.
    const isPortrait = H > W * 1.05;
    // Mild overscan so the portrait arena still has some height to it. Both
    // platforms sit between 0.24 and 0.70 across the source, so trimming ~11%
    // off each side never crowds a combatant.
    const PORTRAIT_ART_OVERSCAN = 1.22;

    // ── Layout constants ──────────────────────────────────────────────────
    // Landscape gives the encounter clear visual priority: the DOM controls
    // below are compact so the arena owns roughly 60% of the screen. Portrait
    // only needs the arena tall enough for the art plus a HUD band above it,
    // and hands the rest of the tall screen to the touch controls.
    const bgScale = isPortrait
      ? (W / BG_SRC_W) * PORTRAIT_ART_OVERSCAN
      : Math.max(W / BG_SRC_W, (H * 0.60) / BG_SRC_H);
    const bgScaledW = BG_SRC_W * bgScale;
    const bgScaledH = BG_SRC_H * bgScale;
    const BATTLE_H   = isPortrait
      ? Math.round(Math.min(Math.max(H * 0.56, bgScaledH), bgScaledH + H * 0.16))
      : Math.floor(H * 0.60);
    const MSG_Y      = BATTLE_H;
    const MSG_H      = Math.max(66, Math.round(H * 0.11));
    const MENU_Y     = MSG_Y + MSG_H + 4;
    const MENU_H     = H - MENU_Y - 4;
    this.uiLayout = {
      arena: BATTLE_H / H,
      messageTop: MSG_Y / H,
      messageHeight: MSG_H / H,
      menuTop: MENU_Y / H,
    };

    const bgOffsetX = (W - bgScaledW) / 2;
    const bgMaxCropSrc = Math.max(0, BG_SRC_H - BATTLE_H / bgScale);
    const bgCropTopSrc = Phaser.Math.Clamp(arena.cropTop * BG_SRC_H, 0, bgMaxCropSrc);
    const bgOffsetY = isPortrait ? BATTLE_H - bgScaledH : -bgCropTopSrc * bgScale;

    // The overworld keeps rendering underneath a paused scene, so the arena
    // gets its own opaque ground first. Without it, anything the artwork
    // fails to cover — a re-exported image, a browser that decodes it small —
    // shows the map through the fight.
    this.add.rectangle(0, 0, W, H, 0x0a0605).setOrigin(0, 0).setDepth(-1);

    // Sky band: keeps the portrait artwork from floating on flat black, and
    // gives the enemy status panel a surface to sit on.
    if (bgOffsetY > 0) {
      const sky = this.add.graphics().setDepth(SKY_DEPTH);
      sky.fillGradientStyle(0x0a0605, 0x0a0605, 0x1c100b, 0x1c100b, 1, 1, 1, 1);
      sky.fillRect(0, 0, W, Math.ceil(bgOffsetY) + 2);
    }

    if (hasArenaArt) {
      this.add.image(bgOffsetX, bgOffsetY, arena.key).setOrigin(0, 0).setScale(bgScale).setDepth(0);
    } else {
      const [top, bottom, floor] = this.isBoss ? [0x14070b, 0x2b1013, 0x3a1a18] : [0x0d1610, 0x2a2a1c, 0x3b3523];
      const stand = this.add.graphics().setDepth(0);
      stand.fillGradientStyle(top, top, bottom, bottom, 1, 1, 1, 1);
      stand.fillRect(bgOffsetX, bgOffsetY, bgScaledW, bgScaledH);
      for (const spot of [arena.enemy, arena.player]) {
        stand.fillStyle(floor, 0.9);
        stand.fillEllipse(bgOffsetX + spot.x * bgScaledW, bgOffsetY + spot.y * bgScaledH, bgScaledW * 0.26, bgScaledH * 0.09);
      }
    }

    // Feather the top edge of the artwork into that band so the join reads as
    // haze rather than a cut.
    if (bgOffsetY > 0) {
      const seam = this.add.graphics().setDepth(SKY_DEPTH);
      seam.fillGradientStyle(0x0a0605, 0x0a0605, 0x0a0605, 0x0a0605, 0.92, 0.92, 0, 0);
      seam.fillRect(0, bgOffsetY, W, Math.min(64, bgScaledH * 0.22));
    }

    // The battle runs on top of a merely *paused* world scene, so everything
    // below the arena needs an opaque floor — otherwise the map shows through
    // the gaps between the DOM control panels, which is most of a phone screen.
    this.add.rectangle(0, BATTLE_H, W, H - BATTLE_H, 0x0a0605)
      .setOrigin(0, 0)
      .setDepth(FLOOR_DEPTH);

    const platformPoint = (p: { x: number; y: number }) => ({
      x: bgOffsetX + p.x * bgScaledW,
      y: bgOffsetY + p.y * bgScaledH,
    });
    const platformAnchors = { enemy: platformPoint(arena.enemy), player: platformPoint(arena.player) };

    // Subtle gradient overlay — darker at top, lighter at bottom of arena
    const gradient = this.add.graphics().setDepth(1);
    gradient.fillGradientStyle(0x150c09, 0x150c09, 0x0a0605, 0x0a0605, 0.26, 0.26, 0, 0);
    gradient.fillRect(0, 0, W, BATTLE_H);

    // Two-tone atmosphere: a warm glow behind the hostile signal, a cool
    // glow behind the player's side — the same confrontation mood as the
    // game's key art, echoed abstractly (and centered on the actual
    // platforms) instead of using that art directly.
    const signalColor = this.isBoss ? 0xf0362c : this.enemyData.color;
    const atmosphere = this.add.graphics().setDepth(1);
    if (!this.isBoss) {
      atmosphere.fillStyle(signalColor, 0.06);
      atmosphere.fillCircle(platformAnchors.enemy.x, platformAnchors.enemy.y, BATTLE_H * 0.55);
    }
    atmosphere.fillStyle(0x6ea8d8, 0.045);
    atmosphere.fillCircle(platformAnchors.player.x, platformAnchors.player.y, BATTLE_H * 0.45);

    this.add.text(W - 18, 14, `LIVE ENCOUNTER // ${this.isBoss ? 'TERMINAL' : 'WILD SIGNAL'}`, {
      fontFamily: 'DM Mono', fontSize: '7px', color: '#a89f99', letterSpacing: 1,
    }).setOrigin(1, 0).setDepth(3).setVisible(false);
    this.add.text(W - 18, 27, this.enemyData.id.toUpperCase().replace(/-/g, ' '), {
      fontFamily: 'Sora', fontStyle: 'bold', fontSize: '10px', color: `#${signalColor.toString(16).padStart(6, '0')}`,
    }).setOrigin(1, 0).setDepth(3).setVisible(false);


    // ── Ambient floating particles ───────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const p = this.add.graphics().setDepth(3);
      const c = this.isBoss ? [0xff2244, 0xff6644, 0xcc1133, 0xffaa44][i % 4] : [0xff7a2b, 0x6ea8d8, 0xe8b465, 0xf8ece2][i % 4];
      p.fillStyle(c, 0.3);
      p.fillCircle(0, 0, 1 + Math.random());
      const sx = Math.random() * W;
      const sy = Math.random() * BATTLE_H;
      p.setPosition(sx, sy);
      this.tweens.add({
        targets: p,
        x: sx + Phaser.Math.Between(-40, 40),
        y: sy + Phaser.Math.Between(-30, 30),
        alpha: { from: 0.15, to: 0.5 },
        duration: 3000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 2000,
      });
      this.ambientParticles.push(p);
    }

    // Ground platforms now live in the background art itself — the
    // combatants below are anchored directly to those painted circles.

    // ── Combatant sizing ────────────────────────────────────────────────
    // Sizes are driven by target on-screen height rather than per-texture
    // scale factors, so wildly different source art lands at a consistent
    // size. The enemy reads smaller than the player because its platform
    // sits further back in the artwork — that ratio is the perspective.
    // Everything is then clamped to the headroom actually available above
    // each platform, which is what guarantees nothing gets clipped.
    // Clamped to the headroom actually available above each platform, which
    // is what guarantees even the tallest silhouette stays inside the arena.
    const heightForPlatform = (anchorY: number, desired: number, topMargin: number) =>
      Math.max(24, Math.min(desired, anchorY - topMargin));

    // Sized against the artwork rather than the arena box, so a figure keeps
    // the same relation to its painted platform whatever the arena's shape.
    // Portrait fits the art small, so figures get a modest boost back to stay
    // readable on a phone.
    const figureH = bgScaledH * (isPortrait ? 1.18 : 1);

    // Use high-res battle art when available, otherwise pixel sprite
    const hasSilenceArt = this.enemyData.id === 'silence' && this.textures.exists('silence-battle');
    const hasStaticNoiseArt = this.enemyData.id === 'static-noise' && this.textures.exists('staticnoise-battle');
    const hasBrokenSignalArt = this.enemyData.id === 'broken-signal' && this.textures.exists('brokensignal-battle');
    const hasBossBattleArt = this.isBoss && this.textures.exists('boss-gatekeeper-battle-phase1');
    const enemyTexture = hasBossBattleArt ? 'boss-gatekeeper-battle-phase1'
      : hasSilenceArt ? 'silence-battle'
      : hasStaticNoiseArt ? 'staticnoise-battle'
      : hasBrokenSignalArt ? 'brokensignal-battle'
      : this.enemyData.textureKey;

    this.enemyTargetHeight = heightForPlatform(
      platformAnchors.enemy.y,
      figureH * (this.isBoss ? 0.368 : 0.248),
      10,
    );

    this.enemySprite = this.add.sprite(0, 0, enemyTexture).setDepth(5);
    this.enemySprite.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.plantOnPlatform(this.enemySprite, enemyTexture, platformAnchors.enemy, this.enemyTargetHeight);
    const enemyArtWidth = this.getContentBounds(enemyTexture).width * this.enemySprite.scaleX;
    this.enemyRig = this.add.container(0, 0, [this.enemySprite]).setDepth(5);
    if (this.isBoss) {
      const contactShadow = this.add.ellipse(
        platformAnchors.enemy.x, platformAnchors.enemy.y - 2,
        this.enemyTargetHeight * 0.72, this.enemyTargetHeight * 0.1,
        0x080e0d, 0.42,
      ).setDepth(4).setName('boss-contact-shadow');
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => contactShadow.destroy());
    }
    this.enemyPlatform = platformAnchors.enemy;
    const enemyFinalX = this.enemySprite.x;
    const enemySpriteY = this.enemySprite.y;
    this.enemySprite.x = W + 60;

    this.tweens.add({
      targets: this.enemySprite,
      x: enemyFinalX,
      duration: 600,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (this.currentEnemyHp <= 0) return;
        if (!this.isBoss) this.tweens.add({
          targets: this.enemySprite,
          y: enemySpriteY - 5,
          duration: this.isBoss ? 1800 : 1300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        // Enemy-specific ambient particles
        if (this.enemyData.id === 'silence') {
          this.spawnSilenceParticles(enemyFinalX, enemySpriteY, BATTLE_H);
        }
        if (this.enemyData.id === 'static-noise') {
          this.spawnStaticNoiseParticles(enemyFinalX, enemySpriteY, BATTLE_H);
        }
        if (this.enemyData.id === 'broken-signal') {
          this.spawnBrokenSignalParticles(enemyFinalX, enemySpriteY, BATTLE_H);
        }
      },
    });

    // ── Player sprite — slides in onto its platform ──────────────────────
    // His platform is the nearest thing in the artwork. The hero's own scale
    // comes after the headroom clamp, so it holds in every arena shape.
    const playerTargetH = heightForPlatform(platformAnchors.player.y, figureH * 0.37, 10) * BATTLE_HERO_SCALE;
    this.playerSprite = this.add.sprite(0, 0, PLAYER_BATTLE_TEXTURE).setDepth(5);
    this.plantOnPlatform(this.playerSprite, PLAYER_BATTLE_TEXTURE, platformAnchors.player, playerTargetH);
    const playerArtWidth = this.getContentBounds(PLAYER_BATTLE_TEXTURE).width * this.playerSprite.scaleX;
    this.preparePlayerBattleTexture();
    // In front of the opponent: the hero's platform is the nearest, and moves
    // like Hook Impact bring the two close together.
    this.playerRig = this.add.container(0, 0, [this.playerSprite]).setDepth(5.2);
    this.playerFeet = { x: platformAnchors.player.x, y: platformAnchors.player.y };
    this.playerIdleWeight = 0;
    const playerFinalX = this.playerSprite.x;

    // Effect textures are painted by the loader; this only covers a missed step.
    createBattleFxTextures(this);
    this.fx = new BattleFx(this, {
      arenaHeight: BATTLE_H,
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    });
    this.heroJitter = { x: 0, y: 0 };
    this.hero = new Combatant(
      this, this.playerSprite, this.playerSprite, { ...platformAnchors.player }, playerTargetH, playerArtWidth, 1,
      { x: playerFinalX, y: this.playerSprite.y },
      (x, y) => { this.heroJitter.x = x; this.heroJitter.y = y; },
    );
    this.foe = new Combatant(
      this, this.enemySprite, this.enemyRig, { ...platformAnchors.enemy }, this.enemyTargetHeight, enemyArtWidth, -1,
      { x: enemyFinalX, y: enemySpriteY },
      x => { if (this.enemySprite.active) this.enemySprite.x = (this.foe?.home.x ?? enemyFinalX) + x; },
    );

    this.playerSprite.x = -40;

    this.tweens.add({
      targets: this.playerSprite,
      x: playerFinalX,
      duration: 600,
      ease: 'Back.easeOut',
    });

    // ── Enemy info box (top LEFT — Pokémon layout) ────────────────────────
    // Phaser keeps hidden stateful controls for the animation logic. The visible
    // battle interface is rendered in React so its text stays sharp at any scale.
    const canvasUiStart = this.children.list.length;
    this.buildEnemyInfoBox(W, BATTLE_H);

    // ── Player info box (bottom RIGHT — Pokémon layout) ───────────────────
    this.buildPlayerInfoBox(W, BATTLE_H);

    // ── Message box (full-width, GBA textbox style) ───────────────────────
    this.buildMessageBox(W, MSG_Y, MSG_H);

    // ── Attack menu (2×2 grid) ────────────────────────────────────────────
    this.buildAttackMenu(MENU_Y, MENU_H);

    this.children.list.slice(canvasUiStart).forEach(gameObject => {
      (gameObject as Phaser.GameObjects.GameObject & { setVisible?: (visible: boolean) => unknown }).setVisible?.(false);
    });

    // Nothing of the overworld is visible behind an arena that fills the
    // screen, so stop drawing it for the duration — one less full map render
    // per frame on a phone, and it can never bleed into the fight.
    this.scene.setVisible(false, 'WorldScene');

    EventBus.on(EVENTS.BATTLE_UI_ACTION, this.onBattleUiAction);
    EventBus.on(EVENTS.BATTLE_UI_REQUEST, this.emitBattleUiState, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopEnemyEffects();
      this.fx?.dispose();
      this.fx = undefined;
      this.hero = undefined;
      this.foe = undefined;
      this.scene.setVisible(true, 'WorldScene');
      EventBus.off(EVENTS.BATTLE_UI_ACTION, this.onBattleUiAction);
      EventBus.off(EVENTS.BATTLE_UI_REQUEST, this.emitBattleUiState, this);
    });

    // ── Advance dialog on click/space/z ───────────────────────────────────
    this.input.on('pointerdown', () => {
      if (this.messageReady && this.turnState === 'player-choose') return;
      if (!this.messageReady) this.skipTypewriter();
    });
    this.input.keyboard?.on('keydown-SPACE', () => { if (!this.messageReady) this.skipTypewriter(); });
    this.input.keyboard?.on('keydown-Z', () => { if (!this.messageReady) this.skipTypewriter(); });
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, index) => {
      this.input.keyboard?.on(`keydown-${key}`, () => this.tryExecuteAttack(index));
    });

    // ── Start ─────────────────────────────────────────────────────────────
    this.cameras.main.fadeIn(300);
    this.setMessage(this.isBoss
      ? `${this.enemyData.name} blocks your path!`
      : `A wild ${this.enemyData.name} appears!`);

    this.time.delayedCall(1400, () => {
      this.finishBattleIntro();
    });
  }

  // ── Info boxes ──────────────────────────────────────────────────────────────

  private onBattleUiAction = (index: number): void => {
    this.tryExecuteAttack(index);
  };

  private emitBattleUiState(): void {
    if (!this.enemyData || !this.attackButtons.length) return;
    const store = useGameStore.getState();
    const turnLabels: Record<TurnState, { label: string; color: string }> = {
      'intro': { label: 'Get ready', color: '#a69485' },
      'player-choose': { label: 'Your turn', color: '#ff7a2b' },
      'player-attack': { label: 'Attacking', color: '#78b4e6' },
      'enemy-attack': { label: 'Enemy turn', color: '#ff5a4a' },
      'phase-change': { label: 'Phase change', color: '#ff5a4a' },
      'battle-end': { label: 'Battle over', color: '#a69485' },
    };
    const status = turnLabels[this.turnState];
    const enemyAccent = this.isBoss ? 0xf0362c : this.enemyData.color;
    const phase = this.isBoss ? ['Phase I', 'Phase II', 'Phase III'][this.shownPhaseIndex] : '';
    const payload: BattleUiPayload = {
      isBoss: this.isBoss,
      phase,
      fading: this.uiFading,
      layout: this.uiLayout,
      enemy: {
        name: this.enemyData.name,
        hp: this.currentEnemyHp,
        maxHp: this.enemyData.maxHp,
        accent: `#${enemyAccent.toString(16).padStart(6, '0')}`,
      },
      player: {
        name: store.playerName || 'Mr Mario',
        hp: store.hp,
        maxHp: store.maxHp,
        level: store.level,
      },
      message: this.fullMessageText,
      messageReady: this.messageReady,
      turnStatus: status.label,
      turnAccent: status.color,
      inputEnabled: this.turnState === 'player-choose' && !this.inputBlocked && this.messageReady,
      attacks: this.attackButtons.map((entry, index) => ({
        id: entry.attack.id,
        name: entry.attack.name,
        description: entry.attack.description,
        accent: `#${entry.attack.color.toString(16).padStart(6, '0')}`,
        unlocked: entry.unlocked,
        key: index + 1,
        unlockLevel: entry.attack.unlockLevel,
      })),
    };
    EventBus.emit(EVENTS.BATTLE_UI_STATE, payload);
  }

  private buildEnemyInfoBox(W: number, BATTLE_H: number): void {
    const infoBoxX = 18;
    const infoBoxY = 18;
    const infoBoxW = 286;
    const infoBoxH = 76;
    const borderColor = this.isBoss ? 0xf0362c : 0x6ea8d8;
    const infoBg = this.add.graphics().setDepth(8);
    infoBg.fillStyle(0x110906, 0.94);
    infoBg.fillRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH);
    infoBg.fillStyle(borderColor, 0.9);
    infoBg.fillRect(infoBoxX, infoBoxY, 4, infoBoxH);
    infoBg.fillRect(infoBoxX, infoBoxY, 68, 2);
    infoBg.lineStyle(1, 0x524139, 0.78);
    infoBg.strokeRect(infoBoxX + 0.5, infoBoxY + 0.5, infoBoxW - 1, infoBoxH - 1);
    infoBg.lineStyle(1, borderColor, 0.12);
    infoBg.lineBetween(infoBoxX + 10, infoBoxY + 47, infoBoxX + infoBoxW - 10, infoBoxY + 47);

    this.add.circle(infoBoxX + 16, infoBoxY + 13, 2.5, borderColor, 1).setDepth(10);
    this.add.text(infoBoxX + 25, infoBoxY + 8, 'TARGET SIGNAL // HOSTILE', {
      fontFamily: 'DM Mono', fontSize: '7px', color: '#a89f99', letterSpacing: 1,
    }).setDepth(10).setResolution(2);

    this.enemyNameText = this.add.text(infoBoxX + 12, infoBoxY + 24, this.enemyData.name.toUpperCase(), {
      fontFamily: 'Sora', fontStyle: 'bold', fontSize: '15px',
      color: this.isBoss ? '#ff8a66' : '#f8ece2', letterSpacing: 1,
    }).setDepth(10).setResolution(2);

    this.phaseText = this.add.text(infoBoxX + infoBoxW - 12, infoBoxY + 9, this.isBoss ? 'PHASE I' : 'LIVE', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: this.isBoss ? '#ff8a66' : '#6ea8d8', letterSpacing: 1,
    }).setOrigin(1, 0).setDepth(10).setResolution(2);

    this.add.text(infoBoxX + 12, infoBoxY + 59, 'HP', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: '#b6aea9', letterSpacing: 1,
    }).setDepth(10).setResolution(2);

    this.ehpBarX = infoBoxX + 43;
    this.ehpBarY = infoBoxY + 57;
    this.ehpBarW = 172;
    this.ehpBarH = 9;

    this.enemyHpBar = this.add.graphics().setDepth(10);
    this.drawHpBar(this.enemyHpBar, this.ehpBarX, this.ehpBarY, this.ehpBarW, this.ehpBarH, 1);

    this.enemyHpText = this.add.text(
      infoBoxX + infoBoxW - 12, infoBoxY + 56,
      `${this.currentEnemyHp}/${this.enemyData.maxHp}`,
      { fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '8px', color: '#f8ece2' }
    ).setOrigin(1, 0).setDepth(10).setResolution(2);
  }

  private buildPlayerInfoBox(W: number, BATTLE_H: number): void {
    const store = useGameStore.getState();
    const phpBoxW = 272;
    const phpBoxH = 74;
    const phpBoxX = W - phpBoxW - 18;
    const phpBoxY = BATTLE_H - phpBoxH - 9;

    const phpBg = this.add.graphics().setDepth(8);
    phpBg.fillStyle(0x110906, 0.94);
    phpBg.fillRect(phpBoxX, phpBoxY, phpBoxW, phpBoxH);
    phpBg.fillStyle(0x6ea8d8, 0.9);
    phpBg.fillRect(phpBoxX + phpBoxW - 4, phpBoxY, 4, phpBoxH);
    phpBg.fillRect(phpBoxX + phpBoxW - 70, phpBoxY + phpBoxH - 2, 70, 2);
    phpBg.lineStyle(1, 0x524139, 0.78);
    phpBg.strokeRect(phpBoxX + 0.5, phpBoxY + 0.5, phpBoxW - 1, phpBoxH - 1);
    phpBg.lineStyle(1, 0x6ea8d8, 0.12);
    phpBg.lineBetween(phpBoxX + 10, phpBoxY + 47, phpBoxX + phpBoxW - 10, phpBoxY + 47);

    const pName = store.playerName || 'PLAYER';
    this.add.circle(phpBoxX + 16, phpBoxY + 13, 2.5, 0x6ea8d8, 1).setDepth(10);
    this.add.text(phpBoxX + 25, phpBoxY + 8, 'PLAYER CHANNEL // ACTIVE', {
      fontFamily: 'DM Mono', fontSize: '7px', color: '#a89f99', letterSpacing: 1,
    }).setDepth(10).setResolution(2);

    this.add.text(phpBoxX + 12, phpBoxY + 24, pName.toUpperCase(), {
      fontFamily: 'Sora', fontStyle: 'bold', fontSize: '14px', color: '#f8ece2', letterSpacing: 1,
    }).setDepth(10).setResolution(2);

    this.add.text(phpBoxX + phpBoxW - 12, phpBoxY + 10, `LEVEL ${String(store.level).padStart(2, '0')}`, {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: '#ff7a2b', letterSpacing: 1,
    }).setOrigin(1, 0).setDepth(10).setResolution(2);

    this.add.text(phpBoxX + 12, phpBoxY + 58, 'HP', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: '#b6aea9', letterSpacing: 1,
    }).setDepth(10).setResolution(2);

    this.phpBarX = phpBoxX + 43;
    this.phpBarY = phpBoxY + 56;
    this.phpBarW = 158;
    this.phpBarH = 9;

    const phpFrac = Math.max(0, store.hp / store.maxHp);
    this.playerHpBar = this.add.graphics().setDepth(10);
    this.drawHpBar(this.playerHpBar, this.phpBarX, this.phpBarY, this.phpBarW, this.phpBarH, phpFrac);

    this.playerHpText = this.add.text(
      phpBoxX + phpBoxW - 12, phpBoxY + 55,
      `${store.hp}/${store.maxHp}`,
      { fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '8px', color: '#f8ece2' }
    ).setOrigin(1, 0).setDepth(10).setResolution(2);
  }

  // ── HP bar rendering (Pokémon style with rounded ends + gradient) ──────────

  private hpColor(frac: number): number {
    if (frac > 0.5) return 0x6ea8d8;
    if (frac > 0.25) return 0xff7a2b;
    return 0xf0362c;
  }

  private hpColorBright(frac: number): number {
    if (frac > 0.5) return 0xa1c8e4;
    if (frac > 0.25) return 0xffbf9a;
    return 0xff9a9f;
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number): void {
    g.clear();
    g.fillStyle(0x1b1310);
    g.fillRect(x, y, w, h);
    g.lineStyle(1, 0x493a33, 0.9);
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    if (frac > 0) {
      const fillW = Math.max(3, (w - 2) * frac);
      const color = this.hpColor(frac);
      const bright = this.hpColorBright(frac);
      g.fillStyle(color);
      g.fillRect(x + 1, y + 1, fillW, h - 2);
      g.fillStyle(bright, 0.58);
      g.fillRect(x + 1, y + 1, fillW, 2);
      g.fillStyle(0xf8ece2, 0.9);
      g.fillRect(x + Math.max(1, fillW - 1), y + 1, 2, h - 2);
    }

    g.lineStyle(1, 0x110906, 0.42);
    for (let segment = 1; segment < 10; segment++) {
      const segmentX = x + (w / 10) * segment;
      g.lineBetween(segmentX, y + 1, segmentX, y + h - 1);
    }
  }

  private updateEnemyHpBar(): void {
    const frac = Math.max(0, this.currentEnemyHp / this.enemyData.maxHp);
    this.drawHpBar(this.enemyHpBar, this.ehpBarX, this.ehpBarY, this.ehpBarW, this.ehpBarH, frac);
    this.enemyHpText.setText(`${this.currentEnemyHp}/${this.enemyData.maxHp}`);
    this.emitBattleUiState();
  }

  private updatePlayerHpBar(): void {
    const store = useGameStore.getState();
    const frac = Math.max(0, store.hp / store.maxHp);
    this.drawHpBar(this.playerHpBar, this.phpBarX, this.phpBarY, this.phpBarW, this.phpBarH, frac);
    this.playerHpText.setText(`${store.hp}/${store.maxHp}`);
    this.emitBattleUiState();
  }

  // ── Message box ─────────────────────────────────────────────────────────────

  private buildMessageBox(W: number, MSG_Y: number, MSG_H: number): void {
    const msgBg = this.add.graphics().setDepth(12);
    msgBg.fillStyle(0x0b0604, 0.99);
    msgBg.fillRect(7, MSG_Y, W - 14, MSG_H);
    msgBg.fillStyle(0xff7a2b, 0.88);
    msgBg.fillRect(7, MSG_Y, 5, MSG_H);
    msgBg.lineStyle(1, 0x493a33, 0.92);
    msgBg.strokeRect(7.5, MSG_Y + 0.5, W - 15, MSG_H - 1);
    msgBg.fillStyle(0xff7a2b, 0.035);
    msgBg.fillRect(12, MSG_Y + 1, 49, MSG_H - 2);
    msgBg.lineStyle(1, 0x513e34, 0.72);
    msgBg.lineBetween(62, MSG_Y + 1, 62, MSG_Y + MSG_H - 1);
    msgBg.lineStyle(1, 0xff7a2b, 0.16);
    msgBg.lineBetween(74, MSG_Y + 23, W - 19, MSG_Y + 23);

    // Signal portrait rail: the battle equivalent of the NPC chat portrait.
    const signalPortrait = this.add.graphics().setDepth(14).setPosition(35, MSG_Y + MSG_H / 2);
    signalPortrait.fillStyle(0xff7a2b, 0.08); signalPortrait.fillCircle(0, 0, 19);
    signalPortrait.lineStyle(2, 0xff7a2b, 0.9); signalPortrait.strokeCircle(0, 0, 11);
    signalPortrait.lineStyle(2, 0x6ea8d8, 0.78); signalPortrait.strokeCircle(0, 0, 6);
    signalPortrait.fillStyle(0xf8ece2, 0.95); signalPortrait.fillCircle(0, 0, 2);
    this.tweens.add({
      targets: signalPortrait,
      alpha: { from: 0.68, to: 1 },
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.text(75, MSG_Y + 7, 'BATTLE COMMS // LIVE', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: '#b6aea9', letterSpacing: 1,
    }).setDepth(14).setResolution(2);
    this.turnStatusText = this.add.text(W - 20, MSG_Y + 7, 'STANDBY', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: '#ff7a2b', letterSpacing: 1,
    }).setOrigin(1, 0).setDepth(14).setResolution(2);

    this.messageText = this.add.text(75, MSG_Y + 32, '', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '11px',
      color: '#f8ece2',
      wordWrap: { width: W - 112 },
      lineSpacing: 5,
    }).setDepth(14).setResolution(2);

    this.msgContinueIndicator = this.add.text(W - 24, MSG_Y + MSG_H - 18, '\u2193', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '11px',
      color: '#ff7a2b',
    }).setDepth(14).setAlpha(0);

    this.tweens.add({
      targets: this.msgContinueIndicator,
      y: MSG_Y + MSG_H - 13,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ── Attack menu ─────────────────────────────────────────────────────────────

  private buildAttackMenu(menuY: number, menuH: number): void {
    const W = logicalSize(this).width;
    const store = useGameStore.getState();
    const unlockedIds = store.unlockedAttacks.map(a => a.id);

    const allAttackIds = ['bass-drop', 'echo-wave', 'hook-impact', 'reverb-strike'];
    const cols = 2;
    const gap = 7;
    const padX = 8;
    const btnW = (W - padX * 2 - gap) / 2;
    const btnH = (menuH - gap) / 2;
    const startX = padX;
    const startY = menuY;

    for (let i = 0; i < 4; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (btnW + gap);
      const y = startY + row * (btnH + gap);
      const attackId = allAttackIds[i];
      const attack = ATTACKS[attackId] as Attack;
      const unlocked = unlockedIds.includes(attackId);

      this.buildAttackButton(x, y, btnW, btnH, attack, unlocked, i);
    }
  }

  private buildAttackButton(
    x: number, y: number, w: number, h: number,
    attack: Attack, unlocked: boolean, index: number
  ): void {
    const colorHex = '#' + attack.color.toString(16).padStart(6, '0');
    const mutedHex = unlocked ? '#a89f99' : '#372c26';
    const cardShape = [
      new Phaser.Math.Vector2(0, 0),
      new Phaser.Math.Vector2(w - 13, 0),
      new Phaser.Math.Vector2(w, 13),
      new Phaser.Math.Vector2(w, h),
      new Phaser.Math.Vector2(0, h),
    ];

    const drawBtn = (g: Phaser.GameObjects.Graphics, hover: boolean) => {
      g.clear();
      const fillColor = unlocked ? (hover ? 0x312017 : 0x160c09) : 0x0b0706;
      const borderColor = unlocked ? attack.color : 0x372c26;
      g.fillStyle(fillColor, unlocked ? 0.98 : 0.72);
      g.fillPoints(cardShape, true);
      g.lineStyle(hover ? 2 : 1, borderColor, unlocked ? (hover ? 1 : 0.58) : 0.34);
      g.strokePoints(cardShape, true);

      // Track rail and clipped corner turn this into a compact performance pad.
      g.fillStyle(borderColor, unlocked ? (hover ? 1 : 0.7) : 0.28);
      g.fillRect(0, 0, 4, h);
      g.fillRect(4, 0, hover ? 72 : 42, 2);
      g.lineStyle(1, borderColor, unlocked ? 0.12 : 0.06);
      g.lineBetween(12, h - 10, w - 15, h - 10);

      if (unlocked) {
        g.fillStyle(attack.color, hover ? 0.12 : 0.055);
        g.fillRect(4, 2, Math.floor(w * 0.62), h - 4);
        if (hover) {
          g.fillStyle(attack.color, 0.75);
          for (let pulse = 0; pulse < 5; pulse++) {
            const pulseH = 2 + ((pulse + index) % 3) * 2;
            g.fillRect(w - 76 + pulse * 7, h - 9 - pulseH, 3, pulseH);
          }
        }
      }
    };

    const bg = this.add.graphics();
    drawBtn(bg, false);

    // Attack type icon: a quiet visual signature behind the key control.
    const iconRows = ATTACK_ICONS[attack.id] || [];
    const icon = this.add.graphics();
    if (unlocked) {
      const iconX = w - 90;
      const iconY = Math.max(20, Math.floor(h * 0.26));
      const pixelSize = 2;
      iconRows.forEach((row, ry) => {
        [...row].forEach((ch, rx) => {
          if (ch !== ' ') {
            icon.fillStyle(attack.color, 0.32);
            icon.fillRect(iconX + rx * pixelSize, iconY + ry * pixelSize, pixelSize, pixelSize);
          }
        });
      });
    }

    const metaText = this.add.text(14, 8, unlocked ? `TRACK 0${index + 1} // READY` : `TRACK 0${index + 1} // LOCKED`, {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: unlocked ? mutedHex : '#453730', letterSpacing: 1,
    }).setResolution(2);

    const nameText = this.add.text(14, 24, unlocked ? attack.name.toUpperCase() : 'UNAVAILABLE', {
      fontFamily: 'Sora', fontStyle: 'bold',
      fontSize: '13px',
      color: unlocked ? colorHex : '#473831',
      letterSpacing: 0.6,
    }).setResolution(2);

    const detailText = this.add.text(14, 49,
      unlocked ? attack.description : `UNLOCKS AT LEVEL ${String(attack.unlockLevel).padStart(2, '0')}`,
      {
        fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: unlocked ? '#ded8d3' : '#503f37',
        wordWrap: { width: w - 110 },
        lineSpacing: 2,
      }
    ).setResolution(2);

    const keyBg = this.add.graphics();
    keyBg.fillStyle(unlocked ? attack.color : 0x332924, unlocked ? 0.14 : 0.18);
    keyBg.fillRect(w - 45, h / 2 - 16, 32, 32);
    keyBg.lineStyle(1, unlocked ? attack.color : 0x453730, unlocked ? 0.82 : 0.35);
    keyBg.strokeRect(w - 44.5, h / 2 - 15.5, 31, 31);
    const keyText = this.add.text(w - 29, h / 2, unlocked ? String(index + 1) : '--', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '12px', color: unlocked ? '#f8ece2' : '#5a473e',
    }).setOrigin(0.5).setResolution(2);

    const parts: Phaser.GameObjects.GameObject[] = [bg, icon, metaText, nameText, detailText, keyBg, keyText];

    const container = this.add.container(x, y, parts);
    container.setDepth(15);

    const entry = { container, bg, attack, unlocked };
    this.attackButtons.push(entry);

    if (unlocked) {
      container.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, w, h),
        Phaser.Geom.Rectangle.Contains
      );

      container.on('pointerover', () => {
        if (!this.inputBlocked) {
          drawBtn(bg, true);
          nameText.setColor('#ffffff');
          metaText.setColor(colorHex);
        }
      });

      container.on('pointerout', () => {
        drawBtn(bg, false);
        nameText.setColor(colorHex);
        metaText.setColor(mutedHex);
      });

      container.on('pointerdown', () => this.tryExecuteAttack(index));
    }
  }

  /**
   * Bounding box of a texture's opaque pixels. Character art here is exported
   * on a padded canvas — the Gatekeeper in particular has a wide transparent
   * margin below its feet — so raw texture height would both undersize the
   * creature and leave it hovering above the ground it is meant to stand on.
   * Sampled at every other pixel: plenty precise for placement, 4x cheaper.
   */
  private getContentBounds(key: string): ContentBounds {
    const cached = BattleScene.contentBoundsCache.get(key);
    if (cached) return cached;

    const source = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    const full: ContentBounds = {
      left: 0, right: sourceWidth - 1, top: 0, bottom: sourceHeight - 1,
      width: sourceWidth, height: sourceHeight, sourceWidth, sourceHeight,
    };

    let bounds = full;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(source as CanvasImageSource, 0, 0);
        const { data } = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
        let left = sourceWidth, right = -1, top = sourceHeight, bottom = -1;
        for (let y = 0; y < sourceHeight; y += 2) {
          for (let x = 0; x < sourceWidth; x += 2) {
            if (data[(y * sourceWidth + x) * 4 + 3] > 12) {
              if (x < left) left = x;
              if (x > right) right = x;
              if (y < top) top = y;
              if (y > bottom) bottom = y;
            }
          }
        }
        if (bottom >= 0) {
          bounds = {
            left, right, top, bottom,
            width: right - left + 1, height: bottom - top + 1,
            sourceWidth, sourceHeight,
          };
        }
      }
    } catch {
      // Cross-origin or context unavailable — the untrimmed frame is a safe
      // fallback; art simply sits as it did before.
    }

    BattleScene.contentBoundsCache.set(key, bounds);
    return bounds;
  }

  /**
   * Scales a sprite so its *visible* art is `targetHeight` tall, then places
   * it so that art is horizontally centred on the platform with its feet on
   * the platform's centre point. Returns the resulting on-screen height.
   */
  private plantOnPlatform(
    sprite: Phaser.GameObjects.Sprite,
    textureKey: string,
    platform: { x: number; y: number },
    targetHeight: number,
  ): number {
    const bounds = this.getContentBounds(textureKey);
    const scale = targetHeight / bounds.height;
    sprite.setScale(scale);

    const contentCentreX = (bounds.left + bounds.right + 1) / 2;
    sprite.x = platform.x - (contentCentreX - bounds.sourceWidth / 2) * scale;
    sprite.y = platform.y - (bounds.bottom + 1 - bounds.sourceHeight / 2) * scale;
    return targetHeight;
  }

  /** Preserve fine cap lettering when reducing the large source to battle size.
   * Pre-filter at display density rather than dropping source pixels with NEAREST.
   * No retouching, sharpening, stroke expansion or change to the sprite geometry.
   */
  private preparePlayerBattleTexture(): void {
    const source = this.textures.get(PLAYER_BATTLE_TEXTURE).getSourceImage() as HTMLImageElement;
    const sprite = this.playerSprite;
    const displayWidth = sprite.displayWidth;
    const displayHeight = sprite.displayHeight;
    const canvasScale = this.game.canvas.getBoundingClientRect().width / logicalSize(this).width;
    const density = Math.max(2, canvasScale * (window.devicePixelRatio || 1));
    const width = Math.min(source.width, Math.ceil(displayWidth * density));
    const height = Math.min(source.height, Math.ceil(displayHeight * density));
    const key = 'player-battle-filtered';
    if (this.textures.exists(key)) this.textures.remove(key);
    const texture = this.textures.createCanvas(key, width, height);
    if (!texture) return;

    // Halving in stages avoids a single large downsample losing the M/R gap.
    let input: CanvasImageSource = source;
    let inputWidth = source.width;
    let inputHeight = source.height;
    while (inputWidth > width * 2 && inputHeight > height * 2) {
      const intermediate = document.createElement('canvas');
      intermediate.width = Math.ceil(inputWidth / 2);
      intermediate.height = Math.ceil(inputHeight / 2);
      const context = intermediate.getContext('2d');
      if (!context) break;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(input, 0, 0, intermediate.width, intermediate.height);
      input = intermediate;
      inputWidth = intermediate.width;
      inputHeight = intermediate.height;
    }
    const context = texture.getContext();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(input, 0, 0, width, height);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    sprite.setTexture(key).setDisplaySize(displayWidth, displayHeight);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.textures.remove(key);
    });
  }

  update(time: number, delta: number): void {
    this.hero?.update(time);
    this.foe?.update(time);
    this.updatePlayerIdle(time, delta);
    this.fx?.update(time, delta);
  }

  /**
   * Breathing and a slow shift of weight while the fight is on, so the hero
   * never stands frozen. The rig scales and tilts about the feet, which stay
   * planted; the motion fades out when the battle ends.
   */
  private updatePlayerIdle(time: number, delta: number): void {
    const rig = this.playerRig;
    if (!rig?.active) return;
    // The hero holds still while attacking, so effects drawn in world space
    // stay on the moving figure.
    const attacking = this.turnState === 'player-attack';
    const target = this.turnState === 'battle-end' || attacking ? 0 : 1;
    // Eases in over about a second, independent of the frame rate.
    this.playerIdleWeight += (target - this.playerIdleWeight) * (1 - Math.exp(-delta / (attacking ? 140 : 350)));
    const w = this.playerIdleWeight;
    const breath = Math.sin((time / 2400) * Math.PI * 2);
    const sway = Math.sin((time / 4100) * Math.PI * 2 + 0.7);
    const sx = 1 - 0.006 * breath * w;
    const sy = 1 + 0.018 * breath * w;
    const theta = Phaser.Math.DegToRad(0.9 * sway * w);
    const { x: fx, y: fy } = this.playerFeet;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    rig.setScale(sx, sy).setRotation(theta).setPosition(
      fx - (cos * sx * fx - sin * sy * fy) + this.heroJitter.x,
      fy - (sin * sx * fx + cos * sy * fy) + this.heroJitter.y,
    );
  }

  private tryExecuteAttack(index: number): void {
    const entry = this.attackButtons[index];
    if (!entry?.unlocked || this.turnState !== 'player-choose' || this.inputBlocked || !this.messageReady) return;
    this.executePlayerAttack(entry.attack, index);
  }

  private finishBattleIntro(): void {
    // A delayed intro callback must never reopen an attack already in progress.
    if (this.turnState === 'intro') this.setTurnState('player-choose');
  }

  // ── Battle logic ──────────────────────────────────────────────────────────

  private setTurnState(state: TurnState): void {
    this.turnState = state;
    this.inputBlocked = state !== 'player-choose';

    const turnLabels: Record<TurnState, { label: string; color: string }> = {
      'intro': { label: 'Get ready', color: '#a69485' },
      'player-choose': { label: 'Your turn', color: '#ff7a2b' },
      'player-attack': { label: 'Attacking', color: '#78b4e6' },
      'enemy-attack': { label: 'Enemy turn', color: '#ff5a4a' },
      'phase-change': { label: 'Phase change', color: '#ff5a4a' },
      'battle-end': { label: 'Battle over', color: '#a69485' },
    };
    const status = turnLabels[state];
    this.turnStatusText?.setText(status.label).setColor(status.color);

    if (state === 'player-choose') {
      this.setMessage('Choose your move.');
      this.setAttackButtonsEnabled(true);
    } else {
      this.setAttackButtonsEnabled(false);
    }
    this.emitBattleUiState();
  }

  private setAttackButtonsEnabled(enabled: boolean): void {
    this.attackButtons.forEach(btn => {
      btn.container.setAlpha(enabled ? 1 : 0.72);
    });
  }

  private executePlayerAttack(attack: Attack, btnIndex: number): void {
    this.setTurnState('player-attack');

    // Button press animation
    const btn = this.attackButtons[btnIndex];
    this.tweens.add({
      targets: btn.container,
      scaleX: 0.95, scaleY: 0.95,
      duration: 60,
      yoyo: true,
      onYoyo: () => {
        this.tweens.add({
          targets: btn.container,
          scaleX: 1.03, scaleY: 1.03,
          duration: 80,
          yoyo: true,
        });
      },
    });

    // Rolled once; the move's hits deliver it in parts and whatever they did
    // not deliver lands when it ends, so the total always equals the roll.
    const damage = applyDamageVariance(attack.damage);
    let dealt = 0;
    let resolved = false;
    const land = (amount: number) => {
      if (amount <= 0) return;
      dealt += amount;
      this.currentEnemyHp = Math.max(0, this.currentEnemyHp - amount);
      this.updateEnemyHpBar();
    };
    this.setMessage(`${attack.name}!`);
    this.playPlayerAttackAnimation(attack, {
      hit: (share, hit) => {
        if (resolved) return;
        land(BattleScene.portion(damage, dealt, share));
        if (hit.weight !== 'light') EventBus.emit(EVENTS.IMPACT, { isPlayer: false });
      },
      down: () => this.currentEnemyHp <= 0,
      done: () => {
        if (resolved) return;
        resolved = true;
        land(damage - dealt);
        this.resolvePlayerAttack();
      },
    });
  }

  /** The part of a rolled total one hit lands; a share of 1 or more lands the rest. */
  private static portion(total: number, dealt: number, share: number): number {
    const left = Math.max(0, total - dealt);
    return share >= 1 ? left : Math.min(left, Math.round(total * share));
  }

  /** Decided once per attack, after the move: a lethal or phase-crossing hit mid-combo does not branch early. */
  private resolvePlayerAttack(): void {
    // A lethal hit must not start another boss phase or leave its aura alive.
    if (this.currentEnemyHp <= 0) {
      this.stopEnemyEffects();
      this.time.delayedCall(450, () => this.endBattle('win'));
      return;
    }

    if (this.isBoss) {
      const hpFrac = this.currentEnemyHp / this.enemyData.maxHp;
      let newPhaseIdx = 0;
      if (hpFrac <= BOSS_PHASES[2].hpThreshold) newPhaseIdx = 2;
      else if (hpFrac <= BOSS_PHASES[1].hpThreshold) newPhaseIdx = 1;

      if (newPhaseIdx > this.bossPhaseIndex) {
        this.bossPhaseIndex = newPhaseIdx;
        this.triggerPhaseChange(newPhaseIdx);
        return;
      }
    }

    // The move's follow-through already gives the hit room to breathe.
    this.time.delayedCall(450, () => this.executeEnemyAttack());
  }

  private executeEnemyAttack(): void {
    this.setTurnState('enemy-attack');

    const store = useGameStore.getState();
    const phaseMultiplier = this.isBoss ? BOSS_PHASES[this.bossPhaseIndex].attackMultiplier : 1;
    // Normal enemies deal 75/85/95/100% damage at levels 1–4; bosses stay fixed.
    const levelMultiplier = this.isBoss ? 1 : Math.min(1, 0.75 + (Math.max(1, Math.min(4, store.level)) - 1) * 0.1);
    const attack = this.enemyData.attacks[Math.floor(Math.random() * this.enemyData.attacks.length)];
    const rawDmg  = Math.round(attack.damage * phaseMultiplier * levelMultiplier);
    const damage  = applyDamageVariance(rawDmg);
    let dealt = 0;
    let resolved = false;
    const land = (amount: number) => {
      if (amount <= 0) return;
      dealt += amount;
      useGameStore.getState().takeDamage(amount);
      EventBus.emit(EVENTS.HP_CHANGED, useGameStore.getState().hp);
      this.updatePlayerHpBar();
    };

    this.setMessage(`${this.enemyData.name} uses ${attack.name}!`);
    this.time.delayedCall(500, () => {
      this.playEnemyAttackAnimation(attack, {
        hit: (share, hit) => {
          if (resolved) return;
          land(BattleScene.portion(damage, dealt, share));
          if (hit.weight !== 'light') EventBus.emit(EVENTS.IMPACT, { isPlayer: true });
        },
        down: () => useGameStore.getState().hp <= 0,
        done: () => {
          if (resolved) return;
          resolved = true;
          land(damage - dealt);
          this.time.delayedCall(450, () => {
            if (useGameStore.getState().hp <= 0) {
              this.endBattle('lose');
            } else {
              this.setTurnState('player-choose');
            }
          });
        },
      });
    });
  }

  private triggerPhaseChange(phaseIdx: number): void {
    this.setTurnState('phase-change');
    EventBus.emit(EVENTS.BOSS_PHASE_CHANGED, phaseIdx);
    const phaseLabels  = ['Phase I', 'Phase II', 'Phase III'];
    // Boss phases climb the hostile ramp: ember -> signal -> deep signal.
    const phaseColors  = ['#ff7a2b', '#f0362c', '#8f1a16'];
    const hasBossBattleArt = this.textures.exists('boss-gatekeeper-battle-phase1');
    const textureKeys = hasBossBattleArt
      ? ['boss-gatekeeper-battle-phase1', 'boss-gatekeeper-battle-phase2', 'boss-gatekeeper-battle-phase3']
      : ['boss-gatekeeper', 'boss-gatekeeper-phase2', 'boss-gatekeeper-phase3'];
    const phaseMessages = [
      '',
      `${this.enemyData.name} is enraged!`,
      `${this.enemyData.name} unleashes its full fury!`,
    ];
    this.setMessage(phaseMessages[phaseIdx]);

    // The new form appears on the transformation frame of the sequence.
    const transform = () => {
      this.phaseText.setText(phaseLabels[phaseIdx]);
      this.phaseText.setColor(phaseColors[phaseIdx]);
      // Re-plant rather than only swapping the texture: each phase render has
      // its own transparent padding, so scale and footing must be recomputed
      // or the later phases drift off the dais.
      this.enemySprite.setTexture(textureKeys[phaseIdx]);
      this.plantOnPlatform(this.enemySprite, textureKeys[phaseIdx], this.enemyPlatform, this.enemyTargetHeight);
      this.foe?.rebase();
      this.shownPhaseIndex = phaseIdx;
      this.emitBattleUiState();
      EventBus.emit(EVENTS.UI_NOTICE, {
        eyebrow: `${this.enemyData.name} changes form`,
        title: phaseLabels[phaseIdx],
        detail: phaseIdx === 2 ? 'Final phase. Its attacks hit hardest now.' : 'Its attacks hit harder now.',
        accent: phaseColors[phaseIdx],
        tone: 'danger',
        variant: 'hero',
        duration: 1450,
      });
    };

    let finished = false;
    const next = () => {
      if (finished) return;
      finished = true;
      if (this.currentEnemyHp <= 0) {
        this.endBattle('win');
      } else {
        this.executeEnemyAttack();
      }
    };

    if (!this.fx || !this.foe || !this.hero) {
      transform();
      this.time.delayedCall(1600, next);
      return;
    }
    // Phase II is a step up; Phase III is the Gatekeeper's last stand.
    const shift = phaseIdx >= 2 ? unleash : enrage;
    shift({ fx: this.fx, boss: this.foe, hero: this.hero, transform, done: next });
    this.time.delayedCall(MOVE_TIMEOUT_MS, next);
  }

  private endBattle(outcome: 'win' | 'lose'): void {
    if (this.turnState === 'battle-end') return;
    this.setTurnState('battle-end');

    if (outcome === 'win') {
      this.stopEnemyEffects();
      this.enemySprite.clearTint().setAlpha(1);
      this.children.getByName('boss-contact-shadow')?.destroy();
      this.setMessage(this.isBoss
        ? `${this.enemyData.name} has been silenced!`
        : `${this.enemyData.name} was defeated!`);
      EventBus.emit(EVENTS.ENEMY_DEFEATED, this.isBoss);

      // The opponent's signal tears apart and bursts.
      if (this.fx && this.foe && this.hero) {
        foeDefeat(this.fx, this.foe, this.hero, this.isBoss ? 0xff3d57 : this.enemyData.color, this.isBoss, () => this.enemySprite.setActive(false));
      } else {
        this.tweens.add({ targets: this.enemySprite, alpha: 0, duration: 500, onComplete: () => this.enemySprite.setVisible(false).setActive(false) });
      }

      if (!this.isBoss) {
        const store = useGameStore.getState();
        const prevLevel = store.level;
        store.addXp(this.enemyData.xpReward);
        store.defeatEnemy(this.enemyData.id);
        EventBus.emit(EVENTS.XP_GAINED, this.enemyData.xpReward);

        const xpMsg = `+${this.enemyData.xpReward} XP`;
        this.setMessage(`${this.enemyData.name} defeated! ${xpMsg}`);

        const currentLevel = useGameStore.getState().level;
        if (currentLevel > prevLevel) {
          EventBus.emit(EVENTS.LEVEL_UP, currentLevel);
          this.time.delayedCall(500, () => {
            this.setMessage(`${this.enemyData.name} defeated! ${xpMsg}. Level up: you reached level ${currentLevel}!`);
            if (this.fx && this.hero) heroLevelUp(this.fx, this.hero);
          });
        }
      }

      this.time.delayedCall(1600, () => {
        this.cameras.main.fadeOut(400);
        this.time.delayedCall(400, () => {
          this.scene.stop('BattleScene');
          EventBus.emit(EVENTS.BATTLE_END, { outcome: 'win', enemyId: this.enemyData.id, isBoss: this.isBoss });
        });
      });

    } else {
      this.setMessage('You were overcome by the silence…');
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        this.scene.stop('BattleScene');
        EventBus.emit(EVENTS.BATTLE_END, { outcome: 'lose', enemyId: this.enemyData.id, isBoss: this.isBoss });
      };
      // The battle controls fade as the picture dies.
      this.time.delayedCall(1700, () => {
        this.uiFading = true;
        this.emitBattleUiState();
      });
      if (this.fx && this.hero) {
        heroDefeat(this.fx, this.hero, finish);
        this.time.delayedCall(MOVE_TIMEOUT_MS, finish);
      } else {
        this.cameras.main.fadeOut(600);
        this.time.delayedCall(2400, finish);
      }
    }
  }

  // ── Message box typewriter ────────────────────────────────────────────────

  private setMessage(text: string): void {
    this.messageReady = false;
    this.fullMessageText = text;
    this.typewriterTimer?.remove();
    this.messageText.setText('');
    this.msgContinueIndicator.setAlpha(0);
    this.emitBattleUiState();

    let charIndex = 0;
    this.typewriterTimer = this.time.addEvent({
      delay: 25,
      repeat: text.length - 1,
      callback: () => {
        charIndex++;
        this.messageText.setText(text.slice(0, charIndex));
        if (charIndex >= text.length) {
          this.messageReady = true;
          if (this.turnState !== 'player-choose') {
            this.msgContinueIndicator.setAlpha(0.8);
          }
          this.emitBattleUiState();
        }
      },
    });
  }

  private skipTypewriter(): void {
    this.typewriterTimer?.remove();
    this.messageText.setText(this.fullMessageText);
    this.messageReady = true;
    this.emitBattleUiState();
  }

  // ── Attack animations ─────────────────────────────────────────────────────

  private playPlayerAttackAnimation(attack: Attack, hooks: StrikeHooks): void {
    const trackIndex = ['bass-drop', 'echo-wave', 'hook-impact', 'reverb-strike'].indexOf(attack.id) + 1;
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: `Move ${trackIndex}`,
      title: attack.name,
      detail: attack.description,
      accent: `#${attack.color.toString(16).padStart(6, '0')}`,
      tone: 'combat',
      duration: 900,
    });
    const move = PLAYER_MOVES[attack.id] ?? PLAYER_MOVES['bass-drop'];
    this.runMove(this.hero, this.foe, attack.color, 1, hooks,
      () => EventBus.emit(EVENTS.ATTACK_USED, { attackId: attack.id, name: attack.name, isPlayer: true }),
      move.ultimate ? heroCutIn : heroWindup, move.script);
  }

  private playEnemyAttackAnimation(attack: EnemyAttack, hooks: StrikeHooks): void {
    const hostileColor = this.isBoss ? 0xff3d57 : 0xe8b465;
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: `${this.enemyData.name} attacks`,
      title: attack.name,
      detail: 'Brace yourself.',
      accent: `#${hostileColor.toString(16).padStart(6, '0')}`,
      tone: 'danger',
      duration: 900,
    });
    const { script, color } = enemyMove(this.enemyData.id, attack.name, this.isBoss);
    const power = this.isBoss ? 1 + this.bossPhaseIndex * 0.15 : 1;
    this.runMove(this.foe, this.hero, color, power, hooks,
      () => EventBus.emit(EVENTS.ATTACK_USED, { attackId: 'enemy-attack', name: attack.name, isPlayer: false }),
      foeTelegraph, script);
  }

  /**
   * Plays a move's wind-up and choreography. Its hits land damage with the
   * target's reaction; completion is idempotent and guarded by a timeout, so
   * a move that never reports back cannot leave the turn stuck.
   */
  private runMove(
    attacker: Combatant | undefined,
    target: Combatant | undefined,
    color: number,
    power: number,
    hooks: StrikeHooks,
    cue: () => void,
    windup: (ctx: MoveContext, then: () => void) => void,
    script: MoveScript,
  ): void {
    const fx = this.fx;
    if (!fx || !attacker || !target) {
      hooks.done();
      return;
    }
    let cued = false;
    let finished = false;
    const ctx: MoveContext = {
      fx, attacker, target, color, power,
      cue: () => {
        if (cued || finished) return;
        cued = true;
        cue();
      },
      hit: (share, hit) => {
        if (finished) return;
        fx.react(target, hit, hit.at);
        hooks.hit(share, hit);
      },
      targetDown: () => hooks.down(),
      cutSound: ms => EventBus.emit(EVENTS.ATTACK_SOUND_CUT, ms),
      done: () => {
        if (finished) return;
        finished = true;
        hooks.done();
      },
    };
    this.time.delayedCall(MOVE_TIMEOUT_MS, () => ctx.done());
    windup(ctx, () => script(ctx));
  }

  // ── Silence enemy ambient effects ──────────────────────────────────────

  private createEnemyEffect(): Phaser.GameObjects.Graphics {
    const effect = this.add.graphics();
    this.enemyEffects.add(effect);
    effect.once('destroy', () => this.enemyEffects.delete(effect));
    return effect;
  }

  private addEnemyEffectTimer(config: Phaser.Types.Time.TimerEventConfig): void {
    this.enemyEffectTimers.add(this.time.addEvent(config));
  }

  private addEnemyEffectTween(config: Phaser.Types.Tweens.TweenBuilderConfig): void {
    const tween = this.tweens.add(config);
    this.enemyEffectTweens.add(tween);
    tween.once('complete', () => this.enemyEffectTweens.delete(tween));
  }

  private stopEnemyEffects(): void {
    this.enemyEffectTimers.forEach(timer => timer.remove(false));
    this.enemyEffectTimers.clear();
    this.enemyEffectTweens.forEach(tween => tween.remove());
    this.enemyEffectTweens.clear();
    this.enemyEffects.forEach(effect => {
      this.tweens.killTweensOf(effect);
      effect.destroy();
    });
    this.enemyEffects.clear();
    if (this.enemySprite) this.tweens.killTweensOf(this.enemySprite);
  }

  private spawnSilenceParticles(cx: number, cy: number, battleH: number): void {
    // 1) Orbiting purple/magenta pixel squares — matches the model's floating fragments
    for (let i = 0; i < 10; i++) {
      const sq = this.createEnemyEffect().setDepth(6);
      const color = [0x6ea8d8, 0xff7a2b, 0x29638c, 0xe8b465][i % 4];
      const size = 3 + Math.random() * 4;
      sq.fillStyle(color, 0.8);
      sq.fillRect(-size / 2, -size / 2, size, size);

      const angle = (i / 10) * Math.PI * 2;
      const radius = 40 + Math.random() * 30;
      const speed = 4000 + Math.random() * 3000;
      sq.setPosition(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.6);

      // Orbit around the enemy
      this.addEnemyEffectTween({
        targets: sq,
        angle: 360,
        duration: speed,
        repeat: -1,
      });
      // Drift in/out
      this.addEnemyEffectTween({
        targets: sq,
        x: { from: sq.x - 15, to: sq.x + 15 },
        y: { from: sq.y - 10, to: sq.y + 10 },
        alpha: { from: 0.4, to: 0.9 },
        duration: 1800 + Math.random() * 1200,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 2000,
      });
    }

    // 2) Cyan glow pulse at enemy core
    const glow = this.createEnemyEffect().setDepth(4);
    glow.setPosition(cx, cy);
    glow.fillStyle(0x398bc6, 0.12);
    glow.fillCircle(0, 0, 50);
    glow.fillStyle(0x398bc6, 0.08);
    glow.fillCircle(0, 0, 35);
    this.addEnemyEffectTween({
      targets: glow,
      scaleX: 1.3, scaleY: 1.3,
      alpha: 0.04,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 3) Rising cyan sparks from the body
    this.addEnemyEffectTimer({
      delay: 300,
      repeat: -1,
      callback: () => {
        if (this.currentEnemyHp <= 0 || !this.enemySprite?.active) return;
        const spark = this.createEnemyEffect().setDepth(7);
        const sc = [0x398bc6, 0x398bc6, 0x6eaad5][Math.floor(Math.random() * 3)];
        spark.fillStyle(sc, 0.7);
        spark.fillCircle(0, 0, 1 + Math.random());
        spark.setPosition(
          this.enemySprite.x + Phaser.Math.Between(-25, 25),
          this.enemySprite.y + Phaser.Math.Between(-15, 30)
        );
        this.addEnemyEffectTween({
          targets: spark,
          y: spark.y - 40 - Math.random() * 30,
          x: spark.x + Phaser.Math.Between(-12, 12),
          alpha: 0,
          duration: 800 + Math.random() * 500,
          ease: 'Quad.easeOut',
          onComplete: () => spark.destroy(),
        });
      },
    });

    // 4) Dark mist / smoke at the base
    const mistY = cy + 55;
    for (let i = 0; i < 4; i++) {
      const mist = this.createEnemyEffect().setDepth(3);
      mist.fillStyle(0x2d1e17, 0.3);
      mist.fillEllipse(0, 0, 30 + Math.random() * 20, 8 + Math.random() * 4);
      mist.setPosition(cx + Phaser.Math.Between(-35, 35), mistY + Phaser.Math.Between(-5, 5));
      this.addEnemyEffectTween({
        targets: mist,
        x: mist.x + Phaser.Math.Between(-20, 20),
        alpha: { from: 0.15, to: 0.35 },
        scaleX: { from: 0.8, to: 1.3 },
        duration: 2500 + Math.random() * 1500,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 1500,
      });
    }
  }

  private spawnBrokenSignalParticles(cx: number, cy: number, _battleH: number): void {
    // Broken Signal = corrupted radio/boombox: dual speakers, antennas, frequency dial, crimson tendrils

    // 1) Speaker bass pulse — circular sound waves from left and right speaker "eyes"
    const speakerOffsetX = 35;
    for (const side of [-1, 1]) {
      const sx = cx + speakerOffsetX * side;
      this.addEnemyEffectTimer({
        delay: 1400 + side * 200,
        repeat: -1,
        callback: () => {
          if (this.currentEnemyHp <= 0 || !this.enemySprite?.active) return;
          for (let r = 0; r < 3; r++) {
            const ring = this.createEnemyEffect().setDepth(4);
            ring.lineStyle(2, 0xcc8800, 0.5);
            ring.strokeCircle(0, 0, 6);
            ring.setPosition(sx, cy);
            this.addEnemyEffectTween({
              targets: ring,
              scaleX: 3 + r,
              scaleY: 3 + r,
              alpha: 0,
              duration: 600 + r * 150,
              delay: r * 80,
              onComplete: () => ring.destroy(),
            });
          }
        },
      });
    }

    // 2) Antenna sparks — electric orange/gold crackles at the antenna tips
    const antennaPositions = [{ x: cx - 28, y: cy - 40 }, { x: cx + 28, y: cy - 40 }];
    this.addEnemyEffectTimer({
      delay: 350,
      repeat: -1,
      callback: () => {
        if (this.currentEnemyHp <= 0 || !this.enemySprite?.active) return;
        const ant = antennaPositions[Math.floor(Math.random() * 2)];
        for (let s = 0; s < 3; s++) {
          const spark = this.createEnemyEffect().setDepth(7);
          const sc = [0xffaa00, 0xff6600, 0xffdd44][s];
          spark.fillStyle(sc, 0.9);
          spark.fillRect(-1, -1, 2, 2);
          spark.setPosition(ant.x + Phaser.Math.Between(-4, 4), ant.y + Phaser.Math.Between(-4, 4));
          this.addEnemyEffectTween({
            targets: spark,
            y: spark.y - 10 - Math.random() * 15,
            x: spark.x + Phaser.Math.Between(-8, 8),
            alpha: 0,
            duration: 200 + Math.random() * 200,
            onComplete: () => spark.destroy(),
          });
        }
      },
    });

    // 3) Frequency dial glow — pulsating amber/orange light at the center
    const dialGlow = this.createEnemyEffect().setDepth(3);
    dialGlow.setPosition(cx, cy + 5);
    dialGlow.fillStyle(0xff6600, 0.1);
    dialGlow.fillCircle(0, 0, 45);
    dialGlow.fillStyle(0xffaa00, 0.12);
    dialGlow.fillCircle(0, 0, 25);
    dialGlow.fillStyle(0xffdd44, 0.08);
    dialGlow.fillCircle(0, 0, 12);
    this.addEnemyEffectTween({
      targets: dialGlow,
      scaleX: 1.3, scaleY: 1.3,
      alpha: 0.04,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 4) Frequency needle scanning — a thin line sweeping back and forth
    const needle = this.createEnemyEffect().setDepth(5);
    const needleState = { pos: 0 };
    this.addEnemyEffectTween({
      targets: needleState,
      pos: 1,
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.addEnemyEffectTimer({
      delay: 40,
      repeat: -1,
      callback: () => {
        if (this.currentEnemyHp <= 0 || !this.enemySprite?.active) { needle.destroy(); return; }
        needle.clear();
        const spriteY = this.enemySprite.y;
        const needleX = cx - 30 + needleState.pos * 60;
        needle.lineStyle(1.5, 0xffdd44, 0.6);
        needle.lineBetween(needleX, spriteY - 2, needleX, spriteY + 12);
        // Tiny glow at needle tip
        needle.fillStyle(0xffdd44, 0.3);
        needle.fillCircle(needleX, spriteY + 5, 3);
      },
    });

    // 5) Crimson tendrils — dark red wisps drifting around the body
    for (let i = 0; i < 8; i++) {
      const tendril = this.createEnemyEffect().setDepth(4);
      const tc = [0x8b1a1a, 0xaa2020, 0x660c0c, 0x991515][i % 4];
      tendril.fillStyle(tc, 0.4);
      // Elongated wisp shape
      const w = 8 + Math.random() * 12;
      const h = 2 + Math.random() * 3;
      tendril.fillEllipse(0, 0, w, h);

      const angle = (i / 8) * Math.PI * 2;
      const radius = 30 + Math.random() * 25;
      tendril.setPosition(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.6);

      this.addEnemyEffectTween({
        targets: tendril,
        x: tendril.x + Phaser.Math.Between(-15, 15),
        y: tendril.y + Phaser.Math.Between(-8, 8),
        alpha: { from: 0.15, to: 0.45 },
        angle: { from: -20, to: 20 },
        duration: 2000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 1500,
      });
    }

    // 6) Ember particles — tiny rising orange/red sparks from the body
    this.addEnemyEffectTimer({
      delay: 250,
      repeat: -1,
      callback: () => {
        if (this.currentEnemyHp <= 0 || !this.enemySprite?.active) return;
        const ember = this.createEnemyEffect().setDepth(6);
        const ec = [0xff6600, 0xffaa00, 0xff3300, 0xffdd44][Math.floor(Math.random() * 4)];
        ember.fillStyle(ec, 0.7);
        ember.fillCircle(0, 0, 1 + Math.random());
        ember.setPosition(
          this.enemySprite.x + Phaser.Math.Between(-30, 30),
          this.enemySprite.y + Phaser.Math.Between(-10, 20)
        );
        this.addEnemyEffectTween({
          targets: ember,
          y: ember.y - 25 - Math.random() * 20,
          x: ember.x + Phaser.Math.Between(-10, 10),
          alpha: 0,
          duration: 500 + Math.random() * 400,
          ease: 'Quad.easeOut',
          onComplete: () => ember.destroy(),
        });
      },
    });
  }

  private spawnStaticNoiseParticles(cx: number, cy: number, _battleH: number): void {
    // 1) Scattered neon pixel fragments — dispersing outward like the model's glitch shards
    for (let i = 0; i < 14; i++) {
      const sq = this.createEnemyEffect().setDepth(6);
      const color = [0x6ea8d8, 0xff7a2b, 0xe8b465, 0xab907c, 0xf0362c, 0xf8ece2][i % 6];
      const size = 2 + Math.random() * 5;
      sq.fillStyle(color, 0.85);
      sq.fillRect(-size / 2, -size / 2, size, size);

      const angle = (i / 14) * Math.PI * 2;
      const radius = 35 + Math.random() * 40;
      sq.setPosition(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.7);

      // Drift outward and back — simulates the dispersing fragments
      this.addEnemyEffectTween({
        targets: sq,
        x: { from: sq.x - 8, to: sq.x + 12 + Math.random() * 10 },
        y: { from: sq.y - 5, to: sq.y + 8 },
        alpha: { from: 0.3, to: 0.9 },
        duration: 1500 + Math.random() * 1500,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 2000,
      });
      // Slow rotation
      this.addEnemyEffectTween({
        targets: sq,
        angle: 360,
        duration: 5000 + Math.random() * 4000,
        repeat: -1,
      });
    }

    // 2) Horizontal EKG signal waveforms — the cyan/green zigzag lines from the model
    const drawSignalWave = (yOffset: number, waveColor: number, speed: number) => {
      const wave = this.createEnemyEffect().setDepth(5);
      let phase = 0;
      this.addEnemyEffectTimer({
        delay: 50,
        repeat: -1,
        callback: () => {
          if (this.currentEnemyHp <= 0 || !this.enemySprite?.active) return;
          wave.clear();
          phase += 0.15;
          wave.lineStyle(1.5, waveColor, 0.5 + Math.sin(phase * 0.5) * 0.2);
          wave.beginPath();
          const startX = cx - 55;
          const endX = cx + 55;
          wave.moveTo(startX, cy + yOffset);
          for (let x = startX; x <= endX; x += 4) {
            const t = (x - startX) / (endX - startX);
            // EKG-style: flat → spike → flat → dip → flat
            let yVal = 0;
            const pos = ((t * 3 + phase * speed) % 1);
            if (pos > 0.35 && pos < 0.4) yVal = -14;      // sharp spike up
            else if (pos > 0.4 && pos < 0.45) yVal = 8;    // dip down
            else if (pos > 0.6 && pos < 0.65) yVal = -6;   // smaller spike
            else yVal = (Math.random() - 0.5) * 1.5;       // noise
            wave.lineTo(x, cy + yOffset + yVal);
          }
          wave.strokePath();
        },
      });
    };
    drawSignalWave(-18, 0x6ea8d8, 0.8);
    drawSignalWave(6, 0xff7a2b, 1.0);
    drawSignalWave(28, 0xe8b465, 0.6);

    // 3) Screen corruption — flickering horizontal glitch bars across the battle area
    const glitchBars = this.createEnemyEffect().setDepth(4);
    this.addEnemyEffectTimer({
      delay: 120,
      repeat: -1,
      callback: () => {
        if (this.currentEnemyHp <= 0 || !this.enemySprite?.active) return;
        glitchBars.clear();
        // Only show glitch bars ~40% of frames for a stuttery feel
        if (Math.random() > 0.4) return;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
          const barY = cy - 50 + Math.random() * 100;
          const barH = 1 + Math.random() * 3;
          const barColor = [0xf0362c, 0x6ea8d8, 0xff7a2b, 0xe8b465][Math.floor(Math.random() * 4)];
          glitchBars.fillStyle(barColor, 0.15 + Math.random() * 0.15);
          glitchBars.fillRect(cx - 60, barY, 120, barH);
        }
      },
    });

    // 4) Bass pulse rings — concentric rings pulsing outward from the speaker area
    const speakerY = cy + 25;
    this.addEnemyEffectTimer({
      delay: 1200,
      repeat: -1,
      callback: () => {
        if (this.currentEnemyHp <= 0 || !this.enemySprite?.active) return;
        for (let r = 0; r < 3; r++) {
          const ring = this.createEnemyEffect().setDepth(4);
          ring.lineStyle(2, 0x398bc6, 0.4);
          ring.strokeCircle(0, 0, 8);
          ring.setPosition(cx, speakerY);
          this.addEnemyEffectTween({
            targets: ring,
            scaleX: 4 + r * 1.5,
            scaleY: 2.5 + r,
            alpha: 0,
            duration: 800 + r * 200,
            delay: r * 120,
            onComplete: () => ring.destroy(),
          });
        }
      },
    });

    // 5) Static crackling — small electric sparks popping around the sprite
    this.addEnemyEffectTimer({
      delay: 200,
      repeat: -1,
      callback: () => {
        if (this.currentEnemyHp <= 0 || !this.enemySprite?.active) return;
        const spark = this.createEnemyEffect().setDepth(7);
        const sc = [0x6ea8d8, 0xff7a2b, 0xf8ece2, 0xe8b465][Math.floor(Math.random() * 4)];
        spark.fillStyle(sc, 0.8);
        const s = 1 + Math.random() * 2;
        spark.fillRect(-s / 2, -s / 2, s, s);
        spark.setPosition(
          this.enemySprite.x + Phaser.Math.Between(-35, 35),
          this.enemySprite.y + Phaser.Math.Between(-30, 35)
        );
        // Quick flash and fade
        this.addEnemyEffectTween({
          targets: spark,
          alpha: 0,
          y: spark.y - 15 - Math.random() * 20,
          x: spark.x + Phaser.Math.Between(-8, 8),
          duration: 300 + Math.random() * 300,
          ease: 'Quad.easeOut',
          onComplete: () => spark.destroy(),
        });
      },
    });

    // 6) Core glow — pulsing red/cyan dual glow at center
    const glow = this.createEnemyEffect().setDepth(3);
    glow.setPosition(cx, cy);
    glow.fillStyle(0xe8b465, 0.08);
    glow.fillCircle(0, 0, 55);
    glow.fillStyle(0x6ea8d8, 0.06);
    glow.fillCircle(0, 5, 40);
    this.addEnemyEffectTween({
      targets: glow,
      scaleX: 1.25, scaleY: 1.25,
      alpha: 0.03,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
