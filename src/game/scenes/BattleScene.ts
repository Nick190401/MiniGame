import Phaser from 'phaser';
import { EventBus, EVENTS, type BattleUiPayload } from '../EventBus';
import { useGameStore } from '../../store/gameStore';
import { ATTACKS, applyDamageVariance } from '../systems/AttackSystem';
import { BOSS_DEFINITION } from '../entities/Enemy';
import { BOSS_PHASES } from '../entities/Boss';
import type { EnemyData, Attack } from '../../types/game.types';

type TurnState = 'player-choose' | 'player-attack' | 'enemy-attack' | 'phase-change' | 'battle-end';

// Attack‑type icons drawn as small pixel glyphs
const ATTACK_ICONS: Record<string, string[]> = {
  'bass-drop':    ['  ██  ', ' ████ ', '██████', '██████', ' ████ ', '  ██  '],
  'echo-wave':    ['█     ', '██    ', '███   ', '███   ', '██    ', '█     '],
  'hook-impact':  ['    ██', '   ██ ', '  ██  ', ' ██   ', '██    ', '██████'],
  'reverb-strike':['██████', '█    █', '█ ██ █', '█ ██ █', '█    █', '██████'],
};

export class BattleScene extends Phaser.Scene {
  // Battle data
  private enemyData!: EnemyData;
  private isBoss = false;
  private currentEnemyHp = 0;
  private bossPhaseIndex = 0;

  // UI references
  private enemySprite!: Phaser.GameObjects.Sprite;
  private playerSprite!: Phaser.GameObjects.Sprite;
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
  private battleH = 0;

  // Ambient particles
  private ambientParticles: Phaser.GameObjects.Graphics[] = [];

  // Typewriter state
  private typewriterTimer?: Phaser.Time.TimerEvent;
  private fullMessageText = '';
  private messageReady = false;

