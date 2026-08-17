import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { gameConfig } from '../game/config';
import { HUD } from './HUD';
import { MobileControls } from './MobileControls';
import { DialogueOverlay } from './DialogueOverlay';
import { BattleOverlay } from './BattleOverlay';
import { DeathOverlay } from './DeathOverlay';
import { GameNoticeOverlay } from './GameNoticeOverlay';
import { LoadingOverlay } from './LoadingOverlay';
import { ZoneOverlay } from './ZoneOverlay';
import { RewardModal } from './RewardModal';
import { useGameStore } from '../store/gameStore';
import { getAttacksForLevel } from '../game/systems/AttackSystem';
import { MAX_LEVEL, XP_THRESHOLDS } from '../game/systems/XPSystem';
import { EventBus, EVENTS } from '../game/EventBus';
import { AudioManager } from '../game/audio/AudioManager';

interface GameContainerProps {
  visible: boolean;
}

const DESKTOP_GAME_SIZE = { width: 640, height: 480 } as const;
const PORTRAIT_GAME_WIDTH = 480;
// Phone viewports are far taller than the old fixed 480x640 board, so FIT
// letterboxed roughly a third of the screen away. Deriving the logical height
// from the real viewport ratio makes the canvas fill the phone instead.
const PORTRAIT_HEIGHT_RANGE = { min: 620, max: 1180 } as const;
// Quantised so the URL bar sliding in and out does not thrash setGameSize.
const PORTRAIT_HEIGHT_STEP = 16;

function getResponsiveGameSize() {
  if (!window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches) {
    return DESKTOP_GAME_SIZE;
  }
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const ratio = viewportHeight / Math.max(1, viewportWidth);
  const stepped = Math.round((PORTRAIT_GAME_WIDTH * ratio) / PORTRAIT_HEIGHT_STEP) * PORTRAIT_HEIGHT_STEP;
  return {
    width: PORTRAIT_GAME_WIDTH,
    height: Math.min(PORTRAIT_HEIGHT_RANGE.max, Math.max(PORTRAIT_HEIGHT_RANGE.min, stepped)),
  };
}

