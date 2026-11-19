import Phaser from 'phaser';

const BAND = 128;
const MARGIN = 200;

type Cullable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible & { y: number };

/**
 * The world holds a few thousand static props. Phaser renders every visible
 * object each frame, so props in horizontal bands far from the camera are
 * hidden until the camera comes near again.
 */
export class WorldCulling {
  private readonly bands = new Map<number, Cullable[]>();
  private shownFrom = Number.NaN;
  private shownTo = Number.NaN;

  constructor(private readonly scene: Phaser.Scene) {}

  track(object: Cullable): void {
    const band = Math.floor(object.y / BAND);
    let list = this.bands.get(band);
    if (!list) { list = []; this.bands.set(band, list); }
    list.push(object);
  }

  start(): void {
    this.bands.forEach(list => list.forEach(object => object.setVisible(false)));
    this.scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.update, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.update, this);
      this.bands.clear();
    });
  }

  private update(): void {
    const view = this.scene.cameras.main.worldView;
    const from = Math.floor((view.y - MARGIN) / BAND);
    const to = Math.floor((view.bottom + MARGIN) / BAND);
    if (from === this.shownFrom && to === this.shownTo) return;
    const wasFrom = this.shownFrom, wasTo = this.shownTo;
    this.shownFrom = from;
    this.shownTo = to;
    const setBand = (band: number, visible: boolean) => {
      this.bands.get(band)?.forEach(object => { if (object.active) object.setVisible(visible); });
    };
    if (!Number.isNaN(wasFrom)) {
      for (let band = wasFrom; band <= wasTo; band++) if (band < from || band > to) setBand(band, false);
    }
    for (let band = from; band <= to; band++) {
      if (Number.isNaN(wasFrom) || band < wasFrom || band > wasTo) setBand(band, true);
    }
  }
}
