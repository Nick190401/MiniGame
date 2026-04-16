/**
 * Shared singleton for mobile touch input.
 * React's MobileControls component sets these flags on touch events.
 * Phaser's Player reads them each update frame.
 */
export const MobileInput = {
  up: false,
  down: false,
  left: false,
  right: false,
};
