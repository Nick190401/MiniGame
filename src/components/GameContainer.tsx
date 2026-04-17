import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { gameConfig } from '../game/config';
import { HUD } from './HUD';
import { MobileControls } from './MobileControls';
import { RewardModal } from './RewardModal';
import { useGameStore } from '../store/gameStore';
import { getAttacksForLevel } from '../game/systems/AttackSystem';
import { MAX_LEVEL, XP_THRESHOLDS } from '../game/systems/XPSystem';

interface GameContainerProps {
  visible: boolean;
}

export function GameContainer({ visible }: GameContainerProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    if (gameRef.current) return;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      gameRef.current = new Phaser.Game({
        ...gameConfig,
        parent: containerRef.current,
      });

      // Expose game instance for console commands
      (window as unknown as Record<string, unknown>).game = gameRef.current;

      // Register console cheat commands
      registerCheatCommands(gameRef);
    }, 50);

    return () => clearTimeout(timer);
  }, [visible]);

  // Destroy on unmount
  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Cleanup cheat commands on unmount
  useEffect(() => {
    return () => {
      delete (window as any).bossfight;
    };
  }, []);

  return (
    <div
      className="absolute inset-0"
      style={{
        visibility: visible ? 'visible' : 'hidden',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* Phaser canvas container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        id="game-container"
        style={{ position: 'relative' }}
      />

      {/* React UI overlays */}
      {visible && (
        <>
          <HUD />
          <MobileControls />
          <RewardModal />
        </>
      )}
    </div>
  );
}

// ── Console cheat commands ──────────────────────────────────────────────────

function registerCheatCommands(gameRef: React.MutableRefObject<Phaser.Game | null>) {
  const TILE = 16;

  (window as any).bossfight = () => {
    const game = gameRef.current;
    if (!game) { console.log('%c Game not ready!', 'color: red'); return; }

    const store = useGameStore.getState();

    // Max out level + XP + unlock all attacks
    const maxXp = XP_THRESHOLDS[MAX_LEVEL - 1] + 50;
    const allAttacks = getAttacksForLevel(MAX_LEVEL);
    const maxHp = 30 + (MAX_LEVEL - 1) * 10;
    const maxMp = 20 + (MAX_LEVEL - 1) * 5;
    useGameStore.setState({
      xp: maxXp,
      level: MAX_LEVEL,
      unlockedAttacks: allAttacks,
      hp: maxHp,
      maxHp,
      mp: maxMp,
      maxMp,
      gateOpen: true,
    });

    // Access WorldScene internals
    const worldScene = game.scene.getScene('WorldScene') as any;
    if (!worldScene || !worldScene.scene.isActive('WorldScene')) {
      console.log('%c WorldScene not active!', 'color: red');
      return;
    }

    // Open the gate visually (remove gate tiles)
    worldScene.gateOpen = true;
    const walls = worldScene.walls as Phaser.Physics.Arcade.StaticGroup;
    walls.getChildren().forEach((child: any) => {
      if (child.texture?.key === 'tile-gate') {
        walls.remove(child, true, true);
      }
    });

    // Teleport player just outside boss zone (y=69 tiles, center x=24 tiles)
    const player = worldScene.player as Phaser.Physics.Arcade.Sprite;
    player.setPosition(24 * TILE, 69 * TILE);

    // Reset boss encounter flag so it triggers on entry
    worldScene.bossEncounterStarted = false;

    console.log(
      '%c⚡ CHEAT ACTIVATED ⚡\n' +
      `%c Level: ${MAX_LEVEL} | HP: ${maxHp}/${maxHp} | Attacks: ${allAttacks.map(a => a.name).join(', ')}\n` +
      '%c Teleported to boss arena. Walk south!',
      'color: #ffd700; font-size: 16px; font-weight: bold',
      'color: #4080ff; font-size: 12px',
      'color: #40ff80; font-size: 12px',
    );
  };
}
