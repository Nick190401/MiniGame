export type PlayerDirection = 'down' | 'up' | 'left' | 'right';


export const PLAYER_TEXTURES: Record<PlayerDirection, readonly string[]> = {
  down: [
    'player-overworld-down-0',
    'player-overworld-down-1',
    'player-overworld-down-2',
    'player-overworld-down-3',
  ],
  up: [
    'player-overworld-up-0',
    'player-overworld-up-1',
    'player-overworld-up-2',
    'player-overworld-up-3',
  ],
  left: [
    'player-overworld-left-0',
    'player-overworld-left-1',
    'player-overworld-left-2',
    'player-overworld-left-3',
  ],
  right: [
    'player-overworld-right-0',
    'player-overworld-right-1',
    'player-overworld-right-2',
    'player-overworld-right-3',
  ],
};

export const PLAYER_TEXTURE_ASSETS = Object.values(PLAYER_TEXTURES).flat().map(key => ({
  key: key + '-source',
  url: `assets/player/overworld/${key.replace('player-overworld-', 'player-')}.png`,
}));

/** Normalize individual walking frames to a shared foot anchor, including on WebKit. */
export function createPlayerTextures(scene: Phaser.Scene): void {
  const scratch = document.createElement('canvas');
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  Object.values(PLAYER_TEXTURES).flat().forEach(key => {
    const source = scene.textures.get(key + '-source').getSourceImage() as HTMLImageElement;
    scratch.width = source.width;
    scratch.height = source.height;
    ctx.clearRect(0, 0, scratch.width, scratch.height);
    ctx.drawImage(source, 0, 0);
    if (key.includes('-down-')) {
      // Locate the original white cap initials, then replace only that panel.
      const cap = ctx.getImageData(0, 0, scratch.width, 90).data;
      let l = scratch.width, t = 90, r = 0, b = 0;
      for (let y = 35; y < 75; y++) for (let x = 110; x < 195; x++) {
        const i = (y * scratch.width + x) * 4;
        if (Math.min(cap[i], cap[i + 1], cap[i + 2]) < 190 || cap[i + 3] < 200) continue;
        l = Math.min(l, x); r = Math.max(r, x);
        t = Math.min(t, y); b = Math.max(b, y);
      }
      if (r >= l) {
        // A deliberately simple pixel wordmark survives the actual world scale.
        // M and R have distinct silhouettes and a full dark column between them.
        const letters = ['1000101110', '1101101001', '1010101110', '1000101010', '1000101001'];
        const pixelWidth = 3;
        const pixelHeight = 3;
        const markWidth = letters[0].length * pixelWidth;
        const markHeight = letters.length * pixelHeight;
        const x = Math.round((l + r + 1 - markWidth) / 2);
        const y = Math.round((t + b + 1 - markHeight) / 2);
        ctx.fillStyle = '#20212a';
        ctx.fillRect(x - 1, y - 1, markWidth + 2, markHeight + 2);
        ctx.fillStyle = '#ffffff';
        letters.forEach((row, dy) => [...row].forEach((pixel, dx) => {
          if (pixel === '1') ctx.fillRect(x + dx * pixelWidth, y + dy * pixelHeight, pixelWidth, pixelHeight);
        }));
      }
    }
    const pixels = ctx.getImageData(0, 0, scratch.width, scratch.height).data;
    let left = scratch.width, top = scratch.height, right = 0, bottom = 0;
    for (let y = 0; y < scratch.height; y++) {
      for (let x = 0; x < scratch.width; x++) {
        if (pixels[(y * scratch.width + x) * 4 + 3] < 64) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    const width = right - left + 1, height = bottom - top + 1;
    const scale = 252 / height;
    // Keep the existing pose and silhouette, with a 2x backing texture so the
    // cap lettering retains its edges in loading screens and close views.
    const texture = scene.textures.createCanvas(key, 626, 626)!;
    texture.context.imageSmoothingEnabled = false;
    texture.context.drawImage(scratch, left, top, width, height,
      (156.5 - width * scale / 2) * 2, 78, width * scale * 2, 504);
    texture.refresh();
  });
}
