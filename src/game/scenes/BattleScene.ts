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
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpText!: Phaser.GameObjects.Text;
  private playerHpText!: Phaser.GameObjects.Text;
  private turnLabel!: Phaser.GameObjects.Text;
  private attackButtons: Phaser.GameObjects.Container[] = [];
  private messageText!: Phaser.GameObjects.Text;
  private enemyNameText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;

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
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Background ─────────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x08000f, 0.97);
    bg.fillRect(0, 0, W, H);

    // Animated scanlines
    const scanlines = this.add.graphics();
    scanlines.fillStyle(0x000000, 0.08);
    for (let y = 0; y < H; y += 4) {
      scanlines.fillRect(0, y, W, 2);
    }

    // Border
    const border = this.add.graphics();
    border.lineStyle(3, 0xffd700);
    border.strokeRect(4, 4, W - 8, H - 8);
    border.lineStyle(1, 0x8800ff);
    border.strokeRect(8, 8, W - 16, H - 16);

    if (this.isBoss) {
      // Boss arena atmosphere
      const aura = this.add.graphics();
      aura.fillStyle(0x330000, 0.3);
      aura.fillRect(0, 0, W, H);
    }

    // ── Enemy display ───────────────────────────────────────────────────────
    const enemyScale = this.isBoss ? 5 : 4;
    this.enemySprite = this.add.sprite(W / 2, H * 0.28, this.enemyData.textureKey);
    this.enemySprite.setScale(enemyScale);
    this.enemySprite.setDepth(5);

    // Enemy idle animation
    this.tweens.add({
      targets: this.enemySprite,
      y: H * 0.28 - 6,
      duration: this.isBoss ? 1800 : 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Enemy name
    this.enemyNameText = this.add.text(W / 2, H * 0.06, this.enemyData.name.toUpperCase(), {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: this.isBoss ? '#ffd700' : '#f0f0f0',
    }).setOrigin(0.5).setDepth(10);

    if (this.isBoss) {
      this.enemyNameText.setShadow(0, 0, '#ff0000', 8, true, true);
    }

    // Phase label (boss only)
    this.phaseText = this.add.text(W / 2, H * 0.10, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#ff4444',
    }).setOrigin(0.5).setDepth(10);

    if (this.isBoss) {
      this.phaseText.setText('Phase I');
    }

    // ── Enemy HP bar ────────────────────────────────────────────────────────
    const ehpBgX = W * 0.15;
    const ehpBgY = H * 0.14;
    const ehpW = W * 0.7;
    const ehpH = 12;

    this.add.text(ehpBgX, ehpBgY - 14, 'HP', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#aaaaaa',
    }).setDepth(10);

    const ehpBg = this.add.rectangle(ehpBgX + ehpW / 2, ehpBgY + ehpH / 2, ehpW, ehpH, 0x220000);
    ehpBg.setDepth(9);
    this.add.rectangle(ehpBgX + ehpW / 2, ehpBgY + ehpH / 2, ehpW + 4, ehpH + 4, 0x000000)
      .setDepth(8);

    this.enemyHpBar = this.add.rectangle(ehpBgX, ehpBgY, ehpW, ehpH, 0xe03030);
    this.enemyHpBar.setOrigin(0, 0);
    this.enemyHpBar.setDepth(10);

    this.enemyHpText = this.add.text(ehpBgX + ehpW / 2, ehpBgY + ehpH / 2, `${this.currentEnemyHp}/${this.enemyData.maxHp}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(11);

    // ── Player stats panel ──────────────────────────────────────────────────
    const store = useGameStore.getState();
    const panelY = H * 0.60;

    const playerPanel = this.add.graphics();
    playerPanel.fillStyle(0x0d0025, 0.95);
    playerPanel.fillRect(W * 0.05, panelY, W * 0.42, 70);
    playerPanel.lineStyle(2, 0x4040a0);
    playerPanel.strokeRect(W * 0.05, panelY, W * 0.42, 70);
    playerPanel.setDepth(8);

    this.add.text(W * 0.08, panelY + 8, 'PLAYER', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#aaaaaa',
    }).setDepth(10);

    this.add.text(W * 0.08, panelY + 24, 'HP', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#e03030',
    }).setDepth(10);

    const phpW = W * 0.28;
    const phpBg = this.add.rectangle(W * 0.15 + phpW / 2, panelY + 30, phpW, 10, 0x220000);
    phpBg.setDepth(9);
    this.playerHpBar = this.add.rectangle(W * 0.15, panelY + 25, phpW, 10, 0xe03030);
    this.playerHpBar.setOrigin(0, 0);
    this.playerHpBar.setDepth(10);

    this.playerHpText = this.add.text(W * 0.15 + phpW / 2, panelY + 45, `${store.hp}/${store.maxHp}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(11);

    this.add.text(W * 0.08, panelY + 55, `LVL ${store.level}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#ffd700',
    }).setDepth(10);

    // ── Message text ────────────────────────────────────────────────────────
    this.messageText = this.add.text(W * 0.55, panelY + 10, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#f0f0f0',
      wordWrap: { width: W * 0.4 },
      lineSpacing: 6,
    }).setDepth(10);

    // ── Turn label ──────────────────────────────────────────────────────────
    this.turnLabel = this.add.text(W / 2, H * 0.52, 'YOUR TURN', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#ffd700',
    }).setOrigin(0.5).setDepth(10);

    // ── Attack buttons ──────────────────────────────────────────────────────
    this.buildAttackMenu();

    // ── Start battle ────────────────────────────────────────────────────────
    this.cameras.main.fadeIn(300);
    this.setMessage(this.isBoss
      ? 'THE GATEKEEPER\nblocks your path!'
      : `A ${this.enemyData.name}\nappears!`);

    this.time.delayedCall(1200, () => {
      this.setTurnState('player-choose');
    });
  }

  // ── UI builders ───────────────────────────────────────────────────────────

  private buildAttackMenu(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const store = useGameStore.getState();
    const attacks = store.unlockedAttacks;

    const cols = 2;
    const rows = 2;
    const btnW = W * 0.44;
    const btnH = 38;
    const startX = W * 0.05;
    const startY = H * 0.76;
    const gapX = W * 0.50;
    const gapY = 44;

    // All 4 attack slots
    const allAttackIds = ['bass-drop', 'echo-wave', 'hook-impact', 'reverb-strike'];

    for (let i = 0; i < 4; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * gapX;
      const y = startY + row * gapY;
      const attackId = allAttackIds[i];
      const attack = ATTACKS[attackId] as Attack;
      const unlocked = attacks.some(a => a.id === attackId);

      const container = this.buildAttackButton(x, y, btnW, btnH, attack, unlocked, i);
      this.attackButtons.push(container);
    }
  }

  private buildAttackButton(
    x: number, y: number, w: number, h: number,
    attack: Attack, unlocked: boolean, index: number
  ): Phaser.GameObjects.Container {
    const bg = this.add.graphics();
    const alpha = unlocked ? 1 : 0.35;

    bg.fillStyle(0x1a1a3a, alpha);
    bg.fillRect(0, 0, w, h);
    bg.lineStyle(2, unlocked ? attack.color : 0x333355);
    bg.strokeRect(0, 0, w, h);

    const nameText = this.add.text(8, 6, attack.name, {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: unlocked ? '#' + attack.color.toString(16).padStart(6, '0') : '#444466',
    });

    const dmgText = this.add.text(8, 22, unlocked ? `DMG: ${attack.damage}` : '???', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: unlocked ? '#888888' : '#333355',
    });

    const lockText = unlocked ? null : this.add.text(w - 8, 6, `LVL ${attack.unlockLevel}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '5px',
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
          bg.clear();
          bg.fillStyle(0x2a2a5a);
          bg.fillRect(0, 0, w, h);
          bg.lineStyle(2, attack.color);
          bg.strokeRect(0, 0, w, h);
          bg.lineStyle(1, 0xffd700, 0.3);
          bg.strokeRect(2, 2, w - 4, h - 4);
        }
      });

      container.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x1a1a3a);
        bg.fillRect(0, 0, w, h);
        bg.lineStyle(2, attack.color);
        bg.strokeRect(0, 0, w, h);
      });

      container.on('pointerdown', () => {
        if (this.turnState === 'player-choose' && !this.inputBlocked) {
          this.executePlayerAttack(attack, index);
        }
      });
    }

    return container;
  }

  // ── Battle logic ──────────────────────────────────────────────────────────

  private setTurnState(state: TurnState): void {
    this.turnState = state;

    switch (state) {
      case 'player-choose':
        this.inputBlocked = false;
        this.turnLabel.setText('YOUR TURN');
        this.turnLabel.setColor('#ffd700');
        this.setMessage('Choose an attack:');
        this.setAttackButtonsEnabled(true);
        break;
      case 'player-attack':
      case 'enemy-attack':
        this.inputBlocked = true;
        this.setAttackButtonsEnabled(false);
        break;
      case 'battle-end':
        this.inputBlocked = true;
        this.setAttackButtonsEnabled(false);
        break;
    }
  }

  private setAttackButtonsEnabled(enabled: boolean): void {
    this.attackButtons.forEach(btn => {
      btn.setAlpha(enabled ? 1 : 0.6);
    });
  }

  private executePlayerAttack(attack: Attack, btnIndex: number): void {
    this.setTurnState('player-attack');
    this.turnLabel.setText('ATTACKING...');
    this.turnLabel.setColor('#4080ff');

    // Button flash
    const btn = this.attackButtons[btnIndex];
    this.tweens.add({
      targets: btn,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 100,
      yoyo: true,
    });

    const damage = applyDamageVariance(attack.damage);
    this.setMessage(`${attack.name}!`);

    // Attack animation
    this.playPlayerAttackAnimation(attack, () => {
      // Apply damage
      this.currentEnemyHp = Math.max(0, this.currentEnemyHp - damage);
      this.updateEnemyHpBar();

      this.showFloatingDamage(damage, this.enemySprite.x, this.enemySprite.y - 20, attack.color);

      // Enemy hit flash
      this.tweens.add({
        targets: this.enemySprite,
        tint: 0xffffff,
        duration: 80,
        yoyo: true,
        repeat: 2,
        onComplete: () => this.enemySprite.clearTint(),
      });

      // Check boss phase
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

      // Check if enemy dead
      if (this.currentEnemyHp <= 0) {
        this.time.delayedCall(600, () => this.endBattle('win'));
        return;
      }

      // Enemy turn
      this.time.delayedCall(700, () => this.executeEnemyAttack());
    });
  }

  private executeEnemyAttack(): void {
    this.setTurnState('enemy-attack');
    this.turnLabel.setText('ENEMY TURN');
    this.turnLabel.setColor('#e03030');

    const store = useGameStore.getState();
    const phaseMultiplier = this.isBoss ? BOSS_PHASES[this.bossPhaseIndex].attackMultiplier : 1;
    const attack = this.enemyData.attacks[Math.floor(Math.random() * this.enemyData.attacks.length)];
    const rawDmg = Math.round(attack.damage * phaseMultiplier);
    const damage = applyDamageVariance(rawDmg);

    this.setMessage(`${this.enemyData.name} uses\n${attack.name}!`);

    // Camera shake for boss attacks
    if (this.isBoss) {
      this.cameras.main.shake(150, 0.005);
    }

    this.time.delayedCall(800, () => {
      store.takeDamage(damage);
      EventBus.emit(EVENTS.HP_CHANGED, store.hp);

      this.updatePlayerHpBar();
      this.showFloatingDamage(damage, this.scale.width * 0.3, this.scale.height * 0.65, 0xe03030);

      this.time.delayedCall(600, () => {
        if (store.hp <= 0) {
          this.endBattle('lose');
        } else {
          this.setTurnState('player-choose');
        }
      });
    });
  }

  private triggerPhaseChange(phaseIdx: number): void {
    this.setTurnState('phase-change');
    const phaseLabels = ['Phase I', 'Phase II', 'Phase III'];
    const phaseColors = ['#ffd700', '#ff8800', '#ff0000'];

    this.cameras.main.flash(400, 150, 0, 200);
    this.cameras.main.shake(300, 0.008);

    this.phaseText.setText(phaseLabels[phaseIdx]);
    this.phaseText.setColor(phaseColors[phaseIdx]);

    // Boss texture change
    const textureKeys = ['boss-gatekeeper', 'boss-gatekeeper-phase2', 'boss-gatekeeper-phase3'];
    this.enemySprite.setTexture(textureKeys[phaseIdx]);

    const phaseMessages = [
      '',
      `${this.enemyData.name} enrages!\nPhase II begins!`,
      `THE GATEKEEPER\nfuriously awakens!\nPhase III!`,
    ];

    this.setMessage(phaseMessages[phaseIdx]);

    this.time.delayedCall(1500, () => {
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
        : `${this.enemyData.name}\ndefeated!`);

      // Enemy death animation
      this.tweens.add({
        targets: this.enemySprite,
        alpha: 0,
        scaleX: this.enemySprite.scaleX * 1.5,
        scaleY: this.enemySprite.scaleY * 1.5,
        duration: 500,
        ease: 'Power2',
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
            this.setMessage(`${this.enemyData.name} defeated!\n${xpMsg}\nLEVEL UP → ${store.level}!`);
          });
        }
      }

      this.time.delayedCall(1500, () => {
        this.cameras.main.fadeOut(400);
        this.time.delayedCall(400, () => {
          this.scene.stop('BattleScene');
          EventBus.emit(EVENTS.BATTLE_END, {
            outcome: 'win',
            enemyId: this.enemyData.id,
            isBoss: this.isBoss,
          });
        });
      });
    } else {
      this.setMessage('You were overcome\nby the silence...');
      this.cameras.main.shake(500, 0.01);

      this.time.delayedCall(1800, () => {
        this.cameras.main.fadeOut(600);
        this.time.delayedCall(600, () => {
          this.scene.stop('BattleScene');
          EventBus.emit(EVENTS.BATTLE_END, {
            outcome: 'lose',
            enemyId: this.enemyData.id,
            isBoss: this.isBoss,
          });
        });
      });
    }
  }

  // ── HP bars ───────────────────────────────────────────────────────────────

  private updateEnemyHpBar(): void {
    const frac = Math.max(0, this.currentEnemyHp / this.enemyData.maxHp);
    const W = this.scale.width;
    const totalW = W * 0.7;
    const color = frac > 0.5 ? 0x40c040 : frac > 0.25 ? 0xe0a030 : 0xe03030;

    this.enemyHpBar.setSize(totalW * frac, 12);
    this.enemyHpBar.setFillStyle(color);
    this.enemyHpText.setText(`${this.currentEnemyHp}/${this.enemyData.maxHp}`);
  }

  private updatePlayerHpBar(): void {
    const store = useGameStore.getState();
    const frac = Math.max(0, store.hp / store.maxHp);
    const W = this.scale.width;
    const totalW = W * 0.28;
    const color = frac > 0.5 ? 0x40c040 : frac > 0.25 ? 0xe0a030 : 0xe03030;

    this.playerHpBar.setSize(totalW * frac, 10);
    this.playerHpBar.setFillStyle(color);
    this.playerHpText.setText(`${store.hp}/${store.maxHp}`);
  }

  // ── Animations ────────────────────────────────────────────────────────────

  private playPlayerAttackAnimation(attack: Attack, onComplete: () => void): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const color = attack.color;

    const flash = this.add.graphics();
    flash.setDepth(20);

    // Different animation per attack
    switch (attack.id) {
      case 'bass-drop': {
        // Shockwave circle expanding up
        const wave = this.add.graphics().setDepth(20);
        let r = 10;
        const expand = this.time.addEvent({
          delay: 16,
          repeat: 20,
          callback: () => {
            wave.clear();
            wave.lineStyle(4, color, 1 - r / 220);
            wave.strokeCircle(W / 2, H * 0.75, r);
            r += 10;
          },
          callbackScope: this,
        });
        this.cameras.main.shake(200, 0.006);
        this.time.delayedCall(350, () => { wave.destroy(); onComplete(); });
        break;
      }
      case 'echo-wave': {
        // Two horizontal waves
        for (let j = 0; j < 2; j++) {
          this.time.delayedCall(j * 200, () => {
            const line = this.add.graphics().setDepth(20);
            let progress = 0;
            const anim = this.time.addEvent({
              delay: 16,
              repeat: 18,
              callback: () => {
                line.clear();
                line.lineStyle(3, color, 0.9);
                line.beginPath();
                for (let x = W * 0.1; x < W * 0.9; x += 5) {
                  const waveY = H * 0.45 + Math.sin((x * 0.05) + progress) * 15;
                  x === W * 0.1 ? line.moveTo(x, waveY) : line.lineTo(x, waveY);
                }
                line.strokePath();
                progress += 0.4;
              },
            });
            this.time.delayedCall(300, () => { line.destroy(); if (j === 1) onComplete(); });
          });
        }
        break;
      }
      case 'hook-impact': {
        // Sharp slash lines
        const slashes = this.add.graphics().setDepth(20);
        slashes.lineStyle(5, color);
        slashes.lineBetween(W * 0.3, H * 0.15, W * 0.7, H * 0.42);
        slashes.lineBetween(W * 0.35, H * 0.12, W * 0.65, H * 0.4);
        this.cameras.main.shake(250, 0.008);
        this.tweens.add({
          targets: slashes,
          alpha: 0,
          duration: 400,
          onComplete: () => { slashes.destroy(); onComplete(); },
        });
        break;
      }
      case 'reverb-strike': {
        // Full screen burst
        flash.fillStyle(color, 0.6);
        flash.fillRect(0, 0, W, H);
        this.cameras.main.shake(400, 0.015);
        this.cameras.main.flash(200,
          (color >> 16) & 0xff,
          (color >> 8) & 0xff,
          color & 0xff
        );
        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 500,
          onComplete: () => { flash.destroy(); onComplete(); },
        });
        break;
      }
      default:
        this.time.delayedCall(300, onComplete);
    }
  }

  private showFloatingDamage(damage: number, x: number, y: number, color: number): void {
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    const dmgText = this.add.text(x, y, `-${damage}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: colorHex,
    }).setDepth(25).setOrigin(0.5);

    this.tweens.add({
      targets: dmgText,
      y: y - 35,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 900,
      ease: 'Power2',
      onComplete: () => dmgText.destroy(),
    });
  }

  private setMessage(text: string): void {
    this.messageText.setText(text);
  }
}