export function GameContainer({ visible }: GameContainerProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const battleActiveRef = useRef(false);
  const [battleActive, setBattleActive] = useState(false);
  const [deathActive, setDeathActive] = useState(false);
  const [worldReady, setWorldReady] = useState(false);

  useEffect(() => {
    const showBattle = () => {
      battleActiveRef.current = true;
      setBattleActive(true);
      setDeathActive(false);
    };
    const hideBattle = () => {
      battleActiveRef.current = false;
      setBattleActive(false);
    };
    const showDeath = () => setDeathActive(true);
    const hideDeath = () => setDeathActive(false);
    const handleSceneReady = (sceneKey: string) => {
      if (sceneKey === 'WorldScene') setWorldReady(true);
    };
    EventBus.on(EVENTS.BATTLE_START, showBattle);
    EventBus.on(EVENTS.BATTLE_END, hideBattle);
    EventBus.on(EVENTS.PLAYER_DIED, showDeath);
    EventBus.on(EVENTS.RESPAWN, hideDeath);
    EventBus.on(EVENTS.SCENE_READY, handleSceneReady);
    return () => {
      EventBus.off(EVENTS.BATTLE_START, showBattle);
      EventBus.off(EVENTS.BATTLE_END, hideBattle);
      EventBus.off(EVENTS.PLAYER_DIED, showDeath);
      EventBus.off(EVENTS.RESPAWN, hideDeath);
      EventBus.off(EVENTS.SCENE_READY, handleSceneReady);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (gameRef.current) return;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      const responsiveSize = getResponsiveGameSize();

      gameRef.current = new Phaser.Game({
        ...gameConfig,
        parent: containerRef.current,
        scale: {
          ...gameConfig.scale,
          width: responsiveSize.width,
          height: responsiveSize.height,
        },
      });

      // Phaser reads the parent size during construction. Production CSS can
      // arrive from cache a frame later, so refresh once the full-screen stage
      // has settled instead of keeping the 640x480 fallback display size.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => gameRef.current?.scale.refresh());
      });

      // Expose game instance for console commands
      (window as unknown as Record<string, unknown>).game = gameRef.current;

      // Register console cheat commands
      registerCheatCommands(gameRef);
    }, 50);

    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible || !containerRef.current) return;

    let resizeFrame = 0;
    const refreshScale = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        const game = gameRef.current;
        if (!game) return;

        if (!battleActiveRef.current) {
          const target = getResponsiveGameSize();
          if (game.scale.gameSize.width !== target.width || game.scale.gameSize.height !== target.height) {
            game.scale.setGameSize(target.width, target.height);
          }
        }
        game.scale.refresh();
      });
    };
    const resizeObserver = new ResizeObserver(refreshScale);
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', refreshScale);
    window.visualViewport?.addEventListener('resize', refreshScale);

    return () => {
      cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', refreshScale);
      window.visualViewport?.removeEventListener('resize', refreshScale);
    };
  }, [visible]);

  useEffect(() => {
    if (battleActive) return;
    const game = gameRef.current;
    if (!game) return;
    const target = getResponsiveGameSize();
    if (game.scale.gameSize.width !== target.width || game.scale.gameSize.height !== target.height) {
      game.scale.setGameSize(target.width, target.height);
    }
    game.scale.refresh();
  }, [battleActive]);

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
      delete (window as any).reward;
    };
  }, []);

  return (
    <div
      className={`game-stage absolute inset-0${deathActive ? ' game-stage--death' : ''}${battleActive ? ' game-stage--battle' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        visibility: visible ? 'visible' : 'hidden',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* Phaser canvas container */}
      <div
        ref={containerRef}
        className="game-canvas w-full h-full"
        id="game-container"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      <div className="game-stage__frame" aria-hidden="true">
        <span className="game-stage__corner game-stage__corner--tl" />
        <span className="game-stage__corner game-stage__corner--tr" />
        <span className="game-stage__corner game-stage__corner--bl" />
        <span className="game-stage__corner game-stage__corner--br" />
        {!battleActive && (
          <span className="game-stage__mode">
            {deathActive ? 'Signal state // lost' : 'Field mode // live'}
          </span>
        )}
      </div>

      {/* React UI overlays */}
      {visible && (
        <>
          {worldReady && !battleActive && !deathActive && <HUD />}
          {worldReady && !battleActive && !deathActive && <MobileControls />}
          {worldReady && !battleActive && !deathActive && <DialogueOverlay canvasParentRef={containerRef} />}
          {!worldReady && <LoadingOverlay canvasParentRef={containerRef} />}
          {worldReady && !battleActive && !deathActive && <ZoneOverlay canvasParentRef={containerRef} />}
          {battleActive && !deathActive && <BattleOverlay canvasParentRef={containerRef} />}
          {worldReady && !deathActive && <GameNoticeOverlay canvasParentRef={containerRef} />}
          {deathActive && <DeathOverlay canvasParentRef={containerRef} />}
          <RewardModal />
        </>
      )}
    </div>
  );
}

// ── Console cheat commands ──────────────────────────────────────────────────

function registerCheatCommands(gameRef: React.MutableRefObject<Phaser.Game | null>) {
  const TILE = 16;

  // window.audio.toggleMute() / .setMusicVolume(0.3) / .setSfxVolume(1) / .playSfx('sfx-level-up')
  (window as any).audio = AudioManager;

  (window as any).reward = () => {
    useGameStore.setState({
      bossDefeated: true,
      bonusSongUnlocked: true,
      gamePhase: 'reward',
    });
    console.log('%c LOST TRACK UNLOCKED ', 'background: #d7ff4a; color: #050908; font-weight: bold');
  };

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

    // Open the physical blockers and the coherent sliding-door artwork.
    worldScene.openGate(false);

    // Teleport player into the final antechamber, just outside the Core.
    const player = worldScene.player as Phaser.Physics.Arcade.Sprite;
    player.setPosition(24 * TILE, 81 * TILE);

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
