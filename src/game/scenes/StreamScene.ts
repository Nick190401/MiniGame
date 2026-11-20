import Phaser from 'phaser';
import { STREAM_ASSETS, isAssetLoaded, streamState, beginStream } from '../assets/AssetStream';

/**
 * Downloads the rest of the game's art and sound in the background, in the
 * order of STREAM_ASSETS, while the player is already in the world. It has
 * no display of its own and outlives world restarts, battles and death.
 */
export class StreamScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StreamScene' });
  }

  create(): void {
    this.scene.setVisible(false);
    const state = streamState(this) ?? beginStream(this);
    const load = this.load;
    // A few at a time, so files arrive close to their priority order.
    load.maxParallelDownloads = 4;
    for (const asset of STREAM_ASSETS) {
      if (isAssetLoaded(this, asset)) {
        state.settled.add(asset.key);
        continue;
      }
      if (asset.kind === 'image') load.image(asset.key, asset.url);
      else load.audio(asset.key, asset.url);
    }
    load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => state.settled.add(key));
    load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      state.settled.add(file.key);
      console.debug(`[stream] could not load ${file.src}`);
    });
    // A file that downloads but fails to decode (e.g. a missing file the host
    // answers with index.html) emits no per-file event: settle it here too.
    load.on(Phaser.Loader.Events.FILE_LOAD, (file: Phaser.Loader.File) => {
      const onProcessError = file.onProcessError;
      file.onProcessError = () => {
        state.settled.add(file.key);
        console.debug(`[stream] could not decode ${file.src}`);
        onProcessError.call(file);
      };
    });
    load.once(Phaser.Loader.Events.COMPLETE, () => {
      state.done = true;
      this.scene.stop();
    });
    load.start();
  }
}