  // State
  private turnState: TurnState = 'player-choose';
  private inputBlocked = false;

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: { enemyData: EnemyData; isBoss: boolean }): void {
    this.enemyData = data.isBoss ? BOSS_DEFINITION : data.enemyData;
    this.isBoss = data.isBoss;
    this.currentEnemyHp = this.enemyData.maxHp;
    this.bossPhaseIndex = 0;
    this.attackButtons = [];
    this.ambientParticles = [];
  }

  create(): void {
    const W = this.scale.width;   // 640
    const H = this.scale.height;  // 480
    EventBus.emit(EVENTS.BATTLE_START, { enemyId: this.enemyData.id, isBoss: this.isBoss });

    // ── Layout constants ──────────────────────────────────────────────────
    // Give the actual encounter clear visual priority. The DOM controls below
    // are intentionally compact so the arena owns roughly 60% of the screen.
    const BATTLE_H   = Math.floor(H * 0.60);
    this.battleH     = BATTLE_H;
    const MSG_Y      = BATTLE_H;
    const MSG_H      = 66;
    const MENU_Y     = MSG_Y + MSG_H + 4;
    const MENU_H     = H - MENU_Y - 4;

    // ── Background ────────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x050908);
    bg.fillRect(0, 0, W, H);

    // Subtle gradient overlay — darker at top, lighter at bottom of arena
    const gradient = this.add.graphics();
    gradient.fillGradientStyle(0x102019, 0x102019, 0x050908, 0x050908, 0.42, 0.42, 0, 0);
    gradient.fillRect(0, 0, W, BATTLE_H);

    // Two-tone atmosphere: a warm glow behind the hostile signal, a cool
    // glow behind the player's side — the same confrontation mood as the
    // game's key art, echoed abstractly instead of using that art directly.
    const signalColor = this.isBoss ? 0xff5a2e : this.enemyData.color;
    const atmosphere = this.add.graphics();
    atmosphere.fillStyle(signalColor, 0.055);
    atmosphere.fillCircle(W * 0.72, BATTLE_H * 0.42, BATTLE_H * 0.62);
    atmosphere.fillStyle(0x49dfbf, 0.045);
    atmosphere.fillCircle(W * 0.2, BATTLE_H * 0.8, BATTLE_H * 0.5);

    // Oscilloscope environment: the opponent is staged inside a live signal field.
    const signalField = this.add.graphics().setDepth(1);
    for (let radius = 28; radius <= 150; radius += 24) {
      signalField.lineStyle(1, signalColor, Math.max(0.035, 0.18 - radius * 0.0008));
      signalField.strokeEllipse(W * 0.7, BATTLE_H * 0.5, radius * 1.6, radius * 0.72);
    }
    signalField.lineStyle(1, 0xd7ff4a, 0.1);
    for (let x = 0; x <= W; x += 32) signalField.lineBetween(x, 0, x, BATTLE_H);
    for (let y = 0; y <= BATTLE_H; y += 32) signalField.lineBetween(0, y, W, y);
    signalField.lineStyle(1.5, 0xd7ff4a, 0.28);
    signalField.beginPath();
    signalField.moveTo(20, BATTLE_H * 0.47);
    signalField.lineTo(52, BATTLE_H * 0.47);
    signalField.lineTo(60, BATTLE_H * 0.38);
    signalField.lineTo(69, BATTLE_H * 0.57);
    signalField.lineTo(80, BATTLE_H * 0.43);
    signalField.lineTo(92, BATTLE_H * 0.47);
    signalField.lineTo(134, BATTLE_H * 0.47);
    signalField.strokePath();

    this.add.text(W - 18, 14, `LIVE ENCOUNTER // ${this.isBoss ? 'TERMINAL' : 'WILD SIGNAL'}`, {
      fontFamily: 'DM Mono', fontSize: '7px', color: '#9aa79f', letterSpacing: 1,
    }).setOrigin(1, 0).setDepth(3).setVisible(false);
    this.add.text(W - 18, 27, this.enemyData.id.toUpperCase().replace(/-/g, ' '), {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '10px', color: `#${signalColor.toString(16).padStart(6, '0')}`,
    }).setOrigin(1, 0).setDepth(3).setVisible(false);

    if (this.isBoss) {
      const aura = this.add.graphics();
      aura.fillStyle(0x330000, 0.25);
      aura.fillRect(0, 0, W, H);
    }

    // Scanlines
    const scanlines = this.add.graphics();
    scanlines.fillStyle(0x000000, 0.035);
    for (let y = 0; y < BATTLE_H; y += 4) {
      scanlines.fillRect(0, y, W, 1);
    }
    scanlines.setDepth(4);

    // ── Ambient floating particles ───────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const p = this.add.graphics().setDepth(3);
      const c = this.isBoss ? [0xff2244, 0xff6644, 0xcc1133, 0xffaa44][i % 4] : [0xd7ff4a, 0x49dfbf, 0xff6b3d, 0xeef5e9][i % 4];
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

    // Restrained broadcast frame with hard signal corners.
    const border = this.add.graphics().setDepth(31);
    border.lineStyle(1, 0x43584d, 0.72);
    border.strokeRect(3.5, 3.5, W - 7, H - 7);
    border.lineStyle(2, 0xd7ff4a, 0.8);
    border.lineBetween(3, 3, 46, 3); border.lineBetween(3, 3, 3, 28);
    border.lineBetween(W - 46, H - 3, W - 3, H - 3); border.lineBetween(W - 3, H - 28, W - 3, H - 3);

    // ── Ground platforms (GBA Pokémon style) ──────────────────────────────
    // Tinted per side — hostile signal warmth under the enemy, cool signal
    // under the player — echoing the fire-vs-signal duality of the key art.
    const ground = this.add.graphics().setDepth(2);
    // Enemy platform — ellipse, upper right
    ground.fillStyle(0x1a2a21, 0.62);
    ground.fillEllipse(W * 0.70, BATTLE_H * 0.70, 190, 28);
    ground.lineStyle(1.5, signalColor, 0.26);
    ground.strokeEllipse(W * 0.70, BATTLE_H * 0.70, 190, 28);
    // Player platform — ellipse, lower left
    ground.fillStyle(0x1a2a21, 0.62);
    ground.fillEllipse(W * 0.24, BATTLE_H * 0.93, 170, 22);
    ground.lineStyle(1.5, 0x49dfbf, 0.24);
    ground.strokeEllipse(W * 0.24, BATTLE_H * 0.93, 170, 22);

    // ── Enemy sprite (upper right) — slides in from right ──────────────
    const enemySpriteY = BATTLE_H * 0.48;
    const enemyFinalX = W * 0.70;

    // Use high-res battle art when available, otherwise pixel sprite
    const hasSilenceArt = this.enemyData.id === 'silence' && this.textures.exists('silence-battle');
    const hasStaticNoiseArt = this.enemyData.id === 'static-noise' && this.textures.exists('staticnoise-battle');
    const hasBrokenSignalArt = this.enemyData.id === 'broken-signal' && this.textures.exists('brokensignal-battle');
    const hasBossBattleArt = this.isBoss && this.textures.exists('boss-gatekeeper-battle-phase1');
    const hasBattleArt = hasSilenceArt || hasStaticNoiseArt || hasBrokenSignalArt || hasBossBattleArt;
    const enemyTexture = hasBossBattleArt ? 'boss-gatekeeper-battle-phase1'
      : hasSilenceArt ? 'silence-battle'
      : hasStaticNoiseArt ? 'staticnoise-battle'
      : hasBrokenSignalArt ? 'brokensignal-battle'
      : this.enemyData.textureKey;
    // Broken Signal PNG is landscape (~2:1), needs different scale
    const enemyScale = hasBossBattleArt ? 0.16
      : hasBrokenSignalArt ? 0.17
      : hasBattleArt ? 0.115
      : (this.isBoss ? 3.9 : 4.25);

    this.enemySprite = this.add.sprite(W + 60, enemySpriteY, enemyTexture);
    this.enemySprite.setScale(enemyScale);
    this.enemySprite.setDepth(5);

    this.tweens.add({
      targets: this.enemySprite,
      x: enemyFinalX,
      duration: 600,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
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

    // ── Player sprite — slides in from left ──────────────────────────────
    const playerFinalX = W * 0.24;
    this.playerSprite = this.add.sprite(-40, BATTLE_H * 0.72, 'player-battle');
    const playerSource = this.textures.get('player-battle').getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    this.playerSprite.setScale(playerSource.width > 100 ? 0.12 : 2.35);
    this.playerSprite.setDepth(5);

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

    EventBus.on(EVENTS.BATTLE_UI_ACTION, this.onBattleUiAction);
    EventBus.on(EVENTS.BATTLE_UI_REQUEST, this.emitBattleUiState, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
      ? 'THE GATEKEEPER\nblocks your path!'
      : `A wild ${this.enemyData.name}\nappears!`);

    this.time.delayedCall(1400, () => {
      this.setTurnState('player-choose');
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
      'player-choose': { label: 'YOUR TURN // SELECT TRACK', color: '#d7ff4a' },
      'player-attack': { label: 'PLAYER SIGNAL // TRANSMITTING', color: '#49dfbf' },
      'enemy-attack': { label: 'HOSTILE SIGNAL // INBOUND', color: '#ff6b3d' },
      'phase-change': { label: 'SIGNAL SURGE // PHASE SHIFT', color: '#ff5c66' },
      'battle-end': { label: 'SESSION // CLOSED', color: '#91a098' },
    };
    const status = turnLabels[this.turnState];
    const enemyAccent = this.isBoss ? 0xff5a2e : this.enemyData.color;
    const phase = this.isBoss ? ['PHASE I', 'PHASE II', 'PHASE III'][this.bossPhaseIndex] : 'LIVE';
    const payload: BattleUiPayload = {
      isBoss: this.isBoss,
      phase,
      enemy: {
        name: this.enemyData.name,
        hp: this.currentEnemyHp,
        maxHp: this.enemyData.maxHp,
        accent: `#${enemyAccent.toString(16).padStart(6, '0')}`,
      },
      player: {
        name: store.playerName || 'Sound Keeper',
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
    const borderColor = this.isBoss ? 0xff5a2e : 0x49dfbf;
    const infoBg = this.add.graphics().setDepth(8);
    infoBg.fillStyle(0x07100c, 0.94);
    infoBg.fillRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH);
    infoBg.fillStyle(borderColor, 0.9);
    infoBg.fillRect(infoBoxX, infoBoxY, 4, infoBoxH);
    infoBg.fillRect(infoBoxX, infoBoxY, 68, 2);
    infoBg.lineStyle(1, 0x3b5045, 0.78);
    infoBg.strokeRect(infoBoxX + 0.5, infoBoxY + 0.5, infoBoxW - 1, infoBoxH - 1);
    infoBg.lineStyle(1, borderColor, 0.12);
    infoBg.lineBetween(infoBoxX + 10, infoBoxY + 47, infoBoxX + infoBoxW - 10, infoBoxY + 47);

    this.add.circle(infoBoxX + 16, infoBoxY + 13, 2.5, borderColor, 1).setDepth(10);
    this.add.text(infoBoxX + 25, infoBoxY + 8, 'TARGET SIGNAL // HOSTILE', {
      fontFamily: 'DM Mono', fontSize: '7px', color: '#9aa79f', letterSpacing: 1,
    }).setDepth(10).setResolution(2);

    this.enemyNameText = this.add.text(infoBoxX + 12, infoBoxY + 24, this.enemyData.name.toUpperCase(), {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '15px',
      color: this.isBoss ? '#ff8a66' : '#eef5e9', letterSpacing: 1,
    }).setDepth(10).setResolution(2);

    this.phaseText = this.add.text(infoBoxX + infoBoxW - 12, infoBoxY + 9, this.isBoss ? 'PHASE I' : 'LIVE', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: this.isBoss ? '#ff8a66' : '#49dfbf', letterSpacing: 1,
    }).setOrigin(1, 0).setDepth(10).setResolution(2);

    this.add.text(infoBoxX + 12, infoBoxY + 59, 'HP', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: '#aab5ae', letterSpacing: 1,
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
      { fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '8px', color: '#eef5e9' }
    ).setOrigin(1, 0).setDepth(10).setResolution(2);
  }

  private buildPlayerInfoBox(W: number, BATTLE_H: number): void {
    const store = useGameStore.getState();
    const phpBoxW = 272;
    const phpBoxH = 74;
    const phpBoxX = W - phpBoxW - 18;
    const phpBoxY = BATTLE_H - phpBoxH - 9;

    const phpBg = this.add.graphics().setDepth(8);
    phpBg.fillStyle(0x07100c, 0.94);
    phpBg.fillRect(phpBoxX, phpBoxY, phpBoxW, phpBoxH);
    phpBg.fillStyle(0x49dfbf, 0.9);
    phpBg.fillRect(phpBoxX + phpBoxW - 4, phpBoxY, 4, phpBoxH);
    phpBg.fillRect(phpBoxX + phpBoxW - 70, phpBoxY + phpBoxH - 2, 70, 2);
    phpBg.lineStyle(1, 0x3b5045, 0.78);
    phpBg.strokeRect(phpBoxX + 0.5, phpBoxY + 0.5, phpBoxW - 1, phpBoxH - 1);
    phpBg.lineStyle(1, 0x49dfbf, 0.12);
    phpBg.lineBetween(phpBoxX + 10, phpBoxY + 47, phpBoxX + phpBoxW - 10, phpBoxY + 47);

    const pName = store.playerName || 'PLAYER';
    this.add.circle(phpBoxX + 16, phpBoxY + 13, 2.5, 0x49dfbf, 1).setDepth(10);
    this.add.text(phpBoxX + 25, phpBoxY + 8, 'PLAYER CHANNEL // ACTIVE', {
      fontFamily: 'DM Mono', fontSize: '7px', color: '#9aa79f', letterSpacing: 1,
    }).setDepth(10).setResolution(2);

    this.add.text(phpBoxX + 12, phpBoxY + 24, pName.toUpperCase(), {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '14px', color: '#eef5e9', letterSpacing: 1,
    }).setDepth(10).setResolution(2);

    this.add.text(phpBoxX + phpBoxW - 12, phpBoxY + 10, `LEVEL ${String(store.level).padStart(2, '0')}`, {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: '#d7ff4a', letterSpacing: 1,
    }).setOrigin(1, 0).setDepth(10).setResolution(2);

    this.add.text(phpBoxX + 12, phpBoxY + 58, 'HP', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: '#aab5ae', letterSpacing: 1,
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
      { fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '8px', color: '#eef5e9' }
    ).setOrigin(1, 0).setDepth(10).setResolution(2);
  }

  // ── HP bar rendering (Pokémon style with rounded ends + gradient) ──────────

  private hpColor(frac: number): number {
    if (frac > 0.5) return 0x49dfbf;
    if (frac > 0.25) return 0xd7ff4a;
    return 0xff5c66;
  }

  private hpColorBright(frac: number): number {
    if (frac > 0.5) return 0x91f4dd;
    if (frac > 0.25) return 0xeeff9a;
    return 0xff9a9f;
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number): void {
    g.clear();
    g.fillStyle(0x111a16);
    g.fillRect(x, y, w, h);
    g.lineStyle(1, 0x34483e, 0.9);
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    if (frac > 0) {
      const fillW = Math.max(3, (w - 2) * frac);
      const color = this.hpColor(frac);
      const bright = this.hpColorBright(frac);
      g.fillStyle(color);
      g.fillRect(x + 1, y + 1, fillW, h - 2);
      g.fillStyle(bright, 0.58);
      g.fillRect(x + 1, y + 1, fillW, 2);
      g.fillStyle(0xeef5e9, 0.9);
      g.fillRect(x + Math.max(1, fillW - 1), y + 1, 2, h - 2);
    }

    g.lineStyle(1, 0x07100c, 0.42);
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
    msgBg.fillStyle(0x050a08, 0.99);
    msgBg.fillRect(7, MSG_Y, W - 14, MSG_H);
    msgBg.fillStyle(0xd7ff4a, 0.88);
    msgBg.fillRect(7, MSG_Y, 5, MSG_H);
    msgBg.lineStyle(1, 0x34483e, 0.92);
    msgBg.strokeRect(7.5, MSG_Y + 0.5, W - 15, MSG_H - 1);
    msgBg.fillStyle(0xd7ff4a, 0.035);
    msgBg.fillRect(12, MSG_Y + 1, 49, MSG_H - 2);
    msgBg.lineStyle(1, 0x355046, 0.72);
    msgBg.lineBetween(62, MSG_Y + 1, 62, MSG_Y + MSG_H - 1);
    msgBg.lineStyle(1, 0xd7ff4a, 0.16);
    msgBg.lineBetween(74, MSG_Y + 23, W - 19, MSG_Y + 23);

    // Signal portrait rail: the battle equivalent of the NPC chat portrait.
    const signalPortrait = this.add.graphics().setDepth(14).setPosition(35, MSG_Y + MSG_H / 2);
    signalPortrait.fillStyle(0xd7ff4a, 0.08); signalPortrait.fillCircle(0, 0, 19);
    signalPortrait.lineStyle(2, 0xd7ff4a, 0.9); signalPortrait.strokeCircle(0, 0, 11);
    signalPortrait.lineStyle(2, 0x49dfbf, 0.78); signalPortrait.strokeCircle(0, 0, 6);
    signalPortrait.fillStyle(0xeef5e9, 0.95); signalPortrait.fillCircle(0, 0, 2);
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
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: '#aab5ae', letterSpacing: 1,
    }).setDepth(14).setResolution(2);
    this.turnStatusText = this.add.text(W - 20, MSG_Y + 7, 'STANDBY', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: '#d7ff4a', letterSpacing: 1,
    }).setOrigin(1, 0).setDepth(14).setResolution(2);

    this.messageText = this.add.text(75, MSG_Y + 32, '', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '11px',
      color: '#eef5e9',
      wordWrap: { width: W - 112 },
      lineSpacing: 5,
    }).setDepth(14).setResolution(2);

    this.msgContinueIndicator = this.add.text(W - 24, MSG_Y + MSG_H - 18, '\u2193', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '11px',
      color: '#d7ff4a',
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
    const W = this.scale.width;
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
    const mutedHex = unlocked ? '#9aa79f' : '#29342d';
    const cardShape = [
      new Phaser.Math.Vector2(0, 0),
      new Phaser.Math.Vector2(w - 13, 0),
      new Phaser.Math.Vector2(w, 13),
      new Phaser.Math.Vector2(w, h),
      new Phaser.Math.Vector2(0, h),
    ];

    const drawBtn = (g: Phaser.GameObjects.Graphics, hover: boolean) => {
      g.clear();
      const fillColor = unlocked ? (hover ? 0x183024 : 0x0a1511) : 0x060a08;
      const borderColor = unlocked ? attack.color : 0x29342d;
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
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: unlocked ? mutedHex : '#354039', letterSpacing: 1,
    }).setResolution(2);

    const nameText = this.add.text(14, 24, unlocked ? attack.name.toUpperCase() : 'UNAVAILABLE', {
      fontFamily: 'Syne', fontStyle: 'bold',
      fontSize: '13px',
      color: unlocked ? colorHex : '#35433b',
      letterSpacing: 0.6,
    }).setResolution(2);

    const detailText = this.add.text(14, 49,
      unlocked ? attack.description : `UNLOCKS AT LEVEL ${String(attack.unlockLevel).padStart(2, '0')}`,
      {
        fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '7px', color: unlocked ? '#d4ddd7' : '#3d4a42',
        wordWrap: { width: w - 110 },
        lineSpacing: 2,
      }
    ).setResolution(2);

    const keyBg = this.add.graphics();
    keyBg.fillStyle(unlocked ? attack.color : 0x26312b, unlocked ? 0.14 : 0.18);
    keyBg.fillRect(w - 45, h / 2 - 16, 32, 32);
    keyBg.lineStyle(1, unlocked ? attack.color : 0x354039, unlocked ? 0.82 : 0.35);
    keyBg.strokeRect(w - 44.5, h / 2 - 15.5, 31, 31);
    const keyText = this.add.text(w - 29, h / 2, unlocked ? String(index + 1) : '--', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '12px', color: unlocked ? '#eef5e9' : '#45534b',
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

  private tryExecuteAttack(index: number): void {
    const entry = this.attackButtons[index];
    if (!entry?.unlocked || this.turnState !== 'player-choose' || this.inputBlocked || !this.messageReady) return;
    this.executePlayerAttack(entry.attack, index);
  }

  // ── Battle logic ──────────────────────────────────────────────────────────

  private setTurnState(state: TurnState): void {
    this.turnState = state;
    this.inputBlocked = state !== 'player-choose';

    const turnLabels: Record<TurnState, { label: string; color: string }> = {
      'player-choose': { label: 'YOUR TURN // SELECT TRACK', color: '#d7ff4a' },
      'player-attack': { label: 'PLAYER SIGNAL // TRANSMITTING', color: '#49dfbf' },
      'enemy-attack': { label: 'HOSTILE SIGNAL // INBOUND', color: '#ff6b3d' },
      'phase-change': { label: 'SIGNAL SURGE // PHASE SHIFT', color: '#ff5c66' },
      'battle-end': { label: 'SESSION // CLOSED', color: '#718078' },
    };
    const status = turnLabels[state];
    this.turnStatusText?.setText(status.label).setColor(status.color);

    if (state === 'player-choose') {
      this.setMessage('Choose your next track.');
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

    const damage = applyDamageVariance(attack.damage);
    this.setMessage(`${attack.name}!`);
    EventBus.emit(EVENTS.ATTACK_USED, { attackId: attack.id, name: attack.name, isPlayer: true });

    this.playPlayerAttackAnimation(attack, () => {
      this.currentEnemyHp = Math.max(0, this.currentEnemyHp - damage);
      this.updateEnemyHpBar();
      this.playTargetImpact(this.enemySprite, attack.color, false);

      // Check boss phase transition
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

      if (this.currentEnemyHp <= 0) {
        this.time.delayedCall(600, () => this.endBattle('win'));
        return;
      }

      this.time.delayedCall(700, () => this.executeEnemyAttack());
    });
  }

  private executeEnemyAttack(): void {
    this.setTurnState('enemy-attack');

    const store = useGameStore.getState();
    const phaseMultiplier = this.isBoss ? BOSS_PHASES[this.bossPhaseIndex].attackMultiplier : 1;
    const attack = this.enemyData.attacks[Math.floor(Math.random() * this.enemyData.attacks.length)];
    const rawDmg  = Math.round(attack.damage * phaseMultiplier);
    const damage  = applyDamageVariance(rawDmg);

    this.setMessage(`${this.enemyData.name}\nuses ${attack.name}!`);
    EventBus.emit(EVENTS.ATTACK_USED, { attackId: 'enemy-attack', name: attack.name, isPlayer: false });

    this.time.delayedCall(600, () => {
      this.playEnemyAttackAnimation(attack, () => {
        store.takeDamage(damage);
        const currentHp = useGameStore.getState().hp;
        EventBus.emit(EVENTS.HP_CHANGED, currentHp);
        this.updatePlayerHpBar();
        this.playTargetImpact(this.playerSprite, 0xff5c66, true);

        this.time.delayedCall(700, () => {
          if (currentHp <= 0) {
            this.endBattle('lose');
          } else {
            this.setTurnState('player-choose');
          }
        });
      });
    });
  }

  private playTargetImpact(target: Phaser.GameObjects.Sprite, color: number, playerHit: boolean): void {
    EventBus.emit(EVENTS.IMPACT, { isPlayer: playerHit });
    const originX = target.x;
    const originY = target.y;
    const offset = playerHit ? -11 : 11;
    const echoColor = playerHit ? 0xff6b3d : 0x49dfbf;
    const reticleRadius = Math.max(25, Math.min(52, target.displayWidth * 0.44));

    // Two displaced copies create a short chromatic signal tear at the hit frame.
    const createEcho = (tint: number, direction: number) => {
      const echo = this.add.sprite(originX, originY, target.texture.key, target.frame.name)
        .setOrigin(target.originX, target.originY)
        .setScale(target.scaleX, target.scaleY)
        .setAngle(target.angle)
        .setTint(tint)
        .setAlpha(0.34)
        .setDepth(target.depth - 0.1)
        .setName('battle-impact-echo');
      this.tweens.add({
        targets: echo,
        x: originX + direction * 15,
        alpha: 0,
        duration: 190,
        ease: 'Quad.easeOut',
        onComplete: () => echo.destroy(),
      });
    };
    createEcho(color, -1);
    createEcho(echoColor, 1);

    const reticle = this.add.graphics()
      .setPosition(originX, originY)
      .setDepth(25)
      .setName('battle-impact-reticle');
    reticle.lineStyle(2, color, 0.95);
    const r = reticleRadius;
    const corner = 10;
    reticle.lineBetween(-r, -r, -r + corner, -r);
    reticle.lineBetween(-r, -r, -r, -r + corner);
    reticle.lineBetween(r, -r, r - corner, -r);
    reticle.lineBetween(r, -r, r, -r + corner);
    reticle.lineBetween(-r, r, -r + corner, r);
    reticle.lineBetween(-r, r, -r, r - corner);
    reticle.lineBetween(r, r, r - corner, r);
    reticle.lineBetween(r, r, r, r - corner);
    reticle.lineStyle(1, 0xffffff, 0.72);
    reticle.lineBetween(-7, 0, 7, 0);
    reticle.lineBetween(0, -7, 0, 7);
    reticle.strokeCircle(0, 0, 12);

    this.tweens.add({
      targets: reticle,
      scaleX: 1.65,
      scaleY: 1.65,
      angle: playerHit ? -12 : 12,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => reticle.destroy(),
    });

    // Thin waveform shards make the hit readable without showing damage numbers.
    for (let shardIndex = 0; shardIndex < 9; shardIndex++) {
      const shard = this.add.graphics().setDepth(24).setPosition(originX, originY);
      const shardColor = shardIndex % 3 === 0 ? 0xffffff : color;
      shard.fillStyle(shardColor, 0.92);
      shard.fillRect(-1, -1, 2 + (shardIndex % 2) * 2, 2);
      const angle = (Math.PI * 2 * shardIndex) / 9 + Math.random() * 0.24;
      const distance = 26 + Math.random() * 34;
      this.tweens.add({
        targets: shard,
        x: originX + Math.cos(angle) * distance,
        y: originY + Math.sin(angle) * distance,
        alpha: 0,
        scaleX: 0.35,
        duration: 270 + Math.random() * 110,
        ease: 'Quad.easeOut',
        onComplete: () => shard.destroy(),
      });
    }

    target.setTint(0xffffff);
    this.time.delayedCall(75, () => {
      if (target.active) target.setTint(color);
    });
    this.time.delayedCall(135, () => {
      if (target.active) target.clearTint();
    });
    this.tweens.add({
      targets: target,
      x: originX + offset,
      duration: 32,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
      onComplete: () => { if (target.active) target.x = originX; },
    });

    const hpText = playerHit ? this.playerHpText : this.enemyHpText;
    hpText.setColor(playerHit ? '#ff8c91' : '#eef5e9');
    this.tweens.add({
      targets: hpText,
      scaleX: 1.13,
      scaleY: 1.13,
      alpha: 0.58,
      duration: 90,
      yoyo: true,
      repeat: 1,
      onComplete: () => hpText.setScale(1).setAlpha(1).setColor('#aab5ae'),
    });

    this.cameras.main.shake(playerHit ? 180 : 140, playerHit ? 0.008 : 0.006);
    if (playerHit) this.cameras.main.flash(90, 115, 12, 18, false);
    else this.cameras.main.flash(70, 215, 255, 74, false);
  }

  private triggerPhaseChange(phaseIdx: number): void {
    this.setTurnState('phase-change');
    EventBus.emit(EVENTS.BOSS_PHASE_CHANGED, phaseIdx);
    const phaseLabels  = ['PHASE I', 'PHASE II', 'PHASE III'];
    const phaseColors  = ['#d7ff4a', '#ff5a2e', '#ff5c66'];
    const hasBossBattleArt = this.textures.exists('boss-gatekeeper-battle-phase1');
    const textureKeys = hasBossBattleArt
      ? ['boss-gatekeeper-battle-phase1', 'boss-gatekeeper-battle-phase2', 'boss-gatekeeper-battle-phase3']
      : ['boss-gatekeeper', 'boss-gatekeeper-phase2', 'boss-gatekeeper-phase3'];
    const phaseMessages = [
      '',
      `${this.enemyData.name}\nenrages! PHASE II!`,
      `THE GATEKEEPER\nFURY UNLEASHED!\nPHASE III!`,
    ];

    this.cameras.main.flash(400, 150, 0, 200);
    this.cameras.main.shake(300, 0.008);

    this.phaseText.setText(phaseLabels[phaseIdx]);
    this.phaseText.setColor(phaseColors[phaseIdx]);
    this.enemySprite.setTexture(textureKeys[phaseIdx]);
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: 'BOSS SIGNAL // MUTATION DETECTED',
      title: phaseLabels[phaseIdx],
      detail: phaseIdx === 2 ? 'Fury unleashed. Terminal frequency unstable.' : 'Hostile signal strength rising.',
      accent: phaseColors[phaseIdx],
      tone: 'danger',
      variant: 'hero',
      duration: 1450,
    });

    // Phase change visual: big text overlay
    const W = this.scale.width;
    const phaseAnnounce = this.add.text(W / 2, this.battleH * 0.4, phaseLabels[phaseIdx], {
      fontFamily: '"Press Start 2P"',
      fontSize: '16px',
      color: phaseColors[phaseIdx],
    }).setOrigin(0.5).setDepth(28).setAlpha(0).setScale(2).setVisible(false);

    this.tweens.add({
      targets: phaseAnnounce,
      alpha: 1,
      scaleX: 1, scaleY: 1,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: phaseAnnounce,
          alpha: 0,
          y: this.battleH * 0.3,
          duration: 600,
          delay: 600,
          onComplete: () => phaseAnnounce.destroy(),
        });
      },
    });

    this.setMessage(phaseMessages[phaseIdx]);

    this.time.delayedCall(1600, () => {
      if (this.currentEnemyHp <= 0) {
        this.endBattle('win');
      } else {
        this.executeEnemyAttack();
      }
    });
  }

  private endBattle(outcome: 'win' | 'lose'): void {
    this.setTurnState('battle-end');

    if (outcome === 'win') {
      this.setMessage(this.isBoss
        ? 'THE GATEKEEPER\nhas been silenced!'
        : `${this.enemyData.name}\nwas defeated!`);

      // Defeat animation: blink → shrink-spin → burst particles
      this.tweens.add({
        targets: this.enemySprite,
        alpha: 0,
        duration: 120,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          this.tweens.add({
            targets: this.enemySprite,
            scaleX: 0,
            scaleY: 0,
            angle: 360,
            duration: 500,
            ease: 'Back.easeIn',
          });
          this.spawnDefeatParticles(this.enemySprite.x, this.enemySprite.y);
        },
      });

      if (!this.isBoss) {
        const store = useGameStore.getState();
        const prevLevel = store.level;
        store.addXp(this.enemyData.xpReward);
        store.defeatEnemy(this.enemyData.id);
        EventBus.emit(EVENTS.XP_GAINED, this.enemyData.xpReward);

        const xpMsg = `+${this.enemyData.xpReward} XP`;
        this.setMessage(`${this.enemyData.name} defeated!\n${xpMsg}`);

        if (store.level > prevLevel) {
          EventBus.emit(EVENTS.LEVEL_UP, store.level);
          this.time.delayedCall(500, () => {
            this.setMessage(`${this.enemyData.name} defeated!\n${xpMsg}\nLEVEL UP! → ${store.level}!`);
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
      this.setMessage('You were overcome\nby the silence...');
      this.cameras.main.shake(500, 0.01);

      // Player sprite fades and drops
      this.tweens.add({
        targets: this.playerSprite,
        alpha: 0,
        y: this.playerSprite.y + 20,
        duration: 800,
        ease: 'Quad.easeIn',
      });

      this.time.delayedCall(1800, () => {
        this.cameras.main.fadeOut(600);
        this.time.delayedCall(600, () => {
          this.scene.stop('BattleScene');
          EventBus.emit(EVENTS.BATTLE_END, { outcome: 'lose', enemyId: this.enemyData.id, isBoss: this.isBoss });
        });
      });
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

  // ── Player attack animations ──────────────────────────────────────────────

  private playPlayerAttackAnimation(attack: Attack, onComplete: () => void): void {
    this.playPlayerAttackPrelude(attack, () => this.runPlayerAttackAnimation(attack, onComplete));
  }

  private playPlayerAttackPrelude(attack: Attack, onComplete: () => void): void {
    const W = this.scale.width;
    const colorHex = `#${attack.color.toString(16).padStart(6, '0')}`;
    const trackIndex = ['bass-drop', 'echo-wave', 'hook-impact', 'reverb-strike'].indexOf(attack.id) + 1;
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: `TRACK 0${trackIndex} // PLAYER SIGNAL`,
      title: attack.name,
      detail: attack.description,
      accent: colorHex,
      tone: 'combat',
      duration: 900,
    });

    const veil = this.add.rectangle(0, 0, W, this.battleH, 0x020504, 0)
      .setOrigin(0)
      .setDepth(26)
      .setName('battle-player-prelude');
    const signalBand = this.add.graphics().setDepth(27);
    signalBand.fillStyle(attack.color, 0.08);
    signalBand.fillRect(0, this.battleH * 0.31, W, 68);
    signalBand.lineStyle(1, attack.color, 0.54);
    signalBand.lineBetween(0, this.battleH * 0.31, W, this.battleH * 0.31);
    signalBand.lineBetween(0, this.battleH * 0.31 + 68, W, this.battleH * 0.31 + 68);
    signalBand.setAlpha(0);

    const kicker = this.add.text(W / 2, this.battleH * 0.31 + 11, `TRACK 0${trackIndex} // PLAYER SIGNAL`, {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#aab5ae', letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(28).setResolution(2).setAlpha(0).setVisible(false).setName('battle-player-kicker');
    const title = this.add.text(W / 2, this.battleH * 0.31 + 27, attack.name.toUpperCase(), {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '22px', color: colorHex, letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(28).setResolution(2).setAlpha(0).setScale(0.84).setVisible(false).setName('battle-player-title');

    const waveform = this.add.graphics().setDepth(28).setPosition(W / 2, this.battleH * 0.31 + 62);
    waveform.lineStyle(1, attack.color, 0.9);
    waveform.beginPath();
    waveform.moveTo(-102, 0);
    for (let wave = -96; wave <= 96; wave += 8) {
      const amplitude = wave % 24 === 0 ? 6 : wave % 16 === 0 ? 3 : 1;
      waveform.lineTo(wave, amplitude * (wave % 32 === 0 ? -1 : 1));
    }
    waveform.lineTo(102, 0);
    waveform.strokePath();
    waveform.setScale(0, 1).setAlpha(0);

    for (let ringIndex = 0; ringIndex < 3; ringIndex++) {
      const chargeRing = this.add.graphics()
        .setPosition(this.playerSprite.x, this.playerSprite.y)
        .setDepth(25)
        .setName('battle-player-charge');
      chargeRing.lineStyle(1.5, ringIndex === 1 ? 0xffffff : attack.color, 0.75);
      chargeRing.strokeCircle(0, 0, 20 + ringIndex * 7);
      chargeRing.setScale(1.8 + ringIndex * 0.18).setAlpha(0);
      this.tweens.add({
        targets: chargeRing,
        scaleX: 0.36,
        scaleY: 0.36,
        alpha: { from: 0, to: 0.85 },
        duration: 250 + ringIndex * 35,
        delay: ringIndex * 20,
        ease: 'Quad.easeIn',
        onComplete: () => chargeRing.destroy(),
      });
    }

    this.tweens.add({ targets: veil, alpha: 0.52, duration: 90, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: signalBand, alpha: 1, duration: 120 });
    this.tweens.add({ targets: kicker, alpha: 1, y: kicker.y - 3, duration: 120, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: title, alpha: 1, scaleX: 1, scaleY: 1, duration: 170, ease: 'Back.easeOut' });
    this.tweens.add({ targets: waveform, scaleX: 1, alpha: 1, duration: 210, ease: 'Cubic.easeOut' });

    this.time.delayedCall(300, () => {
      this.tweens.add({
        targets: [veil, signalBand, kicker, title, waveform],
        alpha: 0,
        duration: 120,
        onComplete: () => {
          veil.destroy(); signalBand.destroy(); kicker.destroy(); title.destroy(); waveform.destroy();
          onComplete();
        },
      });
    });
  }

  private runPlayerAttackAnimation(attack: Attack, onComplete: () => void): void {
    const W = this.scale.width;
    const color = attack.color;
    const eX = this.enemySprite.x;
    const eY = this.enemySprite.y;
    const pX = this.playerSprite.x;
    const pY = this.playerSprite.y;
    const pScaleX = this.playerSprite.scaleX;
    const pScaleY = this.playerSprite.scaleY;

    switch (attack.id) {

      // ── BASS DROP ─────────────────────────────────────────────────────
      // Heavy slam: player jumps up → slams down → ground crack travels →
      // massive shockwave + vertical pillar at enemy
      case 'bass-drop': {
        // Sub-bass compresses around the performer before the physical slam.
        for (let pulseIndex = 0; pulseIndex < 3; pulseIndex++) {
          const speakerPulse = this.add.graphics()
            .setPosition(pX, pY + 17)
            .setDepth(20)
            .setName('battle-bass-pulse');
          speakerPulse.lineStyle(2.5 - pulseIndex * 0.45, color, 0.9 - pulseIndex * 0.18);
          speakerPulse.strokeEllipse(0, 0, 26 + pulseIndex * 12, 9 + pulseIndex * 4);
          speakerPulse.setScale(0.35).setAlpha(0);
          this.tweens.add({
            targets: speakerPulse,
            scaleX: 2.5 + pulseIndex * 0.4,
            scaleY: 2.1 + pulseIndex * 0.32,
            alpha: { from: 0.9, to: 0 },
            duration: 360 + pulseIndex * 70,
            delay: pulseIndex * 55,
            ease: 'Cubic.easeOut',
            onComplete: () => speakerPulse.destroy(),
          });
        }

        const bassHorizon = this.add.graphics().setDepth(18).setAlpha(0.9);
        bassHorizon.lineStyle(1, color, 0.42);
        bassHorizon.beginPath();
        bassHorizon.moveTo(0, this.battleH * 0.88);
        for (let hx = 0; hx <= W; hx += 16) {
          const peak = Math.abs(hx - pX) < 64 ? (hx % 32 === 0 ? -8 : 5) : 0;
          bassHorizon.lineTo(hx, this.battleH * 0.88 + peak);
        }
        bassHorizon.strokePath();
        this.tweens.add({ targets: bassHorizon, alpha: 0, duration: 650, delay: 180, onComplete: () => bassHorizon.destroy() });

        // Phase 1: Player jumps up (wind-up)
        this.tweens.add({
          targets: this.playerSprite,
          y: pY - 25,
          scaleX: pScaleX * 0.9, scaleY: pScaleY * 1.08,
          duration: 230,
          ease: 'Quad.easeOut',
          onComplete: () => {
            // Phase 2: SLAM DOWN hard
            this.tweens.add({
              targets: this.playerSprite,
              y: pY + 6,
              scaleX: pScaleX * 1.14, scaleY: pScaleY * 0.84,
              duration: 85,
              ease: 'Quad.easeIn',
              onComplete: () => {
                // Reset player
                this.tweens.add({ targets: this.playerSprite, y: pY, scaleX: pScaleX, scaleY: pScaleY, duration: 220, ease: 'Back.easeOut' });

                this.cameras.main.shake(300, 0.012);

                // Ground crack line from player to enemy
                const crack = this.add.graphics().setDepth(19);
                const crackState = { headX: pX };
                const crackY = this.battleH * 0.88;
                this.tweens.add({
                  targets: crackState,
                  headX: eX,
                  duration: 200,
                  ease: 'Quad.easeIn',
                  onUpdate: () => {
                    crack.clear();
                    // Jagged crack
                    crack.lineStyle(3, color, 0.8);
                    crack.beginPath();
                    crack.moveTo(pX, crackY);
                    const segs = 12;
                    for (let i = 1; i <= segs; i++) {
                      const fx = pX + (crackState.headX - pX) * (i / segs);
                      if (fx > crackState.headX) break;
                      const jy = crackY + ((i % 2 === 0 ? 1 : -1) * (3 + Math.random() * 4));
                      crack.lineTo(fx, jy);
                    }
                    crack.strokePath();
                    // Glow around crack
                    crack.lineStyle(10, color, 0.1);
                    crack.beginPath();
                    crack.moveTo(pX, crackY);
                    crack.lineTo(crackState.headX, crackY);
                    crack.strokePath();
                  },
                  onComplete: () => {
                    this.tweens.add({ targets: crack, alpha: 0, duration: 500, onComplete: () => crack.destroy() });

                    // Phase 3: Vertical pillar of bass energy at enemy
                    const pillar = this.add.graphics().setDepth(20);
                    const pillarState = { h: 0, alpha: 1 };
                    this.tweens.add({
                      targets: pillarState,
                      h: this.battleH,
                      duration: 150,
                      ease: 'Quad.easeOut',
                      onUpdate: () => {
                        pillar.clear();
                        const topY = eY - pillarState.h / 2;
                        // Wide glow
                        pillar.fillStyle(color, 0.08);
                        pillar.fillRect(eX - 30, topY, 60, pillarState.h);
                        // Medium fill
                        pillar.fillStyle(color, 0.25);
                        pillar.fillRect(eX - 14, topY, 28, pillarState.h);
                        // Core beam
                        pillar.fillStyle(color, 0.6);
                        pillar.fillRect(eX - 5, topY, 10, pillarState.h);
                        // White center
                        pillar.fillStyle(0xffffff, 0.5);
                        pillar.fillRect(eX - 2, topY, 4, pillarState.h);
                      },
                    });

                    // Equalizer towers punch upward with the bass column.
                    for (let barIndex = -6; barIndex <= 6; barIndex++) {
                      const tower = this.add.rectangle(
                        eX + barIndex * 7,
                        eY + 24,
                        4,
                        14 + (6 - Math.abs(barIndex)) * 5,
                        barIndex % 3 === 0 ? 0xffffff : color,
                        0.85,
                      ).setOrigin(0.5, 1).setDepth(22).setScale(1, 0.05).setName('battle-bass-equalizer');
                      this.tweens.add({
                        targets: tower,
                        scaleY: 1,
                        y: eY + 12,
                        duration: 120 + Math.abs(barIndex) * 12,
                        delay: Math.abs(barIndex) * 9,
                        ease: 'Back.easeOut',
                        onComplete: () => {
                          this.tweens.add({
                            targets: tower,
                            y: tower.y - 24,
                            scaleY: 0.18,
                            alpha: 0,
                            duration: 300,
                            ease: 'Quad.easeOut',
                            onComplete: () => tower.destroy(),
                          });
                        },
                      });
                    }

                    // Shockwave rings at enemy
                    for (let ring = 0; ring < 4; ring++) {
                      const r = this.add.graphics().setDepth(21);
                      r.lineStyle(3 - ring * 0.5, color, 0.7);
                      r.strokeCircle(0, 0, 8);
                      r.setPosition(eX, eY);
                      r.setScale(0.5);
                      this.tweens.add({
                        targets: r,
                        scaleX: 5 + ring * 1.5,
                        scaleY: 3 + ring,
                        alpha: 0,
                        duration: 400 + ring * 80,
                        delay: ring * 60,
                        onComplete: () => r.destroy(),
                      });
                    }

                    // Bass note symbol
                    const note = this.add.text(eX, eY - 20, '♩', {
                      fontFamily: 'serif', fontSize: '28px', color: '#ffffff',
                    }).setOrigin(0.5).setDepth(22).setAlpha(0.9);
                    this.tweens.add({
                      targets: note,
                      y: eY - 60, alpha: 0, scaleX: 2, scaleY: 2,
                      duration: 500, ease: 'Quad.easeOut',
                      onComplete: () => note.destroy(),
                    });

                    // Ground debris particles
                    for (let d = 0; d < 8; d++) {
                      const debris = this.add.graphics().setDepth(20);
                      debris.fillStyle(d % 2 === 0 ? color : 0xffffff);
                      debris.fillRect(-2, -2, 4, 3);
                      debris.setPosition(eX + Phaser.Math.Between(-20, 20), eY + 15);
                      this.tweens.add({
                        targets: debris,
                        y: eY - 20 - Math.random() * 40,
                        x: debris.x + Phaser.Math.Between(-30, 30),
                        alpha: 0,
                        duration: 500,
                        ease: 'Quad.easeOut',
                        onComplete: () => debris.destroy(),
                      });
                    }

                    this.time.delayedCall(450, () => {
                      this.tweens.add({ targets: pillar, alpha: 0, duration: 200, onComplete: () => pillar.destroy() });
                      onComplete();
                    });
                  },
                });
              },
            });
          },
        });
        break;
      }

      // ── ECHO WAVE ─────────────────────────────────────────────────────
      // Sonic crescents: player pushes forward → two arc-shaped sound waves
      // sweep across the field → each explodes on impact with echo ripples
      case 'echo-wave': {
        const waveguide = this.add.graphics().setDepth(18).setName('battle-echo-waveguide');
        const waveguideState = { progress: 0 };
        this.tweens.add({
          targets: waveguideState,
          progress: 1,
          duration: 620,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            waveguide.clear();
            const maxX = pX + (eX - pX) * waveguideState.progress;
            for (let lane = -1; lane <= 1; lane += 2) {
              waveguide.lineStyle(lane < 0 ? 1 : 1.5, lane < 0 ? 0xffffff : color, lane < 0 ? 0.16 : 0.34);
              waveguide.beginPath();
              for (let x = pX; x <= maxX; x += 7) {
                const t = (x - pX) / Math.max(1, eX - pX);
                const centerY = pY + (eY - pY) * t;
                const envelope = Math.sin(t * Math.PI);
                const y = centerY + lane * Math.sin(t * Math.PI * 12) * 7 * envelope;
                if (x === pX) waveguide.moveTo(x, y);
                else waveguide.lineTo(x, y);
              }
              waveguide.strokePath();
            }
          },
        });
        this.tweens.add({
          targets: waveguide,
          alpha: 0,
          duration: 360,
          delay: 1080,
          onComplete: () => waveguide.destroy(),
        });

        // Player push motion
        this.tweens.add({
          targets: this.playerSprite,
          x: pX + 12,
          scaleX: pScaleX * 1.05,
          scaleY: pScaleY * 0.96,
          duration: 100,
          yoyo: true,
          ease: 'Quad.easeOut',
          onComplete: () => this.playerSprite.setScale(pScaleX, pScaleY),
        });

        const fireCrescent = (index: number, onDone: () => void) => {
          const crescent = this.add.graphics().setDepth(20 + index);
          const trail = this.add.graphics().setDepth(19 + index);
          const arcState = { progress: 0 };
          const crescentScale = 1 + index * 0.4;

          // Trailing particles
          const trailDots: { x: number; y: number; alpha: number }[] = [];

          this.tweens.add({
            targets: arcState,
            progress: 1,
            duration: 350 - index * 30,
            ease: 'Quad.easeIn',
            onUpdate: () => {
              const t = arcState.progress;
              const headX = pX + (eX - pX) * t;
              // The two waves split into high/low stereo lanes before converging.
              const laneDirection = index === 0 ? -1 : 1;
              const headY = pY + (eY - pY) * t
                + Math.sin(t * Math.PI) * laneDirection * (27 + index * 7);

              crescent.clear();
              trail.clear();

              // Draw crescent arc (opening facing right)
              const arcRadius = 18 * crescentScale;
              crescent.lineStyle(4 * crescentScale, color, 0.9);
              crescent.beginPath();
              for (let a = -0.6; a <= 0.6; a += 0.08) {
                const cx = headX + Math.cos(a + Math.PI) * arcRadius;
                const cy = headY + Math.sin(a) * arcRadius * 1.6;
                if (a === -0.6) crescent.moveTo(cx, cy);
                else crescent.lineTo(cx, cy);
              }
              crescent.strokePath();

              // Inner bright crescent
              crescent.lineStyle(1.5 * crescentScale, 0xffffff, 0.7);
              crescent.beginPath();
              for (let a = -0.4; a <= 0.4; a += 0.08) {
                const cx = headX + Math.cos(a + Math.PI) * (arcRadius * 0.7);
                const cy = headY + Math.sin(a) * arcRadius * 1.2;
                if (a === -0.4) crescent.moveTo(cx, cy);
                else crescent.lineTo(cx, cy);
              }
              crescent.strokePath();

              // Outer glow
              crescent.fillStyle(color, 0.08);
              crescent.fillCircle(headX, headY, arcRadius * 2);

              // Trail particles
              if (Math.random() < 0.5) {
                trailDots.push({ x: headX - 10 + Math.random() * 5, y: headY + (Math.random() - 0.5) * 16, alpha: 0.6 });
              }
              trailDots.forEach(dot => {
                dot.alpha -= 0.04;
                if (dot.alpha > 0) {
                  trail.fillStyle(color, dot.alpha);
                  trail.fillCircle(dot.x, dot.y, 2);
                }
              });
            },
            onComplete: () => {
              crescent.destroy();
              trail.destroy();

              // A short visual echo of the enemy sells the double-hit timing.
              for (let echoIndex = 0; echoIndex < 3; echoIndex++) {
                const echo = this.add.sprite(eX, eY, this.enemySprite.texture.key, this.enemySprite.frame.name)
                  .setOrigin(this.enemySprite.originX, this.enemySprite.originY)
                  .setScale(this.enemySprite.scaleX, this.enemySprite.scaleY)
                  .setTint(echoIndex === 1 ? 0xffffff : color)
                  .setAlpha(0.24 - echoIndex * 0.045)
                  .setDepth(this.enemySprite.depth - 0.1)
                  .setName('battle-echo-afterimage');
                const direction = echoIndex % 2 === 0 ? 1 : -1;
                this.tweens.add({
                  targets: echo,
                  x: eX + direction * (9 + echoIndex * 6),
                  scaleX: this.enemySprite.scaleX * (1.04 + echoIndex * 0.04),
                  scaleY: this.enemySprite.scaleY * (1.04 + echoIndex * 0.04),
                  alpha: 0,
                  duration: 280 + echoIndex * 55,
                  delay: echoIndex * 24,
                  ease: 'Quad.easeOut',
                  onComplete: () => echo.destroy(),
                });
              }

              // Impact burst at enemy
              const impact = this.add.graphics().setPosition(eX, eY).setDepth(22);
              // Central flash
              impact.fillStyle(0xffffff, 0.7);
              impact.fillCircle(0, 0, 10 * crescentScale);
              impact.fillStyle(color, 0.5);
              impact.fillCircle(0, 0, 20 * crescentScale);

              // Echo ripples expanding outward
              for (let r = 0; r < 3; r++) {
                const ripple = this.add.graphics().setDepth(21);
                ripple.lineStyle(2, color, 0.6);
                ripple.strokeCircle(0, 0, 8);
                ripple.setPosition(eX, eY);
                this.tweens.add({
                  targets: ripple,
                  scaleX: 3 + r, scaleY: 3 + r,
                  alpha: 0,
                  duration: 350,
                  delay: r * 80,
                  onComplete: () => ripple.destroy(),
                });
              }

              // Musical note scatter
              const noteChars = ['♪', '♫'];
              for (let n = 0; n < 3; n++) {
                const nt = this.add.text(eX, eY, noteChars[n % 2], {
                  fontFamily: 'serif', fontSize: '10px',
                  color: n === 0 ? '#ffffff' : '#' + color.toString(16).padStart(6, '0'),
                }).setOrigin(0.5).setDepth(23);
                const na = Math.random() * Math.PI * 2;
                this.tweens.add({
                  targets: nt,
                  x: eX + Math.cos(na) * 30, y: eY + Math.sin(na) * 30 - 10,
                  alpha: 0, duration: 400,
                  onComplete: () => nt.destroy(),
                });
              }

              this.tweens.add({
                targets: impact,
                alpha: 0, scaleX: 2, scaleY: 2,
                duration: 300,
                onComplete: () => { impact.destroy(); onDone(); },
              });

              if (index === 0) this.cameras.main.shake(120, 0.004);
              else this.cameras.main.shake(200, 0.008);
            },
          });
        };

        this.time.delayedCall(100, () => {
          fireCrescent(0, () => {
            this.time.delayedCall(120, () => {
              fireCrescent(1, onComplete);
            });
          });
        });
        break;
      }

      // ── HOOK IMPACT ───────────────────────────────────────────────────
      // Sharp melodic strike: player dashes with afterimage → freeze-frame →
      // X-slash materializes → starburst explosion + sparks rain
      case 'hook-impact': {
        // Tempo streaks snap the whole arena toward the target on the upbeat.
        for (let streakIndex = 0; streakIndex < 7; streakIndex++) {
          const streak = this.add.rectangle(
            pX - 30 - streakIndex * 14,
            pY - 36 + streakIndex * 11,
            34 + streakIndex * 8,
            streakIndex % 2 === 0 ? 2 : 1,
            streakIndex % 3 === 0 ? 0xffffff : color,
            0.72,
          ).setOrigin(1, 0.5).setDepth(21).setName('battle-hook-streak');
          this.tweens.add({
            targets: streak,
            x: eX + 40,
            scaleX: 2.4,
            alpha: 0,
            duration: 180 + streakIndex * 16,
            delay: streakIndex * 12,
            ease: 'Cubic.easeIn',
            onComplete: () => streak.destroy(),
          });
        }

        // Phase 1: Screen briefly dims
        const dim = this.add.graphics().setDepth(18);
        dim.fillStyle(0x000000, 0.3);
        dim.fillRect(0, 0, W, this.battleH + 10);
        dim.setAlpha(0);
        this.tweens.add({ targets: dim, alpha: 1, duration: 100 });

        // Phase 2: Player dash with afterimages
        const afterimages: Phaser.GameObjects.Sprite[] = [];
        const dashTarget = eX - 52;

        // Create afterimage trail
        for (let i = 0; i < 4; i++) {
          this.time.delayedCall(i * 30, () => {
            const ghost = this.add.sprite(
              this.playerSprite.x,
              this.playerSprite.y,
              this.playerSprite.texture.key,
              this.playerSprite.frame.name,
            );
            ghost
              .setOrigin(this.playerSprite.originX, this.playerSprite.originY)
              .setScale(pScaleX, pScaleY)
              .setDepth(19)
              .setAlpha(0.42 - i * 0.075)
              .setTint(i % 2 === 0 ? color : 0x49dfbf);
            afterimages.push(ghost);
            this.tweens.add({ targets: ghost, alpha: 0, duration: 300, delay: 60, onComplete: () => ghost.destroy() });
          });
        }

        // Dash player forward
        this.tweens.add({
          targets: this.playerSprite,
          x: dashTarget,
          duration: 120,
          ease: 'Quad.easeIn',
          onComplete: () => {
            // Phase 3: Freeze-frame flash (white overlay blink)
            this.cameras.main.flash(80, 255, 255, 255, false);

            for (let splitIndex = 0; splitIndex < 2; splitIndex++) {
              const split = this.add.sprite(eX, eY, this.enemySprite.texture.key, this.enemySprite.frame.name)
                .setOrigin(this.enemySprite.originX, this.enemySprite.originY)
                .setScale(this.enemySprite.scaleX, this.enemySprite.scaleY)
                .setTint(splitIndex === 0 ? color : 0x49dfbf)
                .setAlpha(0.34)
                .setDepth(this.enemySprite.depth - 0.1)
                .setName('battle-hook-signal-split');
              this.tweens.add({
                targets: split,
                x: eX + (splitIndex === 0 ? -15 : 15),
                y: eY + (splitIndex === 0 ? 4 : -4),
                alpha: 0,
                duration: 240,
                ease: 'Quad.easeOut',
                onComplete: () => split.destroy(),
              });
            }

            // Phase 4: X-slash at enemy — animated drawing
            const xSlash = this.add.graphics().setDepth(23);
            const slashState = { t: 0 };
            const slashLen = 55;

            this.tweens.add({
              targets: slashState,
              t: 1,
              duration: 120,
              ease: 'Quad.easeOut',
              onUpdate: () => {
                xSlash.clear();
                const progress = slashState.t;
                const len = slashLen * progress;

                // Slash 1: top-left to bottom-right
                // Glow
                xSlash.lineStyle(12, color, 0.15 * progress);
                xSlash.lineBetween(eX - len, eY - len, eX + len, eY + len);
                // Main
                xSlash.lineStyle(4, color, 0.9);
                xSlash.lineBetween(eX - len, eY - len, eX + len, eY + len);
                // White core
                xSlash.lineStyle(1.5, 0xffffff, 0.8);
                xSlash.lineBetween(eX - len, eY - len, eX + len, eY + len);

                // Slash 2: top-right to bottom-left
                xSlash.lineStyle(12, color, 0.15 * progress);
                xSlash.lineBetween(eX + len, eY - len, eX - len, eY + len);
                xSlash.lineStyle(4, color, 0.9);
                xSlash.lineBetween(eX + len, eY - len, eX - len, eY + len);
                xSlash.lineStyle(1.5, 0xffffff, 0.8);
                xSlash.lineBetween(eX + len, eY - len, eX - len, eY + len);
              },
              onComplete: () => {
                // Slash linger + fade
                this.tweens.add({
                  targets: xSlash,
                  alpha: 0, duration: 350, delay: 100,
                  onComplete: () => xSlash.destroy(),
                });
              },
            });

            // Phase 5: Impact — starburst + sparks (slight delay for drama)
            this.time.delayedCall(100, () => {
              this.cameras.main.shake(250, 0.012);

              // The melodic hook is a sharp waveform that closes around the target.
              const hookWave = this.add.graphics().setDepth(24).setName('battle-hook-wave');
              hookWave.lineStyle(10, color, 0.12);
              hookWave.beginPath();
              hookWave.moveTo(eX - 82, eY + 15);
              hookWave.lineTo(eX - 34, eY + 15);
              hookWave.lineTo(eX - 18, eY - 20);
              hookWave.lineTo(eX + 2, eY + 29);
              hookWave.lineTo(eX + 23, eY - 8);
              hookWave.lineTo(eX + 38, eY + 15);
              hookWave.lineTo(eX + 82, eY + 15);
              hookWave.strokePath();
              hookWave.lineStyle(2, 0xffffff, 0.88);
              hookWave.strokePath();
              hookWave.setScale(0.25, 1).setPosition(eX * 0.75, 0);
              this.tweens.add({
                targets: hookWave,
                scaleX: 1,
                x: 0,
                alpha: 0,
                duration: 360,
                ease: 'Cubic.easeOut',
                onComplete: () => hookWave.destroy(),
              });

              // Central starburst
              const star = this.add.graphics().setPosition(eX, eY).setDepth(24);
              // 12-point star
              for (let a = 0; a < 12; a++) {
                const angle = (a / 12) * Math.PI * 2;
                const len = a % 2 === 0 ? 30 : 16;
                star.lineStyle(a % 2 === 0 ? 2.5 : 1.5, 0xffffff, 0.9);
                star.lineBetween(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
              }
              // Central flash layers, from glow to white-hot core.
              star.fillStyle(color, 0.2);
              star.fillCircle(0, 0, 30);
              star.fillStyle(color, 0.6);
              star.fillCircle(0, 0, 18);
              star.fillStyle(0xffffff, 0.9);
              star.fillCircle(0, 0, 8);

              this.tweens.add({
                targets: star,
                alpha: 0, scaleX: 1.5, scaleY: 1.5,
                duration: 400,
                onComplete: () => star.destroy(),
              });

              // Spark shower (raining down from impact point)
              for (let s = 0; s < 14; s++) {
                const spark = this.add.graphics().setDepth(22);
                const isWhite = s % 3 === 0;
                spark.fillStyle(isWhite ? 0xffffff : color);
                const size = 1.5 + Math.random() * 2;
                spark.fillRect(-size / 2, -size / 2, size, size);
                spark.setPosition(eX + Phaser.Math.Between(-15, 15), eY + Phaser.Math.Between(-15, 15));
                const angle = (s / 14) * Math.PI * 2 + Math.random() * 0.5;
                const dist = 30 + Math.random() * 40;
                this.tweens.add({
                  targets: spark,
                  x: eX + Math.cos(angle) * dist,
                  y: eY + Math.sin(angle) * dist + 15,
                  alpha: 0,
                  duration: 450 + Math.random() * 200,
                  ease: 'Quad.easeOut',
                  onComplete: () => spark.destroy(),
                });
              }

              // Musical hook symbol
              const hookNote = this.add.text(eX, eY - 8, '♯', {
                fontFamily: 'serif', fontSize: '22px', color: '#ffffff',
              }).setOrigin(0.5).setDepth(25).setAlpha(0.9);
              this.tweens.add({
                targets: hookNote,
                y: eY - 50, alpha: 0, scaleX: 1.5, scaleY: 1.5,
                duration: 500, ease: 'Quad.easeOut',
                onComplete: () => hookNote.destroy(),
              });
            });

            // Player returns
            this.tweens.add({
              targets: this.playerSprite,
              x: pX,
              duration: 300,
              delay: 150,
              ease: 'Quad.easeOut',
            });

            // Dim fades
            this.tweens.add({
              targets: dim,
              alpha: 0, duration: 400, delay: 250,
              onComplete: () => dim.destroy(),
            });

            this.time.delayedCall(500, onComplete);
          },
        });
        break;
      }

      // ── REVERB STRIKE ─────────────────────────────────────────────────
      case 'reverb-strike': {
        // Phase 1: Screen dims
        const dimOverlay = this.add.graphics().setDepth(18);
        dimOverlay.fillStyle(0x000000, 1);
        dimOverlay.fillRect(0, 0, W, this.battleH + 10);
        dimOverlay.setAlpha(0);
        this.tweens.add({
          targets: dimOverlay,
          alpha: 0.62,
          duration: 240,
        });

        // A record-like resonance field spins up around the performer.
        for (let orbitIndex = 0; orbitIndex < 5; orbitIndex++) {
          const orbit = this.add.graphics()
            .setPosition(pX, pY - 8)
            .setDepth(20)
            .setName('battle-reverb-orbit');
          orbit.lineStyle(orbitIndex === 0 ? 2 : 1, orbitIndex % 2 === 0 ? color : 0xffffff, 0.68 - orbitIndex * 0.08);
          orbit.strokeEllipse(0, 0, 25 + orbitIndex * 17, 12 + orbitIndex * 8);
          orbit.lineBetween(12 + orbitIndex * 8, -2, 16 + orbitIndex * 9, 2);
          orbit.setAngle(-16 + orbitIndex * 7).setScale(0.35).setAlpha(0);
          this.tweens.add({
            targets: orbit,
            scaleX: 1.15,
            scaleY: 1.15,
            angle: orbit.angle + (orbitIndex % 2 === 0 ? 28 : -28),
            alpha: { from: 0, to: 0.76 },
            duration: 470 + orbitIndex * 45,
            delay: orbitIndex * 35,
            ease: 'Sine.easeOut',
          });
          this.tweens.add({
            targets: orbit,
            alpha: 0,
            scaleX: 1.8,
            scaleY: 1.8,
            duration: 280,
            delay: 650 + orbitIndex * 25,
            onComplete: () => orbit.destroy(),
          });
        }

        // Player power-up glow
        const playerGlow = this.add.graphics().setDepth(19);
        playerGlow.fillStyle(color, 0.3);
        playerGlow.fillCircle(pX, pY, 30);
        playerGlow.fillStyle(0xffffff, 0.15);
        playerGlow.fillCircle(pX, pY, 20);
        this.tweens.add({
          targets: playerGlow,
          scaleX: 1.5, scaleY: 1.5,
          alpha: 0,
          duration: 500,
          onComplete: () => playerGlow.destroy(),
        });

        // Phase 2: Pulsing rings radiate from player
        this.time.delayedCall(280, () => {
          const chargeRings = this.add.graphics().setDepth(20);
          let chargeT = 0;
          this.time.addEvent({
            delay: 16,
            repeat: 20,
            callback: () => {
              chargeT++;
              chargeRings.clear();
              for (let i = 0; i < 4; i++) {
                const r = (chargeT * 3.5 + i * 10) % 50;
                const alpha = 0.7 - r / 50;
                chargeRings.lineStyle(2, color, alpha);
                chargeRings.strokeCircle(pX, pY - 10, r);
              }
            },
          });

          // Phase 3: Beam shoots from player to enemy
          this.time.delayedCall(350, () => {
            chargeRings.destroy();

            const beam = this.add.graphics().setDepth(21);
            const beamState = { progress: 0 };
            this.tweens.add({
              targets: beamState,
              progress: 1,
              duration: 210,
              ease: 'Quad.easeIn',
              onUpdate: () => {
                beam.clear();
                const startY = pY - 10;
                const headX = pX + (eX - pX) * beamState.progress;
                const headY = startY + (eY - startY) * beamState.progress;
                beam.lineStyle(25, color, 0.09);
                beam.lineBetween(pX, startY, headX, headY);
                beam.lineStyle(11, color, 0.48);
                beam.lineBetween(pX, startY, headX, headY);
                beam.lineStyle(4, color, 0.94);
                beam.lineBetween(pX, startY, headX, headY);
                beam.lineStyle(1.5, 0xffffff, 0.9);
                beam.lineBetween(pX, startY, headX, headY);
                beam.fillStyle(0xffffff, 0.8);
                beam.fillCircle(headX, headY, 4 + beamState.progress * 4);
              },
              onComplete: () => {
                beam.destroy();

                // Phase 4: Explosion at enemy
                const explosion = this.add.graphics().setDepth(23);
                const expState = { r: 5, alpha: 1 };
                this.time.addEvent({
                  delay: 16,
                  repeat: 22,
                  callback: () => {
                    expState.r += 5.5;
                    expState.alpha = Math.max(0, 1 - expState.r / 130);
                    explosion.clear();
                    // Outer glow
                    explosion.fillStyle(color, expState.alpha * 0.15);
                    explosion.fillCircle(eX, eY, expState.r * 1.3);
                    // Outer ring
                    explosion.lineStyle(4, color, expState.alpha);
                    explosion.strokeCircle(eX, eY, expState.r);
                    // Inner fill
                    explosion.fillStyle(0xffffff, expState.alpha * 0.35);
                    explosion.fillCircle(eX, eY, expState.r * 0.5);
                    // Cross flare
                    explosion.lineStyle(2, 0xffffff, expState.alpha * 0.6);
                    explosion.lineBetween(eX - expState.r, eY, eX + expState.r, eY);
                    explosion.lineBetween(eX, eY - expState.r, eX, eY + expState.r);
                    // Diagonal flare
                    explosion.lineStyle(1, color, expState.alpha * 0.4);
                    const d = expState.r * 0.7;
                    explosion.lineBetween(eX - d, eY - d, eX + d, eY + d);
                    explosion.lineBetween(eX + d, eY - d, eX - d, eY + d);
                  },
                });

                // Scatter debris particles
                for (let p = 0; p < 16; p++) {
                  const particle = this.add.graphics().setDepth(22);
                  particle.fillStyle(p % 3 === 0 ? 0xffffff : color);
                  particle.fillRect(-1.5, -1.5, 3, 3);
                  particle.setPosition(eX, eY);
                  const angle = (p / 16) * Math.PI * 2;
                  const dist = 45 + Math.random() * 45;
                  this.tweens.add({
                    targets: particle,
                    x: eX + Math.cos(angle) * dist,
                    y: eY + Math.sin(angle) * dist,
                    alpha: 0,
                    duration: 550,
                    ease: 'Quad.easeOut',
                    onComplete: () => particle.destroy(),
                  });
                }

                // Three delayed reflections make the ultimate feel like reverb,
                // not a single generic beam impact.
                for (let echoIndex = 0; echoIndex < 3; echoIndex++) {
                  const echoRing = this.add.graphics()
                    .setPosition(eX, eY)
                    .setDepth(24 - echoIndex * 0.1)
                    .setName('battle-reverb-reflection');
                  echoRing.lineStyle(3 - echoIndex * 0.55, echoIndex === 1 ? 0xffffff : color, 0.9);
                  echoRing.strokeEllipse(0, 0, 24, 24);
                  echoRing.lineStyle(1, color, 0.5);
                  echoRing.strokeEllipse(0, 0, 38, 16);
                  echoRing.setScale(0.2).setAlpha(0);
                  this.tweens.add({
                    targets: echoRing,
                    scaleX: 3.2 + echoIndex * 1.1,
                    scaleY: 2.35 + echoIndex * 0.72,
                    alpha: { from: 0.92 - echoIndex * 0.16, to: 0 },
                    angle: echoIndex % 2 === 0 ? 18 : -18,
                    duration: 430 + echoIndex * 100,
                    delay: echoIndex * 125,
                    ease: 'Cubic.easeOut',
                    onComplete: () => echoRing.destroy(),
                  });

                  const reflectedEnemy = this.add.sprite(eX, eY, this.enemySprite.texture.key, this.enemySprite.frame.name)
                    .setOrigin(this.enemySprite.originX, this.enemySprite.originY)
                    .setScale(this.enemySprite.scaleX, this.enemySprite.scaleY)
                    .setTint(echoIndex === 1 ? 0xffffff : color)
                    .setAlpha(0)
                    .setDepth(this.enemySprite.depth - 0.1)
                    .setName('battle-reverb-afterimage');
                  this.tweens.add({
                    targets: reflectedEnemy,
                    alpha: { from: 0.25 - echoIndex * 0.045, to: 0 },
                    scaleX: this.enemySprite.scaleX * (1.1 + echoIndex * 0.09),
                    scaleY: this.enemySprite.scaleY * (1.1 + echoIndex * 0.09),
                    delay: echoIndex * 125,
                    duration: 360 + echoIndex * 80,
                    ease: 'Quad.easeOut',
                    onComplete: () => reflectedEnemy.destroy(),
                  });
                }

                this.cameras.main.shake(400, 0.016);
                this.cameras.main.flash(300,
                  (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff
                );

                this.time.delayedCall(550, () => {
                  explosion.destroy();
                  this.tweens.add({
                    targets: dimOverlay,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => { dimOverlay.destroy(); onComplete(); },
                  });
                });
              },
            });
          });
        });
        break;
      }

      default:
        this.time.delayedCall(300, onComplete);
    }
  }

  // ── Enemy attack animation ──────────────────────────────────────────────

  private playEnemyAttackAnimation(attack: { name: string; damage: number }, onComplete: () => void): void {
    this.playEnemyAttackPrelude(attack, () => this.runEnemyAttackAnimation(attack, onComplete));
  }

  private playEnemyAttackPrelude(attack: { name: string; damage: number }, onComplete: () => void): void {
    const W = this.scale.width;
    const hostileColor = this.isBoss ? 0xff3d57 : 0xff6b3d;
    const hostileHex = `#${hostileColor.toString(16).padStart(6, '0')}`;
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: `HOSTILE TRANSMISSION // ${this.enemyData.name.toUpperCase()}`,
      title: attack.name,
      detail: 'Incoming signal. Brace for impact.',
      accent: hostileHex,
      tone: 'danger',
      duration: 900,
    });

    const veil = this.add.rectangle(0, 0, W, this.battleH, 0x120304, 0)
      .setOrigin(0)
      .setDepth(26)
      .setName('battle-enemy-prelude');
    const band = this.add.graphics().setDepth(27).setAlpha(0);
    band.fillStyle(hostileColor, 0.09);
    band.fillRect(0, this.battleH * 0.31, W, 68);
    band.fillStyle(hostileColor, 0.9);
    band.fillRect(0, this.battleH * 0.31, W, 2);
    band.fillRect(0, this.battleH * 0.31 + 66, W, 2);
    band.fillStyle(0x050908, 0.75);
    for (let stripe = -20; stripe < W; stripe += 28) {
      band.fillRect(stripe, this.battleH * 0.31, 9, 2);
    }

    const kicker = this.add.text(W / 2, this.battleH * 0.31 + 11, `HOSTILE TRANSMISSION // ${this.enemyData.name.toUpperCase()}`, {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#ffb09a', letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(28).setResolution(2).setAlpha(0).setVisible(false).setName('battle-enemy-kicker');
    const title = this.add.text(W / 2, this.battleH * 0.31 + 28, attack.name.toUpperCase(), {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '21px', color: hostileHex, letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(28).setResolution(2).setAlpha(0).setScale(1.18, 0.75).setVisible(false).setName('battle-enemy-title');
    const warningLeft = this.add.text(18, this.battleH * 0.31 + 29, '!!', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '13px', color: hostileHex,
    }).setDepth(28).setResolution(2).setAlpha(0).setVisible(false);
    const warningRight = this.add.text(W - 18, this.battleH * 0.31 + 29, '!!', {
      fontFamily: 'DM Mono', fontStyle: 'bold', fontSize: '13px', color: hostileHex,
    }).setOrigin(1, 0).setDepth(28).setResolution(2).setAlpha(0).setVisible(false);

    const sweep = this.add.rectangle(W + 50, this.battleH / 2, 72, this.battleH, hostileColor, 0.1)
      .setDepth(27)
      .setAngle(9)
      .setName('battle-hostile-sweep');
    this.tweens.add({ targets: sweep, x: -70, duration: 310, ease: 'Cubic.easeIn', onComplete: () => sweep.destroy() });

    for (let ringIndex = 0; ringIndex < 3; ringIndex++) {
      const chargeRing = this.add.graphics()
        .setPosition(this.enemySprite.x, this.enemySprite.y)
        .setDepth(25)
        .setName('battle-enemy-charge');
      chargeRing.lineStyle(1.5, ringIndex === 1 ? 0xffffff : hostileColor, 0.8);
      chargeRing.strokePoints([
        new Phaser.Math.Vector2(0, -24 - ringIndex * 6),
        new Phaser.Math.Vector2(24 + ringIndex * 6, 0),
        new Phaser.Math.Vector2(0, 24 + ringIndex * 6),
        new Phaser.Math.Vector2(-24 - ringIndex * 6, 0),
      ], true);
      chargeRing.setScale(0.35).setAlpha(0);
      this.tweens.add({
        targets: chargeRing,
        scaleX: 1.55 + ringIndex * 0.2,
        scaleY: 1.55 + ringIndex * 0.2,
        angle: 45 + ringIndex * 18,
        alpha: { from: 0.92, to: 0 },
        duration: 270 + ringIndex * 35,
        delay: ringIndex * 22,
        ease: 'Quad.easeOut',
        onComplete: () => chargeRing.destroy(),
      });
    }

    this.tweens.add({ targets: veil, alpha: 0.48, duration: 80 });
    this.tweens.add({ targets: band, alpha: 1, duration: 90 });
    this.tweens.add({ targets: [kicker, warningLeft, warningRight], alpha: 1, duration: 100 });
    this.tweens.add({ targets: title, alpha: 1, scaleX: 1, scaleY: 1, duration: 150, ease: 'Back.easeOut' });
    this.cameras.main.shake(160, 0.003);

    this.time.delayedCall(300, () => {
      this.tweens.add({
        targets: [veil, band, kicker, title, warningLeft, warningRight],
        alpha: 0,
        duration: 110,
        onComplete: () => {
          veil.destroy(); band.destroy(); kicker.destroy(); title.destroy(); warningLeft.destroy(); warningRight.destroy();
          onComplete();
        },
      });
    });
  }

  private runEnemyAttackAnimation(attack: { name: string; damage: number }, onComplete: () => void): void {
    const origX = this.enemySprite.x;
    const origY = this.enemySprite.y;
    const pX = this.playerSprite.x;
    const pY = this.playerSprite.y;
    const origScaleX = this.enemySprite.scaleX;
    const origScaleY = this.enemySprite.scaleY;

    // Different attack styles based on enemy type
    const enemyId = this.enemyData.id;

    if (enemyId === 'static-noise' || attack.name.toLowerCase().includes('static')) {
      // Electric attack — zap bolts
      this.playZapAttack(origX, origY, pX, pY, onComplete);
    } else if (enemyId === 'broken-signal' || attack.name.toLowerCase().includes('glitch')) {
      // Glitch attack — screen corruption effect
      this.playGlitchAttack(origX, origY, pX, pY, onComplete);
    } else if (enemyId === 'silence' || attack.name.toLowerCase().includes('void')) {
      // Void attack — dark wave
      this.playVoidAttack(origX, origY, pX, pY, onComplete);
    } else {
      // Default / boss — enhanced lunge
      this.playLungeAttack(origX, origY, pX, pY, origScaleX, origScaleY, onComplete);
    }
  }

  private playLungeAttack(origX: number, origY: number, pX: number, pY: number, origScaleX: number, origScaleY: number, onComplete: () => void): void {
    const lungeX = origX - (origX - pX) * 0.4;
    const lungeY = origY + (pY - origY) * 0.3;

    // A hostile vector locks onto the player before the physical strike.
    const attackVector = this.add.graphics().setDepth(20).setName('battle-lunge-vector');
    attackVector.lineStyle(10, 0xff4444, 0.08);
    attackVector.lineBetween(origX, origY, pX, pY);
    attackVector.lineStyle(1, 0xff8a66, 0.72);
    attackVector.lineBetween(origX, origY, pX, pY);
    for (let marker = 1; marker < 6; marker++) {
      const t = marker / 6;
      const mx = origX + (pX - origX) * t;
      const my = origY + (pY - origY) * t;
      attackVector.fillStyle(0xffffff, 0.75 - marker * 0.08);
      attackVector.fillTriangle(mx - 4, my - 3, mx + 3, my, mx - 4, my + 3);
    }
    attackVector.setAlpha(0);
    this.tweens.add({ targets: attackVector, alpha: 1, duration: 90 });

    const lock = this.add.graphics().setPosition(pX, pY).setDepth(21).setName('battle-lunge-lock');
    lock.lineStyle(2, 0xff5c66, 0.88);
    lock.strokeCircle(0, 0, 22);
    lock.lineBetween(-32, -22, -18, -22); lock.lineBetween(-32, -22, -32, -8);
    lock.lineBetween(32, 22, 18, 22); lock.lineBetween(32, 22, 32, 8);
    lock.setScale(1.5).setAlpha(0);
    this.tweens.add({ targets: lock, scaleX: 1, scaleY: 1, angle: 20, alpha: 1, duration: 130, ease: 'Back.easeOut' });

    const chargeGlow = this.add.graphics().setPosition(origX, origY).setDepth(19);
    chargeGlow.fillStyle(0xff4444, 0.3);
    chargeGlow.fillCircle(0, 0, 25);
    this.tweens.add({
      targets: chargeGlow,
      alpha: 0,
      scaleX: 0.3, scaleY: 0.3,
      duration: 160,
      onComplete: () => chargeGlow.destroy(),
    });

    for (let ghostIndex = 0; ghostIndex < 3; ghostIndex++) {
      this.time.delayedCall(45 + ghostIndex * 32, () => {
        const ghost = this.add.sprite(this.enemySprite.x, this.enemySprite.y, this.enemySprite.texture.key, this.enemySprite.frame.name)
          .setOrigin(this.enemySprite.originX, this.enemySprite.originY)
          .setScale(origScaleX, origScaleY)
          .setTint(ghostIndex % 2 === 0 ? 0xff5c66 : 0xffb36b)
          .setAlpha(0.28 - ghostIndex * 0.05)
          .setDepth(this.enemySprite.depth - 0.1)
          .setName('battle-lunge-afterimage');
        this.tweens.add({ targets: ghost, alpha: 0, duration: 240, onComplete: () => ghost.destroy() });
      });
    }

    this.tweens.add({
      targets: this.enemySprite,
      x: lungeX,
      y: lungeY,
      scaleX: origScaleX * 1.12,
      scaleY: origScaleY * 1.12,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.tweens.add({ targets: [attackVector, lock], alpha: 0, duration: 90, onComplete: () => { attackVector.destroy(); lock.destroy(); } });
        // Impact flash at player — multiple layers
        const impact = this.add.graphics().setPosition(pX, pY).setDepth(20);
        impact.fillStyle(0xff4444, 0.15);
        impact.fillCircle(0, 0, 40);
        impact.fillStyle(0xff4444, 0.4);
        impact.fillCircle(0, 0, 22);
        impact.fillStyle(0xffffff, 0.5);
        impact.fillCircle(0, 0, 8);
        this.tweens.add({
          targets: impact,
          alpha: 0,
          scaleX: 1.6, scaleY: 1.6,
          duration: 280,
          onComplete: () => impact.destroy(),
        });

        // Impact sparks
        for (let i = 0; i < 6; i++) {
          const spark = this.add.graphics().setDepth(20);
          spark.fillStyle(i % 2 === 0 ? 0xffffff : 0xff6644);
          spark.fillRect(-1, -1, 2, 2);
          spark.setPosition(pX, pY);
          const angle = Math.random() * Math.PI * 2;
          this.tweens.add({
            targets: spark,
            x: pX + Math.cos(angle) * (20 + Math.random() * 20),
            y: pY + Math.sin(angle) * (20 + Math.random() * 20),
            alpha: 0,
            duration: 300,
            onComplete: () => spark.destroy(),
          });
        }

        if (this.isBoss) this.cameras.main.shake(180, 0.007);

        // Return to original position
        this.tweens.add({
          targets: this.enemySprite,
          x: origX,
          y: origY,
          scaleX: origScaleX,
          scaleY: origScaleY,
          duration: 300,
          ease: 'Quad.easeOut',
          onComplete,
        });
      },
    });
  }

  private playZapAttack(origX: number, origY: number, pX: number, pY: number, onComplete: () => void): void {
    // Frequency nodes preview the route before the unstable current connects.
    for (let nodeIndex = 0; nodeIndex < 6; nodeIndex++) {
      const t = (nodeIndex + 1) / 7;
      const node = this.add.graphics()
        .setPosition(origX + (pX - origX) * t, origY + (pY - origY) * t)
        .setDepth(21)
        .setName('battle-zap-node');
      node.lineStyle(1, nodeIndex % 2 === 0 ? 0xffffff : 0x00ddff, 0.82);
      node.strokeCircle(0, 0, 3 + (nodeIndex % 2) * 2);
      node.setScale(0.25).setAlpha(0);
      this.tweens.add({
        targets: node,
        scaleX: 1.65,
        scaleY: 1.65,
        alpha: { from: 0, to: 0.86 },
        duration: 130,
        delay: nodeIndex * 24,
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: () => node.destroy(),
      });
    }

    // Lightning bolt zigzag from enemy to player
    const bolt = this.add.graphics().setDepth(22);
    const segments = 8;
    const dx = (pX - origX) / segments;
    const dy = (pY - origY) / segments;

    let frame = 0;
    this.time.addEvent({
      delay: 16,
      repeat: 18,
      callback: () => {
        frame++;
        bolt.clear();

        const points: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(origX, origY)];
        for (let i = 1; i <= Math.min(frame, segments); i++) {
          const jitter = (Math.random() - 0.5) * 30;
          points.push(new Phaser.Math.Vector2(
            origX + dx * i + (i < segments ? jitter : 0),
            origY + dy * i + (i < segments ? jitter * 0.5 : 0),
          ));
        }

        // Draw glow first, then the exact same path as a white-hot core.
        bolt.lineStyle(11, 0x00ddff, 0.14);
        bolt.beginPath();
        points.forEach((point, index) => index === 0 ? bolt.moveTo(point.x, point.y) : bolt.lineTo(point.x, point.y));
        bolt.strokePath();
        bolt.lineStyle(3, 0x00ddff, 0.96);
        bolt.beginPath();
        points.forEach((point, index) => index === 0 ? bolt.moveTo(point.x, point.y) : bolt.lineTo(point.x, point.y));
        bolt.strokePath();
        bolt.lineStyle(1, 0xffffff, 0.88);
        bolt.beginPath();
        points.forEach((point, index) => index === 0 ? bolt.moveTo(point.x, point.y) : bolt.lineTo(point.x, point.y));
        bolt.strokePath();

        points.slice(2, -1).forEach((point, index) => {
          if ((index + frame) % 2 !== 0) return;
          bolt.lineStyle(1, 0x91f4ff, 0.55);
          bolt.lineBetween(point.x, point.y, point.x + (index % 2 === 0 ? 12 : -12), point.y - 8 - index * 2);
        });
      },
    });

    this.time.delayedCall(320, () => {
      bolt.destroy();
      // Impact flash
      const flash = this.add.graphics().setPosition(pX, pY).setDepth(21);
      flash.fillStyle(0x00ddff, 0.5);
      flash.fillCircle(0, 0, 20);
      flash.fillStyle(0xffffff, 0.6);
      flash.fillCircle(0, 0, 8);

      for (let cageIndex = 0; cageIndex < 3; cageIndex++) {
        const cage = this.add.graphics().setPosition(pX, pY).setDepth(22).setName('battle-zap-cage');
        cage.lineStyle(2, cageIndex === 1 ? 0xffffff : 0x00ddff, 0.82);
        cage.strokePoints([
          new Phaser.Math.Vector2(0, -18 - cageIndex * 5),
          new Phaser.Math.Vector2(16 + cageIndex * 5, 10 + cageIndex * 3),
          new Phaser.Math.Vector2(-16 - cageIndex * 5, 10 + cageIndex * 3),
        ], true);
        this.tweens.add({
          targets: cage,
          scaleX: 1.8 + cageIndex * 0.3,
          scaleY: 1.8 + cageIndex * 0.3,
          angle: cageIndex % 2 === 0 ? 35 : -35,
          alpha: 0,
          duration: 280 + cageIndex * 70,
          delay: cageIndex * 35,
          onComplete: () => cage.destroy(),
        });
      }
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scaleX: 1.8, scaleY: 1.8,
        duration: 250,
        onComplete: () => { flash.destroy(); onComplete(); },
      });
    });
  }

  private playGlitchAttack(origX: number, origY: number, pX: number, pY: number, onComplete: () => void): void {
    const W = this.scale.width;
    const radioColors = [0xcc1111, 0xff6600, 0xffaa00, 0xffdd44, 0x8b1a1a];

    // Phase 1: Radio interference — crimson/amber glitch bars + static burst
    const glitch = this.add.graphics().setDepth(22);
    this.time.addEvent({
      delay: 35,
      repeat: 14,
      callback: () => {
        glitch.clear();
        for (let i = 0; i < 5; i++) {
          const barY = Phaser.Math.Between(10, this.battleH - 10);
          const barH = Phaser.Math.Between(1, 6);
          const c = radioColors[Math.floor(Math.random() * radioColors.length)];
          glitch.fillStyle(c, 0.2 + Math.random() * 0.2);
          glitch.fillRect(0, barY, W, barH);
        }
        // Screen tear strips
        for (let i = 0; i < 2; i++) {
          const stripY = Phaser.Math.Between(30, this.battleH - 30);
          const stripH = Phaser.Math.Between(8, 20);
          glitch.fillStyle(0x1a0000, 0.3);
          glitch.fillRect(Phaser.Math.Between(-30, 0), stripY, W + 30, stripH);
        }
      },
    });

    // Phase 2: Speaker shockwave — dual bass rings from enemy's speakers
    this.time.delayedCall(80, () => {
      for (const side of [-1, 1]) {
        const sx = origX + 25 * side;
        for (let r = 0; r < 3; r++) {
          const ring = this.add.graphics().setDepth(23);
          ring.lineStyle(2.5, 0xcc8800, 0.7);
          ring.strokeCircle(0, 0, 8);
          ring.setPosition(sx, origY);
          this.tweens.add({
            targets: ring,
            scaleX: 5 + r * 2,
            scaleY: 3 + r,
            alpha: 0,
            duration: 400 + r * 100,
            delay: r * 60,
            onComplete: () => ring.destroy(),
          });
        }
      }

      // Frequency beam — amber line with distortion traveling to player
      const beam = this.add.graphics().setDepth(23);
      const beamState = { progress: 0 };

      this.tweens.add({
        targets: beamState,
        progress: 1,
        duration: 280,
        ease: 'Quad.easeIn',
        onUpdate: () => {
          beam.clear();
          const headX = origX + (pX - origX) * beamState.progress;
          const headY = origY + (pY - origY) * beamState.progress;
          beam.lineStyle(24, 0xff6600, 0.08);
          beam.lineBetween(origX, origY, headX, headY);
          // Core frequency line follows the real enemy-to-player vector.
          beam.lineStyle(3, 0xffaa00, 0.85);
          beam.beginPath();
          beam.moveTo(origX, origY);
          for (let i = 0; i <= 16; i++) {
            const t = (i / 16) * beamState.progress;
            const sx = origX + (pX - origX) * t;
            const sy = origY + (pY - origY) * t;
            const jitter = Math.sin(t * 18 + beamState.progress * 9) * 8 * Math.sin(t * Math.PI);
            beam.lineTo(sx, sy + jitter);
          }
          beam.strokePath();
          // White hot core
          beam.lineStyle(1, 0xffffff, 0.5);
          beam.lineBetween(origX, origY, headX, headY);
        },
        onComplete: () => {
          this.tweens.add({ targets: beam, alpha: 0, duration: 200, onComplete: () => beam.destroy() });
        },
      });
    });

    // Phase 3: Crimson shrapnel — metal shards from the broken radio
    this.time.delayedCall(200, () => {
      for (let i = 0; i < 8; i++) {
        const shard = this.add.graphics().setDepth(21);
        const c = radioColors[i % radioColors.length];
        // Elongated metal shard shape
        shard.fillStyle(c, 0.85);
        shard.fillRect(-2, -4, 4, 8);
        shard.setPosition(origX + Phaser.Math.Between(-25, 25), origY + Phaser.Math.Between(-15, 15));
        this.tweens.add({
          targets: shard,
          x: pX + Phaser.Math.Between(-18, 18),
          y: pY + Phaser.Math.Between(-18, 18),
          angle: Phaser.Math.Between(180, 720),
          duration: 180 + i * 35,
          ease: 'Quad.easeIn',
          onComplete: () => shard.destroy(),
        });
      }
    });

    // Phase 4: Impact — fiery radio burst + bass rings at player
    this.time.delayedCall(520, () => {
      glitch.destroy();
      this.cameras.main.shake(200, 0.008);

      // Central impact — crimson + amber + white
      const impact = this.add.graphics().setPosition(pX, pY).setDepth(22);
      impact.fillStyle(0x8b1a1a, 0.5);
      impact.fillCircle(0, 0, 24);
      impact.fillStyle(0xff6600, 0.4);
      impact.fillCircle(0, 0, 16);
      impact.fillStyle(0xffdd44, 0.5);
      impact.fillCircle(0, 0, 8);
      impact.fillStyle(0xffffff, 0.5);
      impact.fillCircle(0, 0, 4);

      // Bass disruption rings
      for (let r = 0; r < 3; r++) {
        const ring = this.add.graphics().setDepth(21);
        const rc = [0xcc8800, 0xff4400, 0xffaa00][r];
        ring.lineStyle(2, rc, 0.6);
        ring.strokeCircle(0, 0, 6);
        ring.setPosition(pX, pY);
        this.tweens.add({
          targets: ring,
          scaleX: 3.5 + r, scaleY: 3.5 + r,
          alpha: 0,
          duration: 300 + r * 80,
          delay: r * 50,
          onComplete: () => ring.destroy(),
        });
      }

      // Hot metal debris scatter
      for (let d = 0; d < 8; d++) {
        const debris = this.add.graphics().setDepth(22);
        const dc = radioColors[d % radioColors.length];
        debris.fillStyle(dc, 0.8);
        debris.fillRect(-1.5, -1.5, 3, 3);
        debris.setPosition(pX, pY);
        const angle = (d / 8) * Math.PI * 2;
        this.tweens.add({
          targets: debris,
          x: pX + Math.cos(angle) * 35,
          y: pY + Math.sin(angle) * 35,
          alpha: 0,
          angle: 180,
          duration: 400,
          ease: 'Quad.easeOut',
          onComplete: () => debris.destroy(),
        });
      }

      this.tweens.add({
        targets: impact,
        alpha: 0,
        scaleX: 2, scaleY: 2,
        duration: 300,
        onComplete: () => { impact.destroy(); onComplete(); },
      });
    });
  }

  private playVoidAttack(origX: number, origY: number, pX: number, pY: number, onComplete: () => void): void {
    const voidPurple = 0x8d4ac7;
    const voidTeal = 0x49dfbf;
    const veil = this.add.rectangle(0, 0, this.scale.width, this.battleH, 0x050107, 0)
      .setOrigin(0)
      .setDepth(19)
      .setName('battle-void-veil');
    this.tweens.add({ targets: veil, alpha: 0.46, duration: 150 });

    // Rings are pulled inward to form a moving pocket of silence.
    for (let ringIndex = 0; ringIndex < 4; ringIndex++) {
      const collapseRing = this.add.graphics()
        .setPosition(origX, origY)
        .setDepth(21)
        .setName('battle-void-collapse');
      collapseRing.lineStyle(2 - ringIndex * 0.25, ringIndex % 2 === 0 ? voidPurple : voidTeal, 0.76);
      collapseRing.strokeEllipse(0, 0, 42 + ringIndex * 18, 28 + ringIndex * 12);
      collapseRing.setScale(1.8 + ringIndex * 0.2).setAlpha(0);
      this.tweens.add({
        targets: collapseRing,
        scaleX: 0.12,
        scaleY: 0.12,
        angle: ringIndex % 2 === 0 ? 42 : -42,
        alpha: { from: 0.82, to: 0 },
        duration: 260 + ringIndex * 35,
        delay: ringIndex * 24,
        ease: 'Cubic.easeIn',
        onComplete: () => collapseRing.destroy(),
      });
    }

    const orb = this.add.graphics()
      .setPosition(origX, origY)
      .setDepth(23)
      .setScale(0.15)
      .setAlpha(0)
      .setName('battle-void-orb');
    orb.fillStyle(voidPurple, 0.16); orb.fillCircle(0, 0, 24);
    orb.lineStyle(3, voidPurple, 0.86); orb.strokeCircle(0, 0, 17);
    orb.lineStyle(1.5, voidTeal, 0.82); orb.strokeEllipse(0, 0, 39, 14);
    orb.fillStyle(0x000000, 0.96); orb.fillCircle(0, 0, 11);
    orb.fillStyle(0xffffff, 0.82); orb.fillCircle(-4, -4, 2);

    this.tweens.add({ targets: orb, scaleX: 1, scaleY: 1, alpha: 1, angle: 60, duration: 190, ease: 'Back.easeOut' });
    this.time.delayedCall(190, () => {
      const trailEvent = this.time.addEvent({
        delay: 38,
        loop: true,
        callback: () => {
          if (!orb.active) return;
          const residue = this.add.graphics().setPosition(orb.x, orb.y).setDepth(21);
          residue.fillStyle(Math.random() > 0.5 ? voidPurple : voidTeal, 0.5);
          residue.fillRect(-2, -2, 4, 4);
          this.tweens.add({
            targets: residue,
            x: residue.x + Phaser.Math.Between(-10, 10),
            y: residue.y + Phaser.Math.Between(-8, 8),
            scaleX: 0.1,
            scaleY: 0.1,
            alpha: 0,
            duration: 260,
            onComplete: () => residue.destroy(),
          });
        },
      });

      this.tweens.add({
        targets: orb,
        x: pX,
        y: pY,
        angle: 420,
        scaleX: 1.24,
        scaleY: 1.24,
        duration: 390,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          trailEvent.remove();
          orb.destroy();

          const pulledEcho = this.add.sprite(pX, pY, this.playerSprite.texture.key, this.playerSprite.frame.name)
            .setOrigin(this.playerSprite.originX, this.playerSprite.originY)
            .setScale(this.playerSprite.scaleX * 1.24, this.playerSprite.scaleY * 1.24)
            .setTint(voidPurple)
            .setAlpha(0.36)
            .setDepth(this.playerSprite.depth - 0.1)
            .setName('battle-void-player-echo');
          this.tweens.add({
            targets: pulledEcho,
            scaleX: this.playerSprite.scaleX * 0.35,
            scaleY: this.playerSprite.scaleY * 0.35,
            alpha: 0,
            angle: -16,
            duration: 270,
            ease: 'Cubic.easeIn',
            onComplete: () => pulledEcho.destroy(),
          });

          const implosion = this.add.graphics().setPosition(pX, pY).setDepth(24).setName('battle-void-implosion');
          implosion.fillStyle(voidPurple, 0.34); implosion.fillCircle(0, 0, 34);
          implosion.lineStyle(4, voidTeal, 0.78); implosion.strokeCircle(0, 0, 29);
          implosion.lineStyle(1, 0xffffff, 0.66); implosion.strokeCircle(0, 0, 40);
          implosion.fillStyle(0x000000, 0.92); implosion.fillCircle(0, 0, 16);
          implosion.setScale(1.65);
          this.tweens.add({
            targets: implosion,
            scaleX: 0.08,
            scaleY: 0.08,
            angle: -90,
            duration: 190,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              this.cameras.main.flash(70, 72, 30, 92, false);
              this.cameras.main.shake(180, 0.006);
              this.tweens.add({
                targets: [implosion, veil],
                alpha: 0,
                duration: 170,
                onComplete: () => { implosion.destroy(); veil.destroy(); onComplete(); },
              });
            },
          });
        },
      });
    });
  }

  // ── Defeat particles ────────────────────────────────────────────────────

  // ── Silence enemy ambient effects ──────────────────────────────────────

  private spawnSilenceParticles(cx: number, cy: number, battleH: number): void {
    // 1) Orbiting purple/magenta pixel squares — matches the model's floating fragments
    for (let i = 0; i < 10; i++) {
      const sq = this.add.graphics().setDepth(6);
      const color = [0x49dfbf, 0xd7ff4a, 0x268f80, 0xff6b3d][i % 4];
      const size = 3 + Math.random() * 4;
      sq.fillStyle(color, 0.8);
      sq.fillRect(-size / 2, -size / 2, size, size);

      const angle = (i / 10) * Math.PI * 2;
      const radius = 40 + Math.random() * 30;
      const speed = 4000 + Math.random() * 3000;
      sq.setPosition(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.6);

      // Orbit around the enemy
      this.tweens.add({
        targets: sq,
        angle: 360,
        duration: speed,
        repeat: -1,
      });
      // Drift in/out
      this.tweens.add({
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
    const glow = this.add.graphics().setDepth(4);
    glow.setPosition(cx, cy);
    glow.fillStyle(0x00ffcc, 0.12);
    glow.fillCircle(0, 0, 50);
    glow.fillStyle(0x00eeff, 0.08);
    glow.fillCircle(0, 0, 35);
    this.tweens.add({
      targets: glow,
      scaleX: 1.3, scaleY: 1.3,
      alpha: 0.04,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 3) Rising cyan sparks from the body
    this.time.addEvent({
      delay: 300,
      repeat: -1,
      callback: () => {
        if (!this.enemySprite?.active) return;
        const spark = this.add.graphics().setDepth(7);
        const sc = [0x00ffcc, 0x00ddff, 0x44ffff][Math.floor(Math.random() * 3)];
        spark.fillStyle(sc, 0.7);
        spark.fillCircle(0, 0, 1 + Math.random());
        spark.setPosition(
          this.enemySprite.x + Phaser.Math.Between(-25, 25),
          this.enemySprite.y + Phaser.Math.Between(-15, 30)
        );
        this.tweens.add({
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
      const mist = this.add.graphics().setDepth(3);
      mist.fillStyle(0x182c2b, 0.3);
      mist.fillEllipse(0, 0, 30 + Math.random() * 20, 8 + Math.random() * 4);
      mist.setPosition(cx + Phaser.Math.Between(-35, 35), mistY + Phaser.Math.Between(-5, 5));
      this.tweens.add({
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
      this.time.addEvent({
        delay: 1400 + side * 200,
        repeat: -1,
        callback: () => {
          if (!this.enemySprite?.active) return;
          for (let r = 0; r < 3; r++) {
            const ring = this.add.graphics().setDepth(4);
            ring.lineStyle(2, 0xcc8800, 0.5);
            ring.strokeCircle(0, 0, 6);
            ring.setPosition(sx, cy);
            this.tweens.add({
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
    this.time.addEvent({
      delay: 350,
      repeat: -1,
      callback: () => {
        if (!this.enemySprite?.active) return;
        const ant = antennaPositions[Math.floor(Math.random() * 2)];
        for (let s = 0; s < 3; s++) {
          const spark = this.add.graphics().setDepth(7);
          const sc = [0xffaa00, 0xff6600, 0xffdd44][s];
          spark.fillStyle(sc, 0.9);
          spark.fillRect(-1, -1, 2, 2);
          spark.setPosition(ant.x + Phaser.Math.Between(-4, 4), ant.y + Phaser.Math.Between(-4, 4));
          this.tweens.add({
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
    const dialGlow = this.add.graphics().setDepth(3);
    dialGlow.setPosition(cx, cy + 5);
    dialGlow.fillStyle(0xff6600, 0.1);
    dialGlow.fillCircle(0, 0, 45);
    dialGlow.fillStyle(0xffaa00, 0.12);
    dialGlow.fillCircle(0, 0, 25);
    dialGlow.fillStyle(0xffdd44, 0.08);
    dialGlow.fillCircle(0, 0, 12);
    this.tweens.add({
      targets: dialGlow,
      scaleX: 1.3, scaleY: 1.3,
      alpha: 0.04,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 4) Frequency needle scanning — a thin line sweeping back and forth
    const needle = this.add.graphics().setDepth(5);
    const needleState = { pos: 0 };
    this.tweens.add({
      targets: needleState,
      pos: 1,
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.time.addEvent({
      delay: 40,
      repeat: -1,
      callback: () => {
        if (!this.enemySprite?.active) { needle.destroy(); return; }
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
      const tendril = this.add.graphics().setDepth(4);
      const tc = [0x8b1a1a, 0xaa2020, 0x660c0c, 0x991515][i % 4];
      tendril.fillStyle(tc, 0.4);
      // Elongated wisp shape
      const w = 8 + Math.random() * 12;
      const h = 2 + Math.random() * 3;
      tendril.fillEllipse(0, 0, w, h);

      const angle = (i / 8) * Math.PI * 2;
      const radius = 30 + Math.random() * 25;
      tendril.setPosition(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.6);

      this.tweens.add({
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
    this.time.addEvent({
      delay: 250,
      repeat: -1,
      callback: () => {
        if (!this.enemySprite?.active) return;
        const ember = this.add.graphics().setDepth(6);
        const ec = [0xff6600, 0xffaa00, 0xff3300, 0xffdd44][Math.floor(Math.random() * 4)];
        ember.fillStyle(ec, 0.7);
        ember.fillCircle(0, 0, 1 + Math.random());
        ember.setPosition(
          this.enemySprite.x + Phaser.Math.Between(-30, 30),
          this.enemySprite.y + Phaser.Math.Between(-10, 20)
        );
        this.tweens.add({
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
      const sq = this.add.graphics().setDepth(6);
      const color = [0x49dfbf, 0xd7ff4a, 0xff6b3d, 0x9ebd6a, 0xff5c66, 0xeef5e9][i % 6];
      const size = 2 + Math.random() * 5;
      sq.fillStyle(color, 0.85);
      sq.fillRect(-size / 2, -size / 2, size, size);

      const angle = (i / 14) * Math.PI * 2;
      const radius = 35 + Math.random() * 40;
      sq.setPosition(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.7);

      // Drift outward and back — simulates the dispersing fragments
      this.tweens.add({
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
      this.tweens.add({
        targets: sq,
        angle: 360,
        duration: 5000 + Math.random() * 4000,
        repeat: -1,
      });
    }

    // 2) Horizontal EKG signal waveforms — the cyan/green zigzag lines from the model
    const drawSignalWave = (yOffset: number, waveColor: number, speed: number) => {
      const wave = this.add.graphics().setDepth(5);
      let phase = 0;
      this.time.addEvent({
        delay: 50,
        repeat: -1,
        callback: () => {
          if (!this.enemySprite?.active) return;
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
    drawSignalWave(-18, 0x49dfbf, 0.8);
    drawSignalWave(6, 0xd7ff4a, 1.0);
    drawSignalWave(28, 0xff6b3d, 0.6);

    // 3) Screen corruption — flickering horizontal glitch bars across the battle area
    const glitchBars = this.add.graphics().setDepth(4);
    this.time.addEvent({
      delay: 120,
      repeat: -1,
      callback: () => {
        if (!this.enemySprite?.active) return;
        glitchBars.clear();
        // Only show glitch bars ~40% of frames for a stuttery feel
        if (Math.random() > 0.4) return;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
          const barY = cy - 50 + Math.random() * 100;
          const barH = 1 + Math.random() * 3;
          const barColor = [0xff5c66, 0x49dfbf, 0xd7ff4a, 0xff6b3d][Math.floor(Math.random() * 4)];
          glitchBars.fillStyle(barColor, 0.15 + Math.random() * 0.15);
          glitchBars.fillRect(cx - 60, barY, 120, barH);
        }
      },
    });

    // 4) Bass pulse rings — concentric rings pulsing outward from the speaker area
    const speakerY = cy + 25;
    this.time.addEvent({
      delay: 1200,
      repeat: -1,
      callback: () => {
        if (!this.enemySprite?.active) return;
        for (let r = 0; r < 3; r++) {
          const ring = this.add.graphics().setDepth(4);
          ring.lineStyle(2, 0x00ddff, 0.4);
          ring.strokeCircle(0, 0, 8);
          ring.setPosition(cx, speakerY);
          this.tweens.add({
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
    this.time.addEvent({
      delay: 200,
      repeat: -1,
      callback: () => {
        if (!this.enemySprite?.active) return;
        const spark = this.add.graphics().setDepth(7);
        const sc = [0x49dfbf, 0xd7ff4a, 0xeef5e9, 0xff6b3d][Math.floor(Math.random() * 4)];
        spark.fillStyle(sc, 0.8);
        const s = 1 + Math.random() * 2;
        spark.fillRect(-s / 2, -s / 2, s, s);
        spark.setPosition(
          this.enemySprite.x + Phaser.Math.Between(-35, 35),
          this.enemySprite.y + Phaser.Math.Between(-30, 35)
        );
        // Quick flash and fade
        this.tweens.add({
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
    const glow = this.add.graphics().setDepth(3);
    glow.setPosition(cx, cy);
    glow.fillStyle(0xff6b3d, 0.08);
    glow.fillCircle(0, 0, 55);
    glow.fillStyle(0x49dfbf, 0.06);
    glow.fillCircle(0, 5, 40);
    this.tweens.add({
      targets: glow,
      scaleX: 1.25, scaleY: 1.25,
      alpha: 0.03,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private spawnDefeatParticles(x: number, y: number): void {
    const colors = [0xeef5e9, 0xd7ff4a, 0xff6b3d, 0x49dfbf];
    for (let i = 0; i < 18; i++) {
      const particle = this.add.graphics().setDepth(25);
      const c = colors[i % colors.length];
      const size = 2 + Math.random() * 3;
      particle.fillStyle(c, 0.9);
      particle.fillRect(-size / 2, -size / 2, size, size);
      particle.setPosition(x, y);

      const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 55 + Math.random() * 65;
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 20,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 650 + Math.random() * 350,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

}
