import Phaser from 'phaser';
import { useLogicalCamera } from '../render/RenderScale';
import { EventBus, EVENTS } from '../EventBus';
import { ATTACK_ORDER, ATTACKS } from '../systems/AttackSystem';

/**
 * Lightweight Phaser bridge for global interface events.
 * Visible information is rendered in React so it stays crisp at every scale.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    useLogicalCamera(this);
    EventBus.on(EVENTS.LEVEL_UP, this.onLevelUp, this);
  }

  private onLevelUp(newLevel: number): void {
    const newMove = ATTACK_ORDER.map(id => ATTACKS[id]).find(attack => attack.unlockLevel === newLevel);
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: 'Level up',
      title: `Level ${newLevel} reached`,
      detail: newMove ? `New move: ${newMove.name}` : 'Your max HP went up.',
      tone: 'success',
      duration: 2400,
    });
  }

  shutdown(): void {
    EventBus.off(EVENTS.LEVEL_UP, this.onLevelUp, this);
  }
}
