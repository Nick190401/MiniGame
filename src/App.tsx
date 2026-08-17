import { useGameStore } from './store/gameStore';
import { TitleScreen } from './components/TitleScreen';
import { GameContainer } from './components/GameContainer';
import { MapEditor } from './components/MapEditor';
import { MenuMusic } from './components/MenuMusic';

export default function App() {
  const gamePhase = useGameStore(s => s.gamePhase);

  return (
    <div className="app-shell relative w-screen h-screen overflow-hidden">
      <MenuMusic />
      {gamePhase === 'title' && <TitleScreen />}
      {gamePhase === 'editor' && <MapEditor />}
      <GameContainer visible={gamePhase !== 'title' && gamePhase !== 'editor'} />
    </div>
  );
}
