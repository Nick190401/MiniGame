import { Suspense, lazy, useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { TitleScreen } from './components/TitleScreen';
import { MenuMusic } from './components/MenuMusic';

// Phaser is 1.5 MB of engine that the title screen has no use for, so the two
// components that own it are split out and fetched on the way in rather than
// blocking the first paint of the key art.
const GameContainer = lazy(() =>
  import('./components/GameContainer').then(m => ({ default: m.GameContainer })));
const MapEditor = lazy(() =>
  import('./components/MapEditor').then(m => ({ default: m.MapEditor })));

export default function App() {
  const gamePhase = useGameStore(s => s.gamePhase);
  const onTitle = gamePhase === 'title';

  // Warm the engine chunk while the player is still reading the title screen,
  // so pressing start doesn't wait on a download.
  useEffect(() => {
    if (!onTitle) return;
    const warm = () => { void import('./components/GameContainer'); };
    const idle = window.requestIdleCallback;
    if (idle) {
      const handle = idle(warm, { timeout: 2500 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(warm, 900);
    return () => window.clearTimeout(timer);
  }, [onTitle]);

  return (
    <div className="app-shell relative w-screen h-screen overflow-hidden">
      <MenuMusic />
      {onTitle && <TitleScreen />}
      <Suspense fallback={null}>
        {gamePhase === 'editor' && <MapEditor />}
        {!onTitle && gamePhase !== 'editor' && <GameContainer visible />}
      </Suspense>
    </div>
  );
}
