/**
 * Shared singleton for mobile touch input.
 * React's MobileControls component sets these flags on touch events.
 * Phaser's Player reads them each update frame.
 */
export type MobileDirection = 'up' | 'right' | 'down' | 'left';

export const MobileInput: Record<MobileDirection, boolean> = {
  up: false,
  down: false,
  left: false,
  right: false,
};

let actionQueued = false;

export function queueMobileAction(): void {
  actionQueued = true;
}

export function consumeMobileAction(): boolean {
  if (!actionQueued) return false;
  actionQueued = false;
  return true;
}

export function resetMobileInput(): void {
  (Object.keys(MobileInput) as MobileDirection[]).forEach(direction => {
    MobileInput[direction] = false;
  });
  actionQueued = false;
}
