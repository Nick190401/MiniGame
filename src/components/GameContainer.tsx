import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { gameConfig } from '../game/config';
import { HUD } from './HUD';
import { MobileControls } from './MobileControls';
import { RewardModal } from './RewardModal';

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
