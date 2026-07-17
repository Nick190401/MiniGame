import { useEffect, useState } from 'react';
import { MobileInput } from '../game/input/MobileInput';

type Direction = keyof typeof MobileInput;

const ARROWS: Record<Direction, string> = {
  up: '↑',
  right: '→',
  down: '↓',
  left: '←',
};

export function MobileControls() {
  const [visible, setVisible] = useState(false);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);

  useEffect(() => {
    setVisible(window.matchMedia('(pointer: coarse)').matches);
    const onTouch = () => setVisible(true);
    window.addEventListener('touchstart', onTouch, { once: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);

  if (!visible) return null;

  const setDirection = (direction: Direction, active: boolean) => {
    if (active) {
      (Object.keys(MobileInput) as Direction[]).forEach(key => {
        MobileInput[key] = false;
      });
    }
    MobileInput[direction] = active;
    setActiveDirection(active ? direction : null);
  };

  const buttonProps = (direction: Direction) => ({
    className: `mobile-dpad__button mobile-dpad__button--${direction}`,
    'aria-label': `Move ${direction}`,
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDirection(direction, true);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setDirection(direction, false);
    },
    onPointerCancel: () => setDirection(direction, false),
    onPointerLeave: () => setDirection(direction, false),
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  });

  return (
    <div className="mobile-control-wrap">
      <div className="mobile-control-label"><span>Nav</span><small>Touch input</small></div>
      <div className="mobile-dpad">
        <div className="mobile-dpad__ring" />
        {(Object.keys(ARROWS) as Direction[]).map((direction) => (
          <button key={direction} {...buttonProps(direction)}>{ARROWS[direction]}</button>
        ))}
        <div className={`mobile-dpad__core ${activeDirection ? 'is-active' : ''}`}>
          <span>{activeDirection ? ARROWS[activeDirection] : 'SQ'}</span>
        </div>
      </div>
    </div>
  );
}
