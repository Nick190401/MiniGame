export interface TileType {
  id: number;
  name: string;
  textureKey: string;
  passable: boolean;
  category: string;
  color: string; // fallback hex color for palette swatch
}

export const TILE_TYPES: TileType[] = [
  // Terrain
  { id: 0,  name: 'Grass',          textureKey: 'tile-grass',          passable: true,  category: 'Terrain',  color: '#78b858' },
  { id: 1,  name: 'Path',           textureKey: 'tile-path',           passable: true,  category: 'Terrain',  color: '#d0a868' },
  { id: 2,  name: 'Wall / Cliff',   textureKey: 'tile-wall',           passable: false, category: 'Terrain',  color: '#887058' },
  { id: 7,  name: 'Water',          textureKey: 'tile-water',          passable: false, category: 'Terrain',  color: '#3878f0' },
  // Nature
  { id: 8,  name: 'Tree',           textureKey: 'tile-tree-top',       passable: false, category: 'Nature',   color: '#387828' },
  { id: 9,  name: 'Tree Trunk',     textureKey: 'tile-tree-trunk',     passable: true,  category: 'Nature',   color: '#6a4028' },
  { id: 10, name: 'Tall Grass',     textureKey: 'tile-tall-grass',     passable: true,  category: 'Nature',   color: '#347020' },
  { id: 14, name: 'Flower',         textureKey: 'tile-flower',         passable: true,  category: 'Nature',   color: '#ff4488' },
  // Building
  { id: 11, name: 'Bldg Wall',      textureKey: 'tile-building-wall',  passable: false, category: 'Building', color: '#f0dcc0' },
  { id: 22, name: 'Wall + Window',  textureKey: 'tile-bldg-wall-win',  passable: false, category: 'Building', color: '#e8d0b0' },
  { id: 18, name: 'Stone Wall',     textureKey: 'tile-bldg-stone',     passable: false, category: 'Building', color: '#c0c8d0' },
  { id: 23, name: 'Stone + Window', textureKey: 'tile-bldg-stone-win', passable: false, category: 'Building', color: '#b0b8c0' },
  { id: 12, name: 'Roof (Brown)',   textureKey: 'tile-building-roof',  passable: false, category: 'Building', color: '#c85838' },
  { id: 19, name: 'Roof (Blue)',    textureKey: 'tile-roof-blue',      passable: false, category: 'Building', color: '#3868b0' },
  { id: 20, name: 'Roof (Gray)',    textureKey: 'tile-roof-gray',      passable: false, category: 'Building', color: '#586878' },
  { id: 13, name: 'Door (Wood)',    textureKey: 'tile-building-door',  passable: true,  category: 'Building', color: '#884828' },
  { id: 21, name: 'Door (Iron)',    textureKey: 'tile-door-iron',      passable: true,  category: 'Building', color: '#505860' },
  // Cave
  { id: 15, name: 'Cave Floor',    textureKey: 'tile-cave-floor',     passable: true,  category: 'Cave',     color: '#1e1630' },
  { id: 16, name: 'Cave Wall',     textureKey: 'tile-cave-wall',      passable: false, category: 'Cave',     color: '#2c2240' },
  { id: 17, name: 'Crystal',       textureKey: 'tile-crystal',        passable: true,  category: 'Cave',     color: '#00ccaa' },
  { id: 24, name: 'Pillar',        textureKey: 'tile-pillar',         passable: false, category: 'Cave',     color: '#241d38' },
  { id: 25, name: 'Wall Rune',     textureKey: 'tile-wall-rune',      passable: false, category: 'Cave',     color: '#880000' },
  { id: 26, name: 'Skull',         textureKey: 'tile-skull',          passable: true,  category: 'Cave',     color: '#c8c0b0' },
  { id: 27, name: 'Stalactite',    textureKey: 'tile-stalactite',     passable: true,  category: 'Cave',     color: '#2e2548' },
  { id: 29, name: 'Cave Pool',     textureKey: 'tile-cave-water',     passable: false, category: 'Cave',     color: '#163f49' },
  { id: 30, name: 'Cave Stairs',   textureKey: 'tile-cave-stairs',    passable: true,  category: 'Cave',     color: '#52645f' },
  { id: 31, name: 'Cave Boulder',  textureKey: 'tile-cave-boulder',   passable: false, category: 'Cave',     color: '#3a4b49' },
  // Decor
  { id: 6,  name: 'Sign',          textureKey: 'tile-sign',           passable: true,  category: 'Decor',    color: '#8b6020' },
  // Special
  { id: 3,  name: 'Arena Floor',   textureKey: 'tile-arena',          passable: true,  category: 'Special',  color: '#181828' },
  { id: 4,  name: 'Gate',          textureKey: 'tile-gate',           passable: false, category: 'Special',  color: '#cc9900' },
  { id: 28, name: 'Landmark Footprint', textureKey: 'tile-grass',     passable: false, category: 'Special',  color: '#5e7848' },
];

export const TILE_TYPE_MAP = new Map<number, TileType>(TILE_TYPES.map(t => [t.id, t]));

export const TILE_TEXTURE: Record<number, string> = Object.fromEntries(
  TILE_TYPES.map(t => [t.id, t.textureKey])
);

export const TILE_CATEGORIES = ['Terrain', 'Nature', 'Building', 'Cave', 'Decor', 'Special'] as const;
