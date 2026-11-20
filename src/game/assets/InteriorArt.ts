/**
 * Painted art for building interiors. Plain data with no Phaser import, so
 * the asset manifests and the React overlays can use it without the engine.
 * The URLs stay string literals: the production build ships every literal
 * asset path it finds in src (scripts/runtimeAssets.ts).
 *
 * Room images never load with the world: a room's image is fetched when the
 * hero nears its door (see InteriorStream.ts).
 */

export type InteriorRoomId =
  | 'sound-lab'
  | 'echo-cottage'
  | 'echo-clinic'
  | 'echo-inn'
  | 'echo-workshop'
  | 'brook-riverside-hut'
  | 'junction-signal-station'
  | 'junction-inn'
  | 'junction-clinic'
  | 'junction-workshop'
  | 'junction-guard-post'
  | 'grove-archive-shrine'
  | 'grove-ranger-hut';

export interface RoomArt {
  /** The texture the room is drawn with, at the world's TEXEL. */
  key: string;
  /** The downloaded file's own key; it is resampled into `key` on entry. */
  source: string;
  url: string;
}

/** The Sound Lab room, painted at PAINTED_TEXEL (5 px per world unit). */
export const SOUND_LAB_ROOM_ART: RoomArt = {
  key: 'soundlab-room',
  source: 'soundlab-room-painted',
  url: 'assets/interiors/sound-lab/room.webp',
};

/** The blank note pinned in the Sound Lab, held up close by the reading view (a DOM image, not a texture). */
export const SOUND_LAB_NOTE_URL = 'assets/interiors/sound-lab/note.webp';

const room = (id: Exclude<InteriorRoomId, 'sound-lab'>, url: string): RoomArt => ({
  key: `interior-${id}`,
  source: `interior-${id}-painted`,
  url,
});

/** Every room's painting, each 1536 x 1024 px at PAINTED_TEXEL. */
export const INTERIOR_ROOM_ART: Readonly<Record<InteriorRoomId, RoomArt>> = {
  'sound-lab': SOUND_LAB_ROOM_ART,
  'echo-cottage': room('echo-cottage', 'assets/interiors/echo-cottage/room.webp'),
  'echo-clinic': room('echo-clinic', 'assets/interiors/echo-clinic/room.webp'),
  'echo-inn': room('echo-inn', 'assets/interiors/echo-inn/room.webp'),
  'echo-workshop': room('echo-workshop', 'assets/interiors/echo-workshop/room.webp'),
  'brook-riverside-hut': room('brook-riverside-hut', 'assets/interiors/brook-riverside-hut/room.webp'),
  'junction-signal-station': room('junction-signal-station', 'assets/interiors/junction-signal-station/room.webp'),
  'junction-inn': room('junction-inn', 'assets/interiors/junction-inn/room.webp'),
  'junction-clinic': room('junction-clinic', 'assets/interiors/junction-clinic/room.webp'),
  'junction-workshop': room('junction-workshop', 'assets/interiors/junction-workshop/room.webp'),
  'junction-guard-post': room('junction-guard-post', 'assets/interiors/junction-guard-post/room.webp'),
  'grove-archive-shrine': room('grove-archive-shrine', 'assets/interiors/grove-archive-shrine/room.webp'),
  'grove-ranger-hut': room('grove-ranger-hut', 'assets/interiors/grove-ranger-hut/room.webp'),
};
