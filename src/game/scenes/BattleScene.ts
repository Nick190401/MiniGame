import Phaser from 'phaser';
import { EventBus, EVENTS } from '../EventBus';
import { useGameStore } from '../../store/gameStore';
import { ATTACKS, applyDamageVariance } from '../systems/AttackSystem';
import { BOSS_DEFINITION } from '../entities/Enemy';
import { BOSS_PHASES } from '../entities/Boss';
import type { EnemyData, Attack } from '../../types/game.types';

type TurnState = 'player-choose' | 'player-attack' | 'enemy-attack' | 'phase-change' | 'battle-end';

export class BattleScene extends Phaser.Scene {
  // Battle data
  private enemyData!: EnemyData;
  private isBoss = false;
  private currentEnemyHp = 0;
  private bossPhaseIndex = 0;

  // UI references
  private enemySprite!: Phaser.GameObjects.Sprite;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBg!: Phaser.GameObjects.Rectangle;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpBg!: Phaser.GameObjects.Rectangle;
  private enemyHpText!: Phaser.GameObjects.Text;
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyNameText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private attackButtons: Phaser.GameObjects.Container[] = [];
  private messageText!: Phaser.GameObjects.Text;

  // Layout refs for animations
  private battleH = 0;

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
  }

  create(): void {
    const W = this.scale.width;   // 640
    const H = this.scale.height;  // 480

    // ── Layout constants ──────────────────────────────────────────────────
    const BATTLE_H   = Math.floor(H * 0.53);
    this.battleH     = BATTLE_H;
    const MSG_Y      = BATTLE_H;                // message box top
    const MSG_H      = 68;                      // message box height
    const MENU_Y     = MSG_Y + MSG_H + 4;       // attack grid top
    const MENU_H     = H - MENU_Y - 4;          // remaining space for buttons

    // ── Background ────────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x10082a);
    bg.fillRect(0, 0, W, H);

    // Scanlines
    const scanlines = this.add.graphics();
    scanlines.fillStyle(0x000000, 0.06);
    for (let y = 0; y < H; y += 4) {
      scanlines.fillRect(0, y, W, 2);
    }

    // Outer gold border
    const border = this.add.graphics();
    border.lineStyle(3, 0xffd700);
    border.strokeRect(3, 3, W - 6, H - 6);

    if (this.isBoss) {
      const aura = this.add.graphics();
      aura.fillStyle(0x330000, 0.25);
      aura.fillRect(0, 0, W, H);
    }

    // ── Ground platforms (GBA Pokémon style) ──────────────────────────────
    const ground = this.add.graphics();
    // Enemy platform — ellipse, upper right
    ground.fillStyle(0x282048, 0.6);
    ground.fillEllipse(W * 0.70, BATTLE_H * 0.68, 180, 24);
    ground.lineStyle(1, 0x3a3060, 0.5);
    ground.strokeEllipse(W * 0.70, BATTLE_H * 0.68, 180, 24);
    // Player platform — ellipse, lower left
    ground.fillStyle(0x282048, 0.6);
    ground.fillEllipse(W * 0.24, BATTLE_H * 0.92, 160, 20);
    ground.lineStyle(1, 0x3a3060, 0.5);
    ground.strokeEllipse(W * 0.24, BATTLE_H * 0.92, 160, 20);
    ground.setDepth(2);

    // ── Enemy sprite (upper right) — slides in from right ──────────────
    const enemyScale = this.isBoss ? 6 : 5;
    const enemySpriteY = BATTLE_H * 0.48;
    const enemyFinalX = W * 0.70;
    this.enemySprite = this.add.sprite(W + 60, enemySpriteY, this.enemyData.textureKey);
    this.enemySprite.setScale(enemyScale);
    this.enemySprite.setDepth(5);

    this.tweens.add({
      targets: this.enemySprite,
      x: enemyFinalX,
      duration: 600,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Idle float after entry
        this.tweens.add({
          targets: this.enemySprite,
          y: enemySpriteY - 5,
          duration: this.isBoss ? 1800 : 1300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    // ── Player sprite — slides in from left ──────────────────────────────
    const playerFinalX = W * 0.24;
    this.playerSprite = this.add.sprite(-40, BATTLE_H * 0.72, 'player-up-0');
    this.playerSprite.setScale(5);
    this.playerSprite.setDepth(5);

    this.tweens.add({
      targets: this.playerSprite,
      x: playerFinalX,
      duration: 600,
      ease: 'Back.easeOut',
    });

    // ── Enemy info box (top LEFT — Pokémon layout) ────────────────────────
    const infoBoxX = W * 0.04;
    const infoBoxY = BATTLE_H * 0.04;
    const infoBoxW = 240;
    const infoBoxH = this.isBoss ? 56 : 48;

    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x0a0020, 0.92);
    infoBg.fillRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH);
    infoBg.lineStyle(2, this.isBoss ? 0xffd700 : 0x4080ff);
    infoBg.strokeRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH);
    infoBg.setDepth(8);

    // Enemy name
    this.enemyNameText = this.add.text(
      infoBoxX + 10, infoBoxY + 7,
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
    this.phaseText = this.add.text(infoBoxX + 10, infoBoxY + 19, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#ff4444',
    }).setDepth(10);

    if (this.isBoss) {
      this.phaseText.setText('PHASE I');
    }

    // Enemy HP row
    const ehpLabelY = this.isBoss ? infoBoxY + 30 : infoBoxY + 22;
    this.add.text(infoBoxX + 10, ehpLabelY, 'HP', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#aaaaaa',
    }).setDepth(10);

    const ehpBarX = infoBoxX + 30;
    const ehpBarY = ehpLabelY + 1;
    const ehpBarW = infoBoxW - 44;
    const ehpBarH = 7;

    this.enemyHpBg = this.add.rectangle(
      ehpBarX + ehpBarW / 2, ehpBarY + ehpBarH / 2,
      ehpBarW, ehpBarH, 0x202020
    ).setDepth(9);

    this.enemyHpBar = this.add.rectangle(
      ehpBarX, ehpBarY,
      ehpBarW, ehpBarH, 0x40c040
    ).setOrigin(0, 0).setDepth(10);

    this.enemyHpText = this.add.text(
      infoBoxX + 10, ehpLabelY + 12,
      `${this.currentEnemyHp}/${this.enemyData.maxHp}`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#888888',
      }
    ).setDepth(10);

    // ── Player info box (bottom RIGHT — Pokémon layout) ───────────────────
    const store = useGameStore.getState();
    const phpBoxW = 220;
    const phpBoxH = 52;
    const phpBoxX = W - phpBoxW - W * 0.04;
    const phpBoxY = BATTLE_H - phpBoxH - BATTLE_H * 0.08;

    const phpBg = this.add.graphics();
    phpBg.fillStyle(0x0a0020, 0.92);
    phpBg.fillRect(phpBoxX, phpBoxY, phpBoxW, phpBoxH);
    phpBg.lineStyle(2, 0x4040a0);
    phpBg.strokeRect(phpBoxX, phpBoxY, phpBoxW, phpBoxH);
    phpBg.setDepth(8);

    const pName = useGameStore.getState().playerName || 'PLAYER';
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

    const phpBarX = phpBoxX + 30;
    const phpBarY = phpBoxY + 23;
    const phpBarW = phpBoxW - 44;
    const phpBarH = 7;

    this.playerHpBg = this.add.rectangle(
      phpBarX + phpBarW / 2, phpBarY + phpBarH / 2,
      phpBarW, phpBarH, 0x202020
    ).setDepth(9);

    const phpFrac = Math.max(0, store.hp / store.maxHp);
    this.playerHpBar = this.add.rectangle(
      phpBarX, phpBarY,
      phpBarW * phpFrac, phpBarH, this.hpColor(phpFrac)
    ).setOrigin(0, 0).setDepth(10);

    this.playerHpText = this.add.text(
      phpBoxX + 10, phpBoxY + 36,
      `${store.hp}/${store.maxHp}`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#888888',
      }
    ).setDepth(10);

    // ── Message box (full-width, GBA textbox style) ───────────────────────
    const msgBg = this.add.graphics();
    msgBg.fillStyle(0x08001a, 0.97);
    msgBg.fillRect(6, MSG_Y, W - 12, MSG_H);
    msgBg.lineStyle(2, 0xffd700, 0.8);
    msgBg.strokeRect(6, MSG_Y, W - 12, MSG_H);
    msgBg.setDepth(12);

    this.messageText = this.add.text(18, MSG_Y + 12, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#f0f0f0',
      wordWrap: { width: W - 44 },
      lineSpacing: 8,
    }).setDepth(14);

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

  // ── Attack menu ───────────────────────────────────────────────────────────

  private buildAttackMenu(menuY: number, menuH: number): void {
    const W = this.scale.width;
    const store = useGameStore.getState();
    const unlockedIds = store.unlockedAttacks.map(a => a.id);

    const allAttackIds = ['bass-drop', 'echo-wave', 'hook-impact', 'reverb-strike'];
    const cols = 2;
    const gap = 6;
    const padX = 10;
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

      const container = this.buildAttackButton(x, y, btnW, btnH, attack, unlocked, i);
      this.attackButtons.push(container);
    }
  }

  private buildAttackButton(
    x: number, y: number, w: number, h: number,
    attack: Attack, unlocked: boolean, index: number
  ): Phaser.GameObjects.Container {
    const alpha = unlocked ? 1 : 0.35;
    const borderColor = unlocked ? attack.color : 0x222244;
    const colorHex = '#' + attack.color.toString(16).padStart(6, '0');

    const drawBg = (g: Phaser.GameObjects.Graphics, fill: number, a: number, bColor: number, inner?: boolean) => {
      g.clear();
      g.fillStyle(fill, a);
      g.fillRect(0, 0, w, h);
      g.lineStyle(2, bColor);
      g.strokeRect(0, 0, w, h);
      if (inner) {
        g.lineStyle(1, 0xffd700, 0.35);
        g.strokeRect(2, 2, w - 4, h - 4);
      }
      // left color accent bar
      if (unlocked) {
        g.fillStyle(bColor, 0.6);
        g.fillRect(0, 0, 3, h);
      }
    };

    const bg = this.add.graphics();
    drawBg(bg, 0x0a001a, alpha, borderColor);

    const nameText = this.add.text(12, Math.floor(h * 0.18), attack.name, {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: unlocked ? colorHex : '#444466',
    });

    const dmgText = this.add.text(12, Math.floor(h * 0.60), unlocked ? `DMG: ${attack.damage}` : '???', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: unlocked ? '#999999' : '#333355',
    });

    const lockText = unlocked ? null : this.add.text(w - 10, Math.floor(h * 0.18), `LV.${attack.unlockLevel}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#555577',
    }).setOrigin(1, 0);

    const parts: Phaser.GameObjects.GameObject[] = [bg, nameText, dmgText];
    if (lockText) parts.push(lockText);

    const container = this.add.container(x, y, parts);
    container.setDepth(15);

    if (unlocked) {
      container.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, w, h),
        Phaser.Geom.Rectangle.Contains
      );

      container.on('pointerover', () => {
        if (!this.inputBlocked) {
          drawBg(bg, 0x180838, 1, attack.color, true);
        }
      });

      container.on('pointerout', () => {
        drawBg(bg, 0x0a001a, 1, attack.color);
      });

      container.on('pointerdown', () => {
        if (this.turnState === 'player-choose' && !this.inputBlocked && this.messageReady) {
          this.executePlayerAttack(attack, index);
        }
      });
    }

    return container;
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
    this.attackButtons.forEach(btn => btn.setAlpha(enabled ? 1 : 0.55));
  }

  private executePlayerAttack(attack: Attack, btnIndex: number): void {
    this.setTurnState('player-attack');

    // Button flash
    const btn = this.attackButtons[btnIndex];
    this.tweens.add({
      targets: btn,
      scaleX: 1.06, scaleY: 1.06,
      duration: 80,
      yoyo: true,
    });

    const damage = applyDamageVariance(attack.damage);
    this.setMessage(`${attack.name}!`);

    this.playPlayerAttackAnimation(attack, () => {
      this.currentEnemyHp = Math.max(0, this.currentEnemyHp - damage);
      this.updateEnemyHpBar();
      this.showFloatingDamage(damage, this.enemySprite.x, this.enemySprite.y - 30, attack.color);

      // Enemy hit reaction: flash white + horizontal shake + slight knockback
      const origX = this.enemySprite.x;
      this.enemySprite.setTint(0xffffff);
      this.time.delayedCall(60, () => this.enemySprite.clearTint());
      this.tweens.add({
        targets: this.enemySprite,
        x: origX + 8,
        duration: 40,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut',
        onComplete: () => { this.enemySprite.x = origX; },
      });

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
      this.playEnemyAttackAnimation(() => {
        store.takeDamage(damage);
        EventBus.emit(EVENTS.HP_CHANGED, store.hp);
        this.updatePlayerHpBar();
        this.showFloatingDamage(damage, this.playerSprite.x, this.playerSprite.y - 30, 0xe03030);

        // Player hit reaction: shake + red flash
        const origX = this.playerSprite.x;
        this.playerSprite.setTint(0xff4444);
        this.time.delayedCall(100, () => this.playerSprite.clearTint());
        this.tweens.add({
          targets: this.playerSprite,
          x: origX - 6,
          duration: 40,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.easeInOut',
          onComplete: () => { this.playerSprite.x = origX; },
        });

        this.time.delayedCall(700, () => {
          if (store.hp <= 0) {
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
          // Shrink + spin out
          this.tweens.add({
            targets: this.enemySprite,
            scaleX: 0,
            scaleY: 0,
            angle: 360,
            duration: 500,
            ease: 'Back.easeIn',
          });
          // Burst particles outward
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

      this.time.delayedCall(1800, () => {
        this.cameras.main.fadeOut(600);
        this.time.delayedCall(600, () => {
          this.scene.stop('BattleScene');
          EventBus.emit(EVENTS.BATTLE_END, { outcome: 'lose', enemyId: this.enemyData.id, isBoss: this.isBoss });
        });
      });
    }
  }

  // ── HP bars (Pokémon pill style) ──────────────────────────────────────────

  private hpColor(frac: number): number {
    if (frac > 0.5) return 0x40c040;
    if (frac > 0.25) return 0xe0c000;
    return 0xe03030;
  }

  private updateEnemyHpBar(): void {
    const frac  = Math.max(0, this.currentEnemyHp / this.enemyData.maxHp);
    const totalW = (this.enemyHpBg.width);
    this.enemyHpBar.setSize(totalW * frac, 7);
    this.enemyHpBar.setFillStyle(this.hpColor(frac));
    this.enemyHpText.setText(`${this.currentEnemyHp}/${this.enemyData.maxHp}`);
  }

  private updatePlayerHpBar(): void {
    const store  = useGameStore.getState();
    const frac   = Math.max(0, store.hp / store.maxHp);
    const totalW = (this.playerHpBg.width);
    this.playerHpBar.setSize(totalW * frac, 7);
    this.playerHpBar.setFillStyle(this.hpColor(frac));
    this.playerHpText.setText(`${store.hp}/${store.maxHp}`);
  }

  // ── Message box typewriter ────────────────────────────────────────────────

  private setMessage(text: string): void {
    this.messageReady = false;
    this.fullMessageText = text;
    this.typewriterTimer?.remove();
    this.messageText.setText('');

    let charIndex = 0;
    this.typewriterTimer = this.time.addEvent({
      delay: 28,
      repeat: text.length - 1,
      callback: () => {
        charIndex++;
        this.messageText.setText(text.slice(0, charIndex));
        if (charIndex >= text.length) {
          this.messageReady = true;
        }
      },
    });
  }

  private skipTypewriter(): void {
    this.typewriterTimer?.remove();
    this.messageText.setText(this.fullMessageText);
    this.messageReady = true;
  }

  // ── Attack animations ─────────────────────────────────────────────────────

  private playPlayerAttackAnimation(attack: Attack, onComplete: () => void): void {
    const W = this.scale.width;
    const color = attack.color;
    const eX = this.enemySprite.x;
    const eY = this.enemySprite.y;
    const pX = this.playerSprite.x;
    const pY = this.playerSprite.y;

    switch (attack.id) {

      // ── BASS DROP ─────────────────────────────────────────────────────
      // Deep sonic shockwave: player stomps → bass rings travel to enemy
      case 'bass-drop': {
        // Player wind-up: bob down then up
        this.tweens.add({
          targets: this.playerSprite,
          y: pY + 4,
          duration: 100,
          yoyo: true,
          ease: 'Quad.easeIn',
        });

        this.time.delayedCall(120, () => {
          // Shoot a projectile orb from player → enemy
          const orb = this.add.graphics().setDepth(20);
          const orbObj = { x: pX, y: pY - 10, r: 6 };
          const orbTween = this.tweens.add({
            targets: orbObj,
            x: eX,
            y: eY,
            duration: 280,
            ease: 'Quad.easeIn',
            onUpdate: () => {
              orb.clear();
              // Trailing glow
              orb.fillStyle(color, 0.2);
              orb.fillCircle(orbObj.x, orbObj.y, 14);
              orb.fillStyle(color, 0.6);
              orb.fillCircle(orbObj.x, orbObj.y, 8);
              orb.fillStyle(0xffffff, 0.9);
              orb.fillCircle(orbObj.x, orbObj.y, 3);
            },
            onComplete: () => {
              orb.destroy();
              // Impact: concentric bass rings expanding at enemy
              const rings = this.add.graphics().setDepth(20);
              const ringState = { t: 0 };
              const ringAnim = this.time.addEvent({
                delay: 16,
                repeat: 25,
                callback: () => {
                  ringState.t++;
                  rings.clear();
                  for (let i = 0; i < 3; i++) {
                    const r = ringState.t * 7 - i * 16;
                    if (r > 0 && r < 120) {
                      const alpha = 1 - r / 120;
                      rings.lineStyle(3 - i * 0.5, color, alpha);
                      rings.strokeCircle(eX, eY, r);
                    }
                  }
                },
              });
              // Vertical impact line below enemy
              const impactLine = this.add.graphics().setDepth(19);
              impactLine.fillStyle(color, 0.4);
              impactLine.fillRect(eX - 2, eY + 10, 4, this.battleH - eY);
              this.tweens.add({
                targets: impactLine,
                alpha: 0,
                duration: 350,
                onComplete: () => impactLine.destroy(),
              });

              this.cameras.main.shake(200, 0.007);
              this.time.delayedCall(420, () => { rings.destroy(); onComplete(); });
            },
          });
        });
        break;
      }

      // ── ECHO WAVE ─────────────────────────────────────────────────────
      // Two sonic crescents ripple across the battlefield
      case 'echo-wave': {
        const fireWave = (index: number, onDone: () => void) => {
          const wave = this.add.graphics().setDepth(20);
          const amplitude = 12 + index * 6;
          const thickness = 2 + index;
          const waveState = { progress: 0, headX: pX };

          this.tweens.add({
            targets: waveState,
            headX: eX + 20,
            duration: 320,
            ease: 'Sine.easeOut',
            onUpdate: () => {
              waveState.progress += 0.35;
              wave.clear();

              // Draw sine wave trail from player to head
              wave.lineStyle(thickness, color, 0.85);
              wave.beginPath();
              const startX = Math.max(pX - 10, waveState.headX - 120);
              let first = true;
              for (let x = startX; x <= waveState.headX; x += 3) {
                const distFromHead = waveState.headX - x;
                const fade = Math.min(1, distFromHead / 60);
                const waveY = eY + Math.sin(x * 0.06 + waveState.progress) * amplitude * (1 - fade * 0.5);
                if (first) { wave.moveTo(x, waveY); first = false; }
                else wave.lineTo(x, waveY);
              }
              wave.strokePath();

              // Glowing head
              wave.fillStyle(0xffffff, 0.8);
              wave.fillCircle(waveState.headX, eY + Math.sin(waveState.headX * 0.06 + waveState.progress) * amplitude, 4);
            },
            onComplete: () => {
              // Impact burst at enemy
              const burst = this.add.graphics().setDepth(21);
              burst.fillStyle(color, 0.7);
              burst.fillCircle(eX, eY, 16);
              burst.fillStyle(0xffffff, 0.5);
              burst.fillCircle(eX, eY, 6);
              this.tweens.add({
                targets: burst,
                alpha: 0,
                scaleX: 2, scaleY: 2,
                duration: 250,
                onComplete: () => { burst.destroy(); wave.destroy(); onDone(); },
              });
            },
          });
        };

        fireWave(0, () => {
          this.time.delayedCall(80, () => {
            fireWave(1, onComplete);
          });
        });
        break;
      }

      // ── HOOK IMPACT ───────────────────────────────────────────────────
      // Sharp melodic strike: quick slashes converge → star burst + sparks
      case 'hook-impact': {
        // Brief charge flash at player
        const chargeFlash = this.add.graphics().setDepth(20);
        chargeFlash.fillStyle(0xffffff, 0.6);
        chargeFlash.fillCircle(pX, pY - 10, 10);
        this.tweens.add({
          targets: chargeFlash,
          alpha: 0,
          scaleX: 0.1, scaleY: 0.1,
          duration: 120,
          onComplete: () => chargeFlash.destroy(),
        });

        // Sequential slashes at enemy
        const slashTimings = [140, 220, 300];
        const slashAngles = [-35, 35, 0];
        const slashLen = 50;

        slashTimings.forEach((t, i) => {
          this.time.delayedCall(t, () => {
            const slash = this.add.graphics().setDepth(22);
            const angle = slashAngles[i] * Math.PI / 180;
            const x1 = eX - Math.cos(angle) * slashLen;
            const y1 = eY - Math.sin(angle) * slashLen;
            const x2 = eX + Math.cos(angle) * slashLen;
            const y2 = eY + Math.sin(angle) * slashLen;

            slash.lineStyle(4, color);
            slash.lineBetween(x1, y1, x2, y2);
            // Bright center line
            slash.lineStyle(2, 0xffffff, 0.7);
            slash.lineBetween(x1, y1, x2, y2);

            this.tweens.add({
              targets: slash,
              alpha: 0,
              duration: 250,
              delay: 60,
              onComplete: () => slash.destroy(),
            });
          });
        });

        // Impact star + sparks at convergence
        this.time.delayedCall(340, () => {
          this.cameras.main.shake(180, 0.008);

          // Star burst
          const star = this.add.graphics().setDepth(23);
          for (let a = 0; a < 8; a++) {
            const angle = (a / 8) * Math.PI * 2;
            star.lineStyle(2, 0xffffff, 0.9);
            star.lineBetween(
              eX, eY,
              eX + Math.cos(angle) * 20, eY + Math.sin(angle) * 20
            );
          }
          this.tweens.add({
            targets: star,
            alpha: 0,
            scaleX: 1.8, scaleY: 1.8,
            duration: 300,
            onComplete: () => star.destroy(),
          });

          // Sparks flying outward
          for (let s = 0; s < 8; s++) {
            const spark = this.add.graphics().setDepth(22);
            spark.fillStyle(s % 2 === 0 ? color : 0xffffff);
            spark.fillRect(-2, -2, 4, 4);
            spark.setPosition(eX, eY);
            const angle = (s / 8) * Math.PI * 2 + Math.random() * 0.4;
            const dist = 30 + Math.random() * 25;
            this.tweens.add({
              targets: spark,
              x: eX + Math.cos(angle) * dist,
              y: eY + Math.sin(angle) * dist,
              alpha: 0,
              duration: 350,
              ease: 'Quad.easeOut',
              onComplete: () => spark.destroy(),
            });
          }

          this.time.delayedCall(380, onComplete);
        });
        break;
      }

      // ── REVERB STRIKE ─────────────────────────────────────────────────
      // Ultimate resonance: screen dims → pulsing rings from player →
      // rings accelerate to enemy → massive explosion + screen flash
      case 'reverb-strike': {
        // Phase 1: Screen dims
        const dimOverlay = this.add.graphics().setDepth(18);
        dimOverlay.fillStyle(0x000000, 0);
        dimOverlay.fillRect(0, 0, W, this.battleH + 10);
        this.tweens.add({
          targets: dimOverlay,
          alpha: 0.45,
          duration: 250,
        });

        // Phase 2: Pulsing rings radiate from player
        this.time.delayedCall(250, () => {
          const chargeRings = this.add.graphics().setDepth(20);
          let chargeT = 0;
          const chargeAnim = this.time.addEvent({
            delay: 16,
            repeat: 18,
            callback: () => {
              chargeT++;
              chargeRings.clear();
              for (let i = 0; i < 3; i++) {
                const r = (chargeT * 4 + i * 12) % 50;
                const alpha = 0.8 - r / 50;
                chargeRings.lineStyle(2, color, alpha);
                chargeRings.strokeCircle(pX, pY - 10, r);
              }
            },
          });

          // Phase 3: Beam shoots from player to enemy
          this.time.delayedCall(320, () => {
            chargeRings.destroy();

            const beam = this.add.graphics().setDepth(21);
            const beamState = { headX: pX, alpha: 1 };
            this.tweens.add({
              targets: beamState,
              headX: eX,
              duration: 200,
              ease: 'Quad.easeIn',
              onUpdate: () => {
                beam.clear();
                // Wide beam trail
                beam.fillStyle(color, 0.3);
                beam.fillRect(pX, pY - 18, beamState.headX - pX, 16);
                // Core beam
                beam.fillStyle(color, 0.7);
                beam.fillRect(pX, pY - 13, beamState.headX - pX, 6);
                // White center
                beam.fillStyle(0xffffff, 0.5);
                beam.fillRect(pX, pY - 11, beamState.headX - pX, 2);
              },
              onComplete: () => {
                beam.destroy();

                // Phase 4: Explosion at enemy
                const explosion = this.add.graphics().setDepth(23);
                const expState = { r: 5, alpha: 1 };
                this.time.addEvent({
                  delay: 16,
                  repeat: 20,
                  callback: () => {
                    expState.r += 6;
                    expState.alpha = Math.max(0, 1 - expState.r / 130);
                    explosion.clear();
                    // Outer ring
                    explosion.lineStyle(4, color, expState.alpha);
                    explosion.strokeCircle(eX, eY, expState.r);
                    // Inner fill
                    explosion.fillStyle(0xffffff, expState.alpha * 0.4);
                    explosion.fillCircle(eX, eY, expState.r * 0.6);
                    // Cross flare
                    explosion.lineStyle(2, 0xffffff, expState.alpha * 0.6);
                    explosion.lineBetween(eX - expState.r, eY, eX + expState.r, eY);
                    explosion.lineBetween(eX, eY - expState.r, eX, eY + expState.r);
                  },
                });

                // Scatter debris particles
                for (let p = 0; p < 12; p++) {
                  const particle = this.add.graphics().setDepth(22);
                  particle.fillStyle(p % 3 === 0 ? 0xffffff : color);
                  particle.fillRect(-1, -1, 3, 3);
                  particle.setPosition(eX, eY);
                  const angle = (p / 12) * Math.PI * 2;
                  const dist = 40 + Math.random() * 40;
                  this.tweens.add({
                    targets: particle,
                    x: eX + Math.cos(angle) * dist,
                    y: eY + Math.sin(angle) * dist,
                    alpha: 0,
                    duration: 500,
                    ease: 'Quad.easeOut',
                    onComplete: () => particle.destroy(),
                  });
                }

                this.cameras.main.shake(350, 0.014);
                this.cameras.main.flash(250,
                  (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff
                );

                this.time.delayedCall(500, () => {
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

  private playEnemyAttackAnimation(onComplete: () => void): void {
    const origX = this.enemySprite.x;
    const origY = this.enemySprite.y;
    const pX = this.playerSprite.x;
    const pY = this.playerSprite.y;

    // Enemy lunges toward player
    const lungeX = origX - (origX - pX) * 0.35;
    const lungeY = origY + (pY - origY) * 0.25;

    this.tweens.add({
      targets: this.enemySprite,
      x: lungeX,
      y: lungeY,
      scaleX: this.enemySprite.scaleX * 1.1,
      scaleY: this.enemySprite.scaleY * 1.1,
      duration: 160,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Impact flash at player
        const impact = this.add.graphics().setDepth(20);
        impact.fillStyle(0xff4444, 0.5);
        impact.fillCircle(pX, pY, 24);
        impact.fillStyle(0xffffff, 0.4);
        impact.fillCircle(pX, pY, 10);
        this.tweens.add({
          targets: impact,
          alpha: 0,
          scaleX: 1.5, scaleY: 1.5,
          duration: 250,
          onComplete: () => impact.destroy(),
        });

        if (this.isBoss) this.cameras.main.shake(160, 0.006);

        // Return to original position
        this.tweens.add({
          targets: this.enemySprite,
          x: origX,
          y: origY,
          scaleX: this.enemySprite.scaleX / 1.1,
          scaleY: this.enemySprite.scaleY / 1.1,
          duration: 300,
          ease: 'Quad.easeOut',
          onComplete,
        });
      },
    });
  }

  // ── Defeat particles ────────────────────────────────────────────────────

  private spawnDefeatParticles(x: number, y: number): void {
    const colors = [0xffffff, 0xffd700, 0xff4444, 0x4080ff];
    for (let i = 0; i < 16; i++) {
      const particle = this.add.graphics().setDepth(25);
      const c = colors[i % colors.length];
      const size = 2 + Math.random() * 3;
      particle.fillStyle(c, 0.9);
      particle.fillRect(-size / 2, -size / 2, size, size);
      particle.setPosition(x, y);

      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 50 + Math.random() * 60;
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 20,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 600 + Math.random() * 300,
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
    }).setDepth(24).setOrigin(0.5).setAlpha(0.5);

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
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 120,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: [dmgText, shadow],
          y: y - 40,
          scaleX: 1,
          scaleY: 1,
          alpha: 0,
          duration: 800,
          ease: 'Quad.easeOut',
          onComplete: () => { dmgText.destroy(); shadow.destroy(); },
        });
      },
    });
  }
}
