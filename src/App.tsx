import { useGameStore } from './store/gameStore';
import { StartScreen } from './components/StartScreen';
import { GameContainer } from './components/GameContainer';
import { MapEditor } from './components/MapEditor';

export default function App() {
  const gamePhase = useGameStore(s => s.gamePhase);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {gamePhase === 'start' && <StartScreen />}
      {gamePhase === 'editor' && <MapEditor />}
      <GameContainer visible={gamePhase !== 'start' && gamePhase !== 'editor'} />
    </div>
  );
}
