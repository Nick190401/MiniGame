/**
 * Hand-painted replacements for world textures that are otherwise painted in
 * code (see src/game/art/paintedArt.ts). Each file is stored at PAINTED_TEXEL
 * pixels per world unit, the densest TEXEL.
 */
export const PAINTED_TEXEL = 5;

export interface PaintedArt {
  key: string;
  url: string;
}

const art = (key: string): PaintedArt => ({ key, url: `assets/world/${key}.webp` });

export const PAINTED_WORLD_ART: readonly PaintedArt[] = [
  art('landmark-cottage'),
  art('landmark-professor-lab'),
  art('landmark-clinic'),
  art('landmark-inn'),
  art('landmark-workshop'),
  art('landmark-riverside-hut'),
  art('landmark-archive-shrine'),
  art('landmark-ranger-hut'),
  art('landmark-junction-inn'),
  art('landmark-junction-clinic'),
  art('landmark-junction-workshop'),
  art('landmark-guard-post'),
  art('landmark-signal-station'),
  art('landmark-cave-mouth'),
  art('hd-tree-broadleaf-0'),
  art('hd-tree-broadleaf-1'),
  art('hd-tree-broadleaf-2'),
  art('hd-tree-broadleaf-3'),
  art('hd-tree-conifer-0'),
  art('hd-tree-conifer-1'),
  art('hd-bush-0'),
  art('hd-bush-1'),
  art('hd-bush-2'),
  art('hd-reeds'),
  art('hd-rock-0'),
  art('hd-rock-1'),
  art('hd-rock-2'),
  art('hd-ledge-0'),
  art('hd-ledge-1'),
  art('hd-flowers-0'),
  art('hd-flowers-1'),
  art('hd-flowers-2'),
  art('hd-lily-0'),
  art('hd-bridge-deck'),
  art('hd-bridge-post'),
  art('hd-sign'),
  art('hd-gate-frame'),
  art('hd-gate-panel-left'),
  art('hd-gate-panel-right'),
  art('landmark-universe-portal'),
  art('hd-cave-crystal'),
  art('hd-cave-crystal-purified'),
  art('hd-cave-pillar'),
  art('hd-cave-pillar-purified'),
  art('hd-cave-stalagmite'),
  art('hd-cave-stalagmite-purified'),
  art('hd-cave-boulder'),
  art('hd-cave-boulder-purified'),
  art('hd-cave-bones'),
  art('hd-cave-brazier'),
  art('hd-ledge-2'),
  art('hd-ledge-3'),
];
