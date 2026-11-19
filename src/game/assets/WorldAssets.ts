/**
 * Runtime artwork shared by the game loader and the production build.
 *
 * All world, character, enemy and arena art is painted at load time (see
 * src/game/art), so no bitmap files are loaded or shipped for it.
 */
export const WORLD_IMAGE_ASSETS: ReadonlyArray<{ key: string; url: string }> = [];

export const WORLD_TILESET_ASSETS: ReadonlyArray<{
  key: string;
  url: string;
  frameConfig: { frameWidth: number; frameHeight: number };
}> = [];
