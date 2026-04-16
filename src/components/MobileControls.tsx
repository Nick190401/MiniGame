import { useEffect, useState } from 'react';
import { MobileInput } from '../game/input/MobileInput';

export function MobileControls() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show on touch devices
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    setVisible(isTouch);

    // Also show if touch events are fired
    const onTouch = () => setVisible(true);
    window.addEventListener('touchstart', onTouch, { once: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);

  if (!visible) return null;

  const setDir = (dir: keyof typeof MobileInput, val: boolean) => {
    MobileInput[dir] = val;
  };

  const btnProps = (dir: keyof typeof MobileInput) => ({
    className: 'dpad-btn select-none',
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      setDir(dir, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      setDir(dir, false);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      e.preventDefault();
      setDir(dir, false);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div
      className="absolute bottom-6 left-6 z-30 pointer-events-auto"
      style={{ userSelect: 'none', touchAction: 'none' }}
    >
      {/* D-pad layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '48px 48px 48px',
          gridTemplateRows: '48px 48px 48px',
          gap: 4,
        }}
      >
        {/* Up */}
        <div />
        <button
          {...btnProps('up')}
          style={{
            gridColumn: 2,
            gridRow: 1,
            background: 'rgba(255,255,255,0.12)',
            border: '2px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            fontSize: 20,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ▲
        </button>
        <div />

        {/* Left / center / Right */}
        <button
          {...btnProps('left')}
          style={{
            gridColumn: 1,
            gridRow: 2,
            background: 'rgba(255,255,255,0.12)',
            border: '2px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            fontSize: 20,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ◀
        </button>

        {/* Center (decoration) */}
        <div
          style={{
            gridColumn: 2,
            gridRow: 2,
            background: 'rgba(255,255,255,0.06)',
            border: '2px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
          }}
        />

        <button
          {...btnProps('right')}
          style={{
            gridColumn: 3,
            gridRow: 2,
            background: 'rgba(255,255,255,0.12)',
            border: '2px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            fontSize: 20,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ▶
        </button>

        {/* Down */}
        <div />
        <button
          {...btnProps('down')}
          style={{
            gridColumn: 2,
            gridRow: 3,
            background: 'rgba(255,255,255,0.12)',
            border: '2px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            fontSize: 20,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ▼
        </button>
        <div />
      </div>

      {/* Hint */}
      <p
        className="text-center mt-2"
        style={{
          fontFamily: '"Press Start 2P"',
          fontSize: '5px',
          color: 'rgba(255,255,255,0.3)',
        }}
      >
        MOVE
      </p>
    </div>
  );
}
