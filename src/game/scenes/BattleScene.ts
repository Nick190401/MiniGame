import Phaser from 'phaser';
import { EventBus, EVENTS } from '../EventBus';
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

    // ── Layout constants ──────────────────────────────────────────────────
    const BATTLE_H   = Math.floor(H * 0.53);
    this.battleH     = BATTLE_H;
    const MSG_Y      = BATTLE_H;
    const MSG_H      = 68;
    const MENU_Y     = MSG_Y + MSG_H + 4;
    const MENU_H     = H - MENU_Y - 4;

    // ── Background ────────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x10082a);
    bg.fillRect(0, 0, W, H);

    // Subtle gradient overlay — darker at top, lighter at bottom of arena
    const gradient = this.add.graphics();
    gradient.fillGradientStyle(0x180830, 0x180830, 0x0a0420, 0x0a0420, 0.3, 0.3, 0, 0);
    gradient.fillRect(0, 0, W, BATTLE_H);

    if (this.isBoss) {
      const aura = this.add.graphics();
      aura.fillStyle(0x330000, 0.25);
      aura.fillRect(0, 0, W, H);
    }

    // Scanlines
    const scanlines = this.add.graphics();
    scanlines.fillStyle(0x000000, 0.05);
    for (let y = 0; y < H; y += 4) {
      scanlines.fillRect(0, y, W, 2);
    }
    scanlines.setDepth(30);

    // ── Ambient floating particles ───────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const p = this.add.graphics().setDepth(3);
      const c = this.isBoss ? [0xff2244, 0xff6644, 0xcc1133, 0xffaa44][i % 4] : [0x4080ff, 0x00ccff, 0x8844ff, 0x44ddff][i % 4];
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

    // Outer gold border
    const border = this.add.graphics().setDepth(31);
    border.lineStyle(3, 0xffd700);
    border.strokeRect(3, 3, W - 6, H - 6);

    // ── Ground platforms (GBA Pokémon style) ──────────────────────────────
    const ground = this.add.graphics().setDepth(2);
    // Enemy platform — ellipse, upper right
    ground.fillStyle(0x282048, 0.5);
    ground.fillEllipse(W * 0.70, BATTLE_H * 0.70, 190, 28);
    ground.lineStyle(1.5, 0x4040a0, 0.3);
    ground.strokeEllipse(W * 0.70, BATTLE_H * 0.70, 190, 28);
    // Player platform — ellipse, lower left
    ground.fillStyle(0x282048, 0.5);
    ground.fillEllipse(W * 0.24, BATTLE_H * 0.93, 170, 22);
    ground.lineStyle(1.5, 0x4040a0, 0.3);
    ground.strokeEllipse(W * 0.24, BATTLE_H * 0.93, 170, 22);

    // ── Enemy sprite (upper right) — slides in from right ──────────────
    const enemySpriteY = BATTLE_H * 0.48;
    const enemyFinalX = W * 0.70;

    // Use high-res battle art when available, otherwise pixel sprite
    const hasSilenceArt = this.enemyData.id === 'silence' && this.textures.exists('silence-battle');
    const hasStaticNoiseArt = this.enemyData.id === 'static-noise' && this.textures.exists('staticnoise-battle');
    const hasBrokenSignalArt = this.enemyData.id === 'broken-signal' && this.textures.exists('brokensignal-battle');
    const hasBattleArt = hasSilenceArt || hasStaticNoiseArt || hasBrokenSignalArt;
    const enemyTexture = hasSilenceArt ? 'silence-battle'
      : hasStaticNoiseArt ? 'staticnoise-battle'
      : hasBrokenSignalArt ? 'brokensignal-battle'
      : this.enemyData.textureKey;
    // Broken Signal PNG is landscape (~2:1), needs different scale
    const enemyScale = hasBrokenSignalArt ? 0.14
      : hasBattleArt ? 0.09
      : (this.isBoss ? 6 : 5);

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
        if (hasSilenceArt) {
          this.spawnSilenceParticles(enemyFinalX, enemySpriteY, BATTLE_H);
        }
        if (hasStaticNoiseArt) {
          this.spawnStaticNoiseParticles(enemyFinalX, enemySpriteY, BATTLE_H);
        }
        if (hasBrokenSignalArt) {
          this.spawnBrokenSignalParticles(enemyFinalX, enemySpriteY, BATTLE_H);
        }
      },
    });

    // ── Player sprite — slides in from left ──────────────────────────────
    const playerFinalX = W * 0.24;
    this.playerSprite = this.add.sprite(-40, BATTLE_H * 0.72, 'player-battle');
    this.playerSprite.setScale(0.10);
    this.playerSprite.setDepth(5);

    this.tweens.add({
      targets: this.playerSprite,
      x: playerFinalX,
      duration: 600,
      ease: 'Back.easeOut',
    });

    // ── Enemy info box (top LEFT — Pokémon layout) ────────────────────────
    this.buildEnemyInfoBox(W, BATTLE_H);

    // ── Player info box (bottom RIGHT — Pokémon layout) ───────────────────
    this.buildPlayerInfoBox(W, BATTLE_H);

    // ── Message box (full-width, GBA textbox style) ───────────────────────
    this.buildMessageBox(W, MSG_Y, MSG_H);

    // ── Attack menu (2×2 grid) ────────────────────────────────────────────
    this.buildAttackMenu(MENU_Y, MENU_H);

    // ── Advance dialog on click/space/z ───────────────────────────────────
    this.input.on('pointerdown', () => {
      if (this.messageReady && this.turnState === 'player-choose') return;
      if (!this.messageReady) this.skipTypewriter();
    });
    this.input.keyboard?.on('keydown-SPACE', () => { if (!this.messageReady) this.skipTypewriter(); });
    this.input.keyboard?.on('keydown-Z', () => { if (!this.messageReady) this.skipTypewriter(); });

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

  private buildEnemyInfoBox(W: number, BATTLE_H: number): void {
    const infoBoxX = W * 0.04;
    const infoBoxY = BATTLE_H * 0.04;
    const infoBoxW = 240;
    const infoBoxH = this.isBoss ? 58 : 50;

    const infoBg = this.add.graphics().setDepth(8);
    infoBg.fillStyle(0x0a0020, 0.92);
    infoBg.fillRoundedRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH, 6);
    const borderColor = this.isBoss ? 0xffd700 : 0x4060a0;
    infoBg.lineStyle(2, borderColor, 0.9);
    infoBg.strokeRoundedRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH, 6);
    // Inner highlight line
    infoBg.lineStyle(1, borderColor, 0.15);
    infoBg.strokeRoundedRect(infoBoxX + 2, infoBoxY + 2, infoBoxW - 4, infoBoxH - 4, 4);

    // Enemy name
    this.enemyNameText = this.add.text(
      infoBoxX + 10, infoBoxY + 8,
      this.enemyData.name.toUpperCase(),
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: this.isBoss ? '#ffd700' : '#f0f0f0',
      }
    ).setDepth(10);

    if (this.isBoss) {
      this.enemyNameText.setShadow(0, 0, '#ff0000', 6, true, true);
    }

    // Phase label (boss only)
    this.phaseText = this.add.text(infoBoxX + 10, infoBoxY + 20, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#ff4444',
    }).setDepth(10);

    if (this.isBoss) {
      this.phaseText.setText('PHASE I');
    }

    // Enemy HP row
    const ehpLabelY = this.isBoss ? infoBoxY + 32 : infoBoxY + 22;
    this.add.text(infoBoxX + 10, ehpLabelY, 'HP', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#aaaaaa',
    }).setDepth(10);

    this.ehpBarX = infoBoxX + 30;
    this.ehpBarY = ehpLabelY;
    this.ehpBarW = infoBoxW - 44;
    this.ehpBarH = 8;

    this.enemyHpBar = this.add.graphics().setDepth(10);
    this.drawHpBar(this.enemyHpBar, this.ehpBarX, this.ehpBarY, this.ehpBarW, this.ehpBarH, 1);

    const hpFracLabelY = ehpLabelY + 12;
    this.enemyHpText = this.add.text(
      infoBoxX + 10, hpFracLabelY,
      `${this.currentEnemyHp}/${this.enemyData.maxHp}`,
      { fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#888888' }
    ).setDepth(10);
  }

  private buildPlayerInfoBox(W: number, BATTLE_H: number): void {
    const store = useGameStore.getState();
    const phpBoxW = 220;
    const phpBoxH = 52;
    const phpBoxX = W - phpBoxW - W * 0.04;
    const phpBoxY = BATTLE_H - phpBoxH - BATTLE_H * 0.08;

    const phpBg = this.add.graphics().setDepth(8);
    phpBg.fillStyle(0x0a0020, 0.92);
    phpBg.fillRoundedRect(phpBoxX, phpBoxY, phpBoxW, phpBoxH, 6);
    phpBg.lineStyle(2, 0x4040a0, 0.8);
    phpBg.strokeRoundedRect(phpBoxX, phpBoxY, phpBoxW, phpBoxH, 6);
    phpBg.lineStyle(1, 0x4040a0, 0.15);
    phpBg.strokeRoundedRect(phpBoxX + 2, phpBoxY + 2, phpBoxW - 4, phpBoxH - 4, 4);

    const pName = store.playerName || 'PLAYER';
    this.add.text(phpBoxX + 10, phpBoxY + 6, pName.toUpperCase(), {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#f0f0f0',
    }).setDepth(10);

    this.add.text(phpBoxX + phpBoxW - 10, phpBoxY + 6, `LV.${store.level}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#ffd700',
    }).setOrigin(1, 0).setDepth(10);

    this.add.text(phpBoxX + 10, phpBoxY + 22, 'HP', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#aaaaaa',
    }).setDepth(10);

    this.phpBarX = phpBoxX + 30;
    this.phpBarY = phpBoxY + 22;
    this.phpBarW = phpBoxW - 44;
    this.phpBarH = 8;

    const phpFrac = Math.max(0, store.hp / store.maxHp);
    this.playerHpBar = this.add.graphics().setDepth(10);
    this.drawHpBar(this.playerHpBar, this.phpBarX, this.phpBarY, this.phpBarW, this.phpBarH, phpFrac);

    this.playerHpText = this.add.text(
      phpBoxX + 10, phpBoxY + 36,
      `${store.hp}/${store.maxHp}`,
      { fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#888888' }
    ).setDepth(10);
  }

  // ── HP bar rendering (Pokémon style with rounded ends + gradient) ──────────

  private hpColor(frac: number): number {
    if (frac > 0.5) return 0x40c040;
    if (frac > 0.25) return 0xe0c000;
    return 0xe03030;
  }

  private hpColorBright(frac: number): number {
    if (frac > 0.5) return 0x60e060;
    if (frac > 0.25) return 0xf0d830;
    return 0xf04040;
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number): void {
    g.clear();
    // Background
    g.fillStyle(0x181818);
    g.fillRoundedRect(x, y, w, h, 3);
    // Dark border
    g.lineStyle(1, 0x333333);
    g.strokeRoundedRect(x, y, w, h, 3);

    if (frac > 0) {
      const fillW = Math.max(4, w * frac);
      const color = this.hpColor(frac);
      const bright = this.hpColorBright(frac);
      // Main fill
      g.fillStyle(color);
      g.fillRoundedRect(x + 1, y + 1, fillW - 2, h - 2, 2);
      // Top highlight (brighter)
      g.fillStyle(bright, 0.5);
      g.fillRoundedRect(x + 1, y + 1, fillW - 2, Math.floor(h / 2) - 1, { tl: 2, tr: 2, bl: 0, br: 0 });
    }
  }

  private updateEnemyHpBar(): void {
    const frac = Math.max(0, this.currentEnemyHp / this.enemyData.maxHp);
    this.drawHpBar(this.enemyHpBar, this.ehpBarX, this.ehpBarY, this.ehpBarW, this.ehpBarH, frac);
    this.enemyHpText.setText(`${this.currentEnemyHp}/${this.enemyData.maxHp}`);
  }

  private updatePlayerHpBar(): void {
    const store = useGameStore.getState();
    const frac = Math.max(0, store.hp / store.maxHp);
    this.drawHpBar(this.playerHpBar, this.phpBarX, this.phpBarY, this.phpBarW, this.phpBarH, frac);
    this.playerHpText.setText(`${store.hp}/${store.maxHp}`);
  }

  // ── Message box ─────────────────────────────────────────────────────────────

  private buildMessageBox(W: number, MSG_Y: number, MSG_H: number): void {
    const msgBg = this.add.graphics().setDepth(12);
    // Dark fill with rounded corners
    msgBg.fillStyle(0x06001a, 0.97);
    msgBg.fillRoundedRect(6, MSG_Y, W - 12, MSG_H, 6);
    // Gold border
    msgBg.lineStyle(2, 0xffd700, 0.8);
    msgBg.strokeRoundedRect(6, MSG_Y, W - 12, MSG_H, 6);
    // Inner highlight
    msgBg.lineStyle(1, 0xffd700, 0.12);
    msgBg.strokeRoundedRect(8, MSG_Y + 2, W - 16, MSG_H - 4, 4);

    this.messageText = this.add.text(20, MSG_Y + 14, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#f0f0f0',
      wordWrap: { width: W - 48 },
      lineSpacing: 8,
    }).setDepth(14);

    // Continue indicator (▼)
    this.msgContinueIndicator = this.add.text(W - 24, MSG_Y + MSG_H - 14, '▼', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#ffd700',
    }).setDepth(14).setAlpha(0);

    this.tweens.add({
      targets: this.msgContinueIndicator,
      y: MSG_Y + MSG_H - 10,
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
    const gap = 5;
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

    const drawBtn = (g: Phaser.GameObjects.Graphics, hover: boolean) => {
      g.clear();
      const baseAlpha = unlocked ? (hover ? 0.95 : 0.85) : 0.35;
      const fillColor = unlocked ? (hover ? 0x1a0e40 : 0x0e0828) : 0x080414;
      const bColor = unlocked ? attack.color : 0x222244;
      const bAlpha = unlocked ? (hover ? 1 : 0.7) : 0.3;
      const bWidth = hover ? 2.5 : 1.5;

      // Main background
      g.fillStyle(fillColor, baseAlpha);
      g.fillRoundedRect(0, 0, w, h, 5);

      // Border
      g.lineStyle(bWidth, bColor, bAlpha);
      g.strokeRoundedRect(0, 0, w, h, 5);

      if (unlocked) {
        // Left accent bar
        g.fillStyle(attack.color, hover ? 0.8 : 0.5);
        g.fillRoundedRect(0, 0, 4, h, { tl: 5, bl: 5, tr: 0, br: 0 });

        // Top-left color glow
        g.fillStyle(attack.color, hover ? 0.12 : 0.05);
        g.fillRoundedRect(0, 0, w * 0.5, h * 0.5, { tl: 5, tr: 0, bl: 0, br: 0 });

        if (hover) {
          // Inner glow line
          g.lineStyle(1, bColor, 0.25);
          g.strokeRoundedRect(2, 2, w - 4, h - 4, 3);
        }
      }
    };

    const bg = this.add.graphics();
    drawBtn(bg, false);

    // Attack type icon (small pixel glyph)
    const iconRows = ATTACK_ICONS[attack.id] || [];
    const icon = this.add.graphics();
    if (unlocked) {
      const iconX = w - 34;
      const iconY = Math.floor(h * 0.14);
      const pixelSize = 2;
      iconRows.forEach((row, ry) => {
        [...row].forEach((ch, rx) => {
          if (ch === '█') {
            icon.fillStyle(attack.color, 0.4);
            icon.fillRect(iconX + rx * pixelSize, iconY + ry * pixelSize, pixelSize, pixelSize);
          }
        });
      });
    }

    // Attack name
    const nameText = this.add.text(12, Math.floor(h * 0.18), attack.name, {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: unlocked ? colorHex : '#333355',
    });
    if (unlocked) {
      nameText.setShadow(1, 1, '#000000', 2);
    }

    // Damage + description
    const subText = this.add.text(12, Math.floor(h * 0.55),
      unlocked ? `DMG ${attack.damage}` : '???',
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '6px',
        color: unlocked ? '#aaaaaa' : '#222244',
      }
    );

    // Lock indicator or description
    const extraText = unlocked
      ? this.add.text(12, Math.floor(h * 0.78), attack.description.slice(0, 32), {
          fontFamily: '"Press Start 2P"',
          fontSize: '5px',
          color: '#555577',
          wordWrap: { width: w - 24 },
        })
      : this.add.text(w / 2, h / 2, `🔒 LV.${attack.unlockLevel}`, {
          fontFamily: '"Press Start 2P"',
          fontSize: '7px',
          color: '#444466',
        }).setOrigin(0.5);

    const parts: Phaser.GameObjects.GameObject[] = [bg, icon, nameText, subText, extraText];

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
        }
      });

      container.on('pointerout', () => {
        drawBtn(bg, false);
        nameText.setColor(colorHex);
      });

      container.on('pointerdown', () => {
        if (this.turnState === 'player-choose' && !this.inputBlocked && this.messageReady) {
          this.executePlayerAttack(attack, index);
        }
      });
    }
  }

  // ── Battle logic ──────────────────────────────────────────────────────────

  private setTurnState(state: TurnState): void {
    this.turnState = state;
    this.inputBlocked = state !== 'player-choose';

    if (state === 'player-choose') {
      this.setMessage('What will you do?');
      this.setAttackButtonsEnabled(true);
    } else {
      this.setAttackButtonsEnabled(false);
    }
  }

  private setAttackButtonsEnabled(enabled: boolean): void {
    this.attackButtons.forEach(btn => {
      btn.container.setAlpha(enabled ? 1 : 0.5);
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

    this.playPlayerAttackAnimation(attack, () => {
      this.currentEnemyHp = Math.max(0, this.currentEnemyHp - damage);
      this.updateEnemyHpBar();
      this.showFloatingDamage(damage, this.enemySprite.x, this.enemySprite.y - 30, attack.color);

      // Enemy hit reaction: flash white + horizontal shake
      const origX = this.enemySprite.x;
      this.enemySprite.setTint(0xffffff);
      this.time.delayedCall(80, () => this.enemySprite.clearTint());
      this.tweens.add({
        targets: this.enemySprite,
        x: origX + 10,
        duration: 35,
        yoyo: true,
        repeat: 4,
        ease: 'Sine.easeInOut',
        onComplete: () => { this.enemySprite.x = origX; },
      });

      // Brief red flash on the screen
      this.cameras.main.flash(100, 255, 255, 255, false);

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

    this.time.delayedCall(600, () => {
      this.playEnemyAttackAnimation(attack, () => {
        store.takeDamage(damage);
        const currentHp = useGameStore.getState().hp;
        EventBus.emit(EVENTS.HP_CHANGED, currentHp);
        this.updatePlayerHpBar();
        this.showFloatingDamage(damage, this.playerSprite.x, this.playerSprite.y - 30, 0xe03030);

        // Player hit reaction: shake + red flash
        const origX = this.playerSprite.x;
        this.playerSprite.setTint(0xff4444);
        this.time.delayedCall(100, () => this.playerSprite.clearTint());
        this.tweens.add({
          targets: this.playerSprite,
          x: origX - 8,
          duration: 35,
          yoyo: true,
          repeat: 4,
          ease: 'Sine.easeInOut',
          onComplete: () => { this.playerSprite.x = origX; },
        });

        // Red screen flash on hit
        this.cameras.main.flash(120, 180, 30, 30, false);

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

  private triggerPhaseChange(phaseIdx: number): void {
    this.setTurnState('phase-change');
    const phaseLabels  = ['PHASE I', 'PHASE II', 'PHASE III'];
    const phaseColors  = ['#ffd700', '#ff8800', '#ff0000'];
    const textureKeys  = ['boss-gatekeeper', 'boss-gatekeeper-phase2', 'boss-gatekeeper-phase3'];
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

    // Phase change visual: big text overlay
    const W = this.scale.width;
    const phaseAnnounce = this.add.text(W / 2, this.battleH * 0.4, phaseLabels[phaseIdx], {
      fontFamily: '"Press Start 2P"',
      fontSize: '16px',
      color: phaseColors[phaseIdx],
    }).setOrigin(0.5).setDepth(28).setAlpha(0).setScale(2);

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
        }
      },
    });
  }

  private skipTypewriter(): void {
    this.typewriterTimer?.remove();
    this.messageText.setText(this.fullMessageText);
    this.messageReady = true;
  }

  // ── Player attack animations ──────────────────────────────────────────────

  private playPlayerAttackAnimation(attack: Attack, onComplete: () => void): void {
    const W = this.scale.width;
    const color = attack.color;
    const eX = this.enemySprite.x;
    const eY = this.enemySprite.y;
    const pX = this.playerSprite.x;
    const pY = this.playerSprite.y;

    switch (attack.id) {

      // ── BASS DROP ─────────────────────────────────────────────────────
      // Heavy slam: player jumps up → slams down → ground crack travels →
      // massive shockwave + vertical pillar at enemy
      case 'bass-drop': {
        // Phase 1: Player jumps up (wind-up)
        this.tweens.add({
          targets: this.playerSprite,
          y: pY - 18,
          scaleX: 0.108, scaleY: 0.108,
          duration: 200,
          ease: 'Quad.easeOut',
          onComplete: () => {
            // Phase 2: SLAM DOWN hard
            this.tweens.add({
              targets: this.playerSprite,
              y: pY + 4,
              scaleX: 0.092, scaleY: 0.092,
              duration: 80,
              ease: 'Quad.easeIn',
              onComplete: () => {
                // Reset player
                this.tweens.add({ targets: this.playerSprite, y: pY, scaleX: 0.10, scaleY: 0.10, duration: 200 });

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
        // Player push motion
        this.tweens.add({
          targets: this.playerSprite,
          x: pX + 12,
          duration: 100,
          yoyo: true,
          ease: 'Quad.easeOut',
        });

        const fireCrescent = (index: number, onDone: () => void) => {
          const crescent = this.add.graphics().setDepth(20 + index);
          const trail = this.add.graphics().setDepth(19 + index);
          const midY = (pY + eY) / 2;
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
              const headY = midY + Math.sin(t * Math.PI) * (-25 * crescentScale);

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

              // Impact burst at enemy
              const impact = this.add.graphics().setDepth(22);
              // Central flash
              impact.fillStyle(0xffffff, 0.7);
              impact.fillCircle(eX, eY, 10 * crescentScale);
              impact.fillStyle(color, 0.5);
              impact.fillCircle(eX, eY, 20 * crescentScale);

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
        // Phase 1: Screen briefly dims
        const dim = this.add.graphics().setDepth(18);
        dim.fillStyle(0x000000, 0.3);
        dim.fillRect(0, 0, W, this.battleH + 10);
        dim.setAlpha(0);
        this.tweens.add({ targets: dim, alpha: 1, duration: 100 });

        // Phase 2: Player dash with afterimages
        const afterimages: Phaser.GameObjects.Sprite[] = [];
        const dashTarget = eX - 40;

        // Create afterimage trail
        for (let i = 0; i < 4; i++) {
          this.time.delayedCall(i * 30, () => {
            const ghost = this.add.sprite(this.playerSprite.x, this.playerSprite.y, 'player-battle');
            ghost.setScale(0.10).setDepth(19).setAlpha(0.4 - i * 0.08).setTint(color);
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

              // Central starburst
              const star = this.add.graphics().setDepth(24);
              // 12-point star
              for (let a = 0; a < 12; a++) {
                const angle = (a / 12) * Math.PI * 2;
                const len = a % 2 === 0 ? 30 : 16;
                star.lineStyle(a % 2 === 0 ? 2.5 : 1.5, 0xffffff, 0.9);
                star.lineBetween(eX, eY, eX + Math.cos(angle) * len, eY + Math.sin(angle) * len);
              }
              // Central flash layers
              star.fillStyle(0xffffff, 0.9);
              star.fillCircle(eX, eY, 10);
              star.fillStyle(color, 0.6);
              star.fillCircle(eX, eY, 18);
              star.fillStyle(color, 0.2);
              star.fillCircle(eX, eY, 30);

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
        dimOverlay.fillStyle(0x000000, 0);
        dimOverlay.fillRect(0, 0, W, this.battleH + 10);
        this.tweens.add({
          targets: dimOverlay,
          alpha: 0.5,
          duration: 300,
        });

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
            const beamState = { headX: pX, alpha: 1 };
            this.tweens.add({
              targets: beamState,
              headX: eX,
              duration: 180,
              ease: 'Quad.easeIn',
              onUpdate: () => {
                beam.clear();
                // Wide glow trail
                beam.fillStyle(color, 0.15);
                beam.fillRect(pX, pY - 22, beamState.headX - pX, 24);
                // Main beam body
                beam.fillStyle(color, 0.6);
                beam.fillRect(pX, pY - 15, beamState.headX - pX, 10);
                // Core beam
                beam.fillStyle(color, 0.85);
                beam.fillRect(pX, pY - 12, beamState.headX - pX, 4);
                // White center
                beam.fillStyle(0xffffff, 0.6);
                beam.fillRect(pX, pY - 11, beamState.headX - pX, 2);
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

    // Charge glow before lunge
    const chargeGlow = this.add.graphics().setDepth(19);
    chargeGlow.fillStyle(0xff4444, 0.3);
    chargeGlow.fillCircle(origX, origY, 25);
    this.tweens.add({
      targets: chargeGlow,
      alpha: 0,
      scaleX: 0.3, scaleY: 0.3,
      duration: 160,
      onComplete: () => chargeGlow.destroy(),
    });

    this.tweens.add({
      targets: this.enemySprite,
      x: lungeX,
      y: lungeY,
      scaleX: origScaleX * 1.12,
      scaleY: origScaleY * 1.12,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Impact flash at player — multiple layers
        const impact = this.add.graphics().setDepth(20);
        impact.fillStyle(0xff4444, 0.15);
        impact.fillCircle(pX, pY, 40);
        impact.fillStyle(0xff4444, 0.4);
        impact.fillCircle(pX, pY, 22);
        impact.fillStyle(0xffffff, 0.5);
        impact.fillCircle(pX, pY, 8);
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
    // Lightning bolt zigzag from enemy to player
    const bolt = this.add.graphics().setDepth(22);
    const segments = 8;
    const dx = (pX - origX) / segments;
    const dy = (pY - origY) / segments;

    let frame = 0;
    const boltAnim = this.time.addEvent({
      delay: 16,
      repeat: 18,
      callback: () => {
        frame++;
        bolt.clear();

        // Draw zigzag bolt
        bolt.lineStyle(3, 0x00ddff, 0.9);
        bolt.beginPath();
        bolt.moveTo(origX, origY);
        for (let i = 1; i <= Math.min(frame, segments); i++) {
          const jitter = (Math.random() - 0.5) * 30;
          const bx = origX + dx * i + (i < segments ? jitter : 0);
          const by = origY + dy * i + (i < segments ? jitter * 0.5 : 0);
          bolt.lineTo(bx, by);
        }
        bolt.strokePath();

        // Glow bolt
        bolt.lineStyle(8, 0x00ddff, 0.12);
        bolt.beginPath();
        bolt.moveTo(origX, origY);
        for (let i = 1; i <= Math.min(frame, segments); i++) {
          const jitter = (Math.random() - 0.5) * 30;
          bolt.lineTo(origX + dx * i + (i < segments ? jitter : 0), origY + dy * i + (i < segments ? jitter * 0.5 : 0));
        }
        bolt.strokePath();
      },
    });

    this.time.delayedCall(320, () => {
      bolt.destroy();
      // Impact flash
      const flash = this.add.graphics().setDepth(21);
      flash.fillStyle(0x00ddff, 0.5);
      flash.fillCircle(pX, pY, 20);
      flash.fillStyle(0xffffff, 0.6);
      flash.fillCircle(pX, pY, 8);
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
      const beamState = { headX: origX };
      const beamY = (origY + pY) / 2;

      this.tweens.add({
        targets: beamState,
        headX: pX,
        duration: 280,
        ease: 'Quad.easeIn',
        onUpdate: () => {
          beam.clear();
          // Wide radio static trail
          beam.fillStyle(0xff6600, 0.1);
          beam.fillRect(origX, beamY - 14, beamState.headX - origX, 28);
          // Core frequency line with jitter
          beam.lineStyle(3, 0xffaa00, 0.85);
          beam.beginPath();
          beam.moveTo(origX, beamY);
          const dist = beamState.headX - origX;
          for (let i = 0; i <= 16; i++) {
            const t = i / 16;
            const sx = origX + dist * t;
            if (sx > beamState.headX) break;
            const jitter = Math.sin(t * 12 + beamState.headX * 0.1) * 8;
            beam.lineTo(sx, beamY + jitter);
          }
          beam.strokePath();
          // White hot core
          beam.lineStyle(1, 0xffffff, 0.5);
          beam.lineBetween(origX, beamY, beamState.headX, beamY);
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
      const impact = this.add.graphics().setDepth(22);
      impact.fillStyle(0x8b1a1a, 0.5);
      impact.fillCircle(pX, pY, 24);
      impact.fillStyle(0xff6600, 0.4);
      impact.fillCircle(pX, pY, 16);
      impact.fillStyle(0xffdd44, 0.5);
      impact.fillCircle(pX, pY, 8);
      impact.fillStyle(0xffffff, 0.5);
      impact.fillCircle(pX, pY, 4);

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
    // Dark wave expanding from enemy toward player
    const wave = this.add.graphics().setDepth(21);
    const waveState = { r: 10 };
    const maxR = Math.sqrt((pX - origX) ** 2 + (pY - origY) ** 2) + 30;

    this.time.addEvent({
      delay: 16,
      repeat: 30,
      callback: () => {
        waveState.r += 8;
        wave.clear();
        const alpha = Math.max(0, 1 - waveState.r / maxR);
        // Dark expanding ring
        wave.lineStyle(6, 0x440066, alpha * 0.6);
        wave.strokeCircle(origX, origY, waveState.r);
        wave.lineStyle(2, 0xcc44ff, alpha * 0.4);
        wave.strokeCircle(origX, origY, waveState.r);
        // Inner void fill
        wave.fillStyle(0x220033, alpha * 0.1);
        wave.fillCircle(origX, origY, waveState.r);
      },
    });

    this.time.delayedCall(500, () => {
      wave.destroy();
      // Impact — dark implosion at player
      const implosion = this.add.graphics().setDepth(21);
      implosion.fillStyle(0x440066, 0.6);
      implosion.fillCircle(pX, pY, 25);
      implosion.fillStyle(0x000000, 0.4);
      implosion.fillCircle(pX, pY, 12);
      this.tweens.add({
        targets: implosion,
        scaleX: 0.1, scaleY: 0.1,
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeIn',
        onComplete: () => { implosion.destroy(); onComplete(); },
      });
    });
  }

  // ── Defeat particles ────────────────────────────────────────────────────

  // ── Silence enemy ambient effects ──────────────────────────────────────

  private spawnSilenceParticles(cx: number, cy: number, battleH: number): void {
    // 1) Orbiting purple/magenta pixel squares — matches the model's floating fragments
    for (let i = 0; i < 10; i++) {
      const sq = this.add.graphics().setDepth(6);
      const color = [0xaa44ff, 0xcc44ff, 0x8833dd, 0xff44cc][i % 4];
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
      mist.fillStyle(0x201830, 0.3);
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
      const color = [0x00ddff, 0x00ff88, 0xff44cc, 0xccff00, 0x8844ff, 0x00ffff][i % 6];
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
    drawSignalWave(-18, 0x00ffcc, 0.8);   // upper wave (cyan-green)
    drawSignalWave(6, 0x00ddff, 1.0);      // middle wave (cyan)
    drawSignalWave(28, 0xff44cc, 0.6);     // lower wave (magenta)

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
          const barColor = [0xcc1111, 0x00ddff, 0x00ff88, 0xff44cc][Math.floor(Math.random() * 4)];
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
        const sc = [0x00ffff, 0x00ff88, 0xccff00, 0xff44cc][Math.floor(Math.random() * 4)];
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
    glow.fillStyle(0xcc1111, 0.08);
    glow.fillCircle(0, 0, 55);
    glow.fillStyle(0x00ddff, 0.06);
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
    const colors = [0xffffff, 0xffd700, 0xff4444, 0x4080ff];
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

  // ── Floating damage numbers ─────────────────────────────────────────────

  private showFloatingDamage(damage: number, x: number, y: number, color: number): void {
    const colorHex = '#' + color.toString(16).padStart(6, '0');

    // Shadow text behind for depth
    const shadow = this.add.text(x + 1, y + 1, `-${damage}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#000000',
    }).setDepth(24).setOrigin(0.5).setAlpha(0.6);

    // Main damage number
    const dmgText = this.add.text(x, y, `-${damage}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: colorHex,
    }).setDepth(25).setOrigin(0.5);

    // Pop-in: start small, scale up, then float + fade
    dmgText.setScale(0.3);
    shadow.setScale(0.3);

    this.tweens.add({
      targets: [dmgText, shadow],
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 100,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: [dmgText, shadow],
          y: y - 45,
          scaleX: 1,
          scaleY: 1,
          alpha: 0,
          duration: 850,
          ease: 'Quad.easeOut',
          onComplete: () => { dmgText.destroy(); shadow.destroy(); },
        });
      },
    });
  }
}
