import type Phaser from 'phaser';
import { INTERIOR_ROOM_ART, type InteriorRoomId } from './InteriorArt';
import { registerPaintedTexture } from '../art/paintedArt';

/**
 * Room paintings, fetched on demand: when the hero nears a door and, at the
 * latest, when he walks in. They never load with the world. A room is freed
 * once the hero walks away from its door, and at most MAX_RESIDENT_ROOMS rooms
 * stay in memory (decoded downloads and room textures alike), so a walk
 * through every building cannot outgrow the memory budget iOS allows a page.
 *
 * Downloads go through a plain image element rather than a scene's loader:
 * a sleeping scene's loader stalls, and the texture manager is shared.
 */

const MAX_RESIDENT_ROOMS = 2;

interface Download {
  state: 'loading' | 'ready' | 'failed';
  image: HTMLImageElement;
}

const downloads = new Map<InteriorRoomId, Download>();
/** Rooms whose texture holds the painting (not the stand-in painted in code). */
const painted = new Set<InteriorRoomId>();
/** Least recently wanted first. */
let recent: InteriorRoomId[] = [];

const hasPainting = (textures: Phaser.Textures.TextureManager, id: InteriorRoomId) =>
  painted.has(id) && textures.exists(INTERIOR_ROOM_ART[id].key);

const isResident = (textures: Phaser.Textures.TextureManager, id: InteriorRoomId) =>
  downloads.has(id) || textures.exists(INTERIOR_ROOM_ART[id].key);

function evict(textures: Phaser.Textures.TextureManager, id: InteriorRoomId): void {
  const download = downloads.get(id);
  if (download) {
    download.image.onload = null;
    download.image.onerror = null;
    // Lets the browser drop the decoded pixels; a pending request is cancelled.
    download.image.removeAttribute('src');
    downloads.delete(id);
  }
  const { key, source } = INTERIOR_ROOM_ART[id];
  if (textures.exists(key)) textures.remove(key);
  if (textures.exists(source)) textures.remove(source);
  painted.delete(id);
}

/** Marks the room as the one wanted most recently and frees the oldest others beyond the budget. */
function want(textures: Phaser.Textures.TextureManager, id: InteriorRoomId): void {
  recent = [...recent.filter(other => other !== id), id];
  const resident = recent.filter(other => isResident(textures, other));
  for (const other of resident.slice(0, Math.max(0, resident.length - MAX_RESIDENT_ROOMS))) {
    if (other !== id) evict(textures, other);
  }
}

/** Starts fetching the room's painting unless it is here or on its way. */
export function prefetchRoomArt(textures: Phaser.Textures.TextureManager, id: InteriorRoomId): void {
  want(textures, id);
  if (downloads.has(id) || hasPainting(textures, id)) return;
  const image = new Image();
  image.decoding = 'async';
  const download: Download = { state: 'loading', image };
  // Evicted meanwhile: the handlers were removed, so a late arrival adds nothing.
  image.onload = () => { download.state = 'ready'; };
  image.onerror = () => {
    download.state = 'failed';
    console.debug(`[interior] could not load ${INTERIOR_ROOM_ART[id].url}`);
  };
  downloads.set(id, download);
  image.src = INTERIOR_ROOM_ART[id].url;
}

/** Frees a room the hero has walked away from: its download, painting and stand-in alike. */
export function releaseRoomArt(textures: Phaser.Textures.TextureManager, id: InteriorRoomId): void {
  recent = recent.filter(other => other !== id);
  evict(textures, id);
}

/** True once the painting is here, or its download has failed (the stand-in takes over). */
export function isRoomArtSettled(textures: Phaser.Textures.TextureManager, id: InteriorRoomId): boolean {
  return hasPainting(textures, id) || downloads.get(id)?.state !== 'loading';
}

/**
 * Turns a finished download into the room's texture, replacing a stand-in
 * painted on an earlier visit. A failed download is forgotten, so the next
 * visit tries again.
 */
export function adoptRoomArt(scene: Phaser.Scene, id: InteriorRoomId): void {
  want(scene.textures, id);
  const download = downloads.get(id);
  if (!download || download.state === 'loading') return;
  downloads.delete(id);
  if (download.state === 'failed') return;
  const { key, source } = INTERIOR_ROOM_ART[id];
  if (scene.textures.exists(source)) scene.textures.remove(source);
  scene.textures.addImage(source, download.image);
  if (registerPaintedTexture(scene, source, key, { replace: true })) painted.add(id);
}
