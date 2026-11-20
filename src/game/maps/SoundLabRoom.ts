import { ROOM_HEIGHT, ROOM_WIDTH, px } from './interiors/room';

/**
 * The Sound Lab interior: one painted room (1536 x 1024 px) and its layout,
 * measured on that image. Units are room-local world units, origin top-left.
 *
 * The hero always draws over the flat backdrop, so every tall object is
 * blocked over its whole painted extent: he can stand in front of or beside
 * the furniture, never behind it.
 */
export const SOUND_LAB_ROOM = {
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  /** Just inside the door, above the doormat, facing into the room. */
  spawn: { x: 153.6, y: 176 },
  door: {
    /** Standing here (the doormat and the floor just above it), E leaves the lab. */
    zone: px(680, 850, 856, 1024),
    /** Walking down past this line, onto the doormat, leaves as well. */
    stepOutY: 182,
    /** The key cap sits in the doorway, below the hero's feet. */
    label: { x: 153.6, y: 203, lift: -4 },
  },
  note: {
    /** The paper pinned to the music stand. */
    paper: px(620, 456, 670, 512),
    /**
     * Feet inside this rect (the floor in front of the stand, and beside it on
     * the right, where the hero at interior scale is stopped by the stand) can read it.
     */
    reach: px(578, 560, 740, 690),
    /** Over the paper's left half: clear of the hero's head below the stand and beside it. */
    label: { x: 119, y: 95, lift: 7 },
  },
  /** The light falling from the window, as painted: from the sill (x at topY) to the floor (x at bottomY). */
  shaft: { top: [34, 80], bottom: [94, 144], topY: 30, bottomY: 140 },
  walls: {
    back: px(0, 0, 1536, 256),
    left: px(0, 0, 32, 1024),
    right: px(1504, 0, 1536, 1024),
    nearLeft: px(0, 978, 724, 1024),
    nearRight: px(813, 978, 1536, 1024),
  },
  furniture: {
    /** Mixing console and monitors; the dust sheet hangs to its right edge. */
    console: px(205, 256, 692, 470),
    /** Tape machine, with the dead-end corner above it closed off. */
    tapeMachine: px(32, 256, 205, 632),
    chair: px(385, 437, 502, 580),
    musicStand: px(603, 452, 690, 610),
    boxes: px(32, 762, 214, 978),
    /** Vocal booth: glass front, mic inside; its door is decoration. */
    booth: px(1010, 256, 1504, 522),
    sofa: px(1328, 536, 1504, 866),
    guitarCase: px(1232, 866, 1504, 978),
  },
  rug: px(494, 625, 1160, 882),
  doormat: px(698, 898, 840, 968),
  window: px(165, 52, 405, 155),
} as const;
