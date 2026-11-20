import type { InteriorRoomId, RoomArt } from '../../assets/InteriorArt';

/**
 * The shape of a building interior: one painted room (1536 x 1024 px) and its
 * layout measured on that painting. Pure data, no Phaser: InteriorScene plays
 * it. Units are room-local world units, origin top-left.
 *
 * The hero always draws over the flat painting, so every tall object is
 * blocked over its whole painted extent: he can stand in front of or beside
 * the furniture, never behind it.
 */

/** The rooms are painted at 5 px per world unit (PAINTED_TEXEL). */
export const ART_PX = 5;
export const ROOM_WIDTH = 1536 / ART_PX;
export const ROOM_HEIGHT = 1024 / ART_PX;

/**
 * Indoors the hero is drawn at this multiple of his overworld size: sprite,
 * shadow and body alike (InteriorScene). His body is then about 70 x 44
 * painted px with its bottom edge at his feet, so every walkway to a reach
 * zone and to the exit must be at least that wide.
 */
export const INTERIOR_HERO_SCALE = 1.5;

export interface RoomRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomPoint {
  x: number;
  y: number;
}

/** A rectangle measured on the painting (image pixels, corners), in room units. */
export const px = (x1: number, y1: number, x2: number, y2: number): RoomRect => ({
  x: x1 / ART_PX,
  y: y1 / ART_PX,
  w: (x2 - x1) / ART_PX,
  h: (y2 - y1) / ART_PX,
});

/** A point measured on the painting, in room units. */
export const pt = (x: number, y: number): RoomPoint => ({ x: x / ART_PX, y: y / ART_PX });

/** What the hero has done so far; every field given must match. */
export interface Condition {
  bossDefeated?: boolean;
  gateOpen?: boolean;
  bonusSongUnlocked?: boolean;
  /** Sound fragments found, exactly. */
  fragments?: number;
  /** One-time dialogues already seen (seenDialogs keys), e.g. 'kian-met'. */
  seen?: readonly string[];
  /** Sound effects can be heard (not muted, volume above 0). */
  sfxAudible?: boolean;
  /** The room's record player is playing. */
  recordPlaying?: boolean;
}

type HookEffect =
  /**
   * A sound cue (AudioLibrary key). One that has not streamed in yet is skipped; the text carries the joke.
   * `repeat` plays it that many more times, `intervalMs` apart, each at `fade` times the volume of the one before.
   */
  | { type: 'sfx'; key: string; volume?: number; rate?: number; delayMs?: number; repeat?: number; intervalMs?: number; fade?: number }
  /** A soft light on the painting: a pulse in place, or a ring that spreads, over `ms` (about a second by default). */
  | { type: 'glow'; at: RoomPoint; tint: number; size: number; mode: 'pulse' | 'ring'; ms?: number }
  /** A few motes rising from, or falling around, a point. */
  | { type: 'motes'; at: RoomPoint; tint: number; count: number; dir: 'rise' | 'fall' }
  /** The hero, tiny and tinted, on a screen while the lines are read. */
  | { type: 'cameo'; screen: RoomRect; tint: number }
  /** Lowers or lifts the needle of the room's record player; notes rise from the platter while it plays. */
  | { type: 'record'; play: boolean; platter: RoomPoint };

export type Hook = HookEffect & {
  /** Goes off as this line of its own variant shows (0-based); without it, as the lines open. */
  line?: number;
};

/** One response to a use: the lines read out and what happens meanwhile. */
export interface Variant {
  when?: Condition;
  /** Shown one at a time; `{playerName}` is replaced. */
  lines: readonly string[];
  hooks?: readonly Hook[];
  /** Adds its lines after the chosen variant instead of competing with it. */
  append?: boolean;
}

/**
 * How a use picks its step. Uses are counted per visit, in memory only.
 * - state: always step 0.
 * - cycle: the next step on every use, round and round.
 * - counter: the last step whose threshold the use count has reached (1-based).
 * - random: a step drawn with these chances.
 * - rapid: step 1 once `uses` uses land within `windowMs`, else step 0.
 */
export type Selector =
  | { kind: 'state' }
  | { kind: 'cycle' }
  | { kind: 'counter'; at: readonly number[] }
  | { kind: 'random'; chances: readonly number[] }
  | { kind: 'rapid'; uses: number; windowMs: number };

/** A note held up in the reading view (components/NoteReader.tsx). */
export interface NoteSpec {
  title: string;
  lines: readonly string[];
  signature: string;
  /** Added later, in other ink, once its condition holds. */
  postscript?: { when: Condition; text: string };
}

export interface Interactable {
  id: string;
  /** The painted object; its key cap floats over it. */
  object: RoomRect;
  /** The hero's feet inside this rect can use it. */
  reach: RoomRect;
  /** The action word on the key cap. */
  verb: 'Look' | 'Use' | 'Listen' | 'Read';
  /** Places the key cap explicitly (x, y, lift as InteractLabel), else over the object, raised clear of the hero's head where he stands. */
  label?: { x: number; y: number; lift: number };
  selector?: Selector;
  /** Each step is a list of variants: the first matching non-append variant, then every matching append variant. */
  steps?: readonly (readonly Variant[])[];
  /** Opens the reading view instead of lines. */
  note?: NoteSpec;
}

/** Uses of several interactables in this order, within the window, add the variant to the last one. */
export interface Sequence {
  order: readonly string[];
  windowMs: number;
  variant: Variant;
}

/** Standing still here this long plays the variant, once per visit. */
export interface IdleTrigger {
  reach: RoomRect;
  ms: number;
  variant: Variant;
}

/** Walking into this rect sets the hooks off, without lines; again only after he has left it. */
export interface ApproachTrigger {
  reach: RoomRect;
  when?: Condition;
  hooks: readonly Extract<Hook, { type: 'sfx' | 'glow' | 'motes' }>[];
}

/**
 * Light and air that stay while the hero is inside. Static when motion is reduced.
 * A flicker wavers quickly like firelight, or glides from level to level every `periodMs` (water light);
 * with `blink` it now and then cuts out twice in quick succession, like tired neon.
 */
export type Ambient =
  | { type: 'glow'; at: RoomPoint; tint: number; size: number; alpha: number; pulseMs?: number; when?: Condition }
  | { type: 'flicker'; at: RoomPoint; tint: number; size: number; alpha: number; periodMs?: number; blink?: boolean; when?: Condition }
  | { type: 'motes'; area: RoomRect; tint: number; count: number; drift: 'rise' | 'fall' | 'hang'; when?: Condition };

export interface InteriorRoom {
  id: InteriorRoomId;
  art: RoomArt;
  /** Where the room's front door is in the overworld. */
  door: {
    /** The building (its OVERWORLD_LANDMARKS texture). */
    landmark: string;
    /** The door's middle, in units right of the building's middle. */
    dx: number;
    /** How far below the building's foot line the hero steps out. */
    exitDy: number;
  };
  /** The entry notice: zone, name and one line. */
  zone: string;
  title: string;
  detail: string;
  accent: string;
  width: number;
  height: number;
  /** Just inside the door, above the doormat, facing into the room. */
  spawn: RoomPoint;
  exit: {
    /** Standing here (the doormat and the floor just above it), E leaves. */
    zone: RoomRect;
    /** Walking down past this line, onto the doormat, leaves as well. */
    stepOutY: number;
    /** The key cap sits in the doorway, below the hero's feet. */
    label: { x: number; y: number; lift: number };
  };
  /** The dark wall tops round the room; the near wall leaves the doorway open. `back` ends where the floor starts. */
  walls: { back: RoomRect; left: RoomRect; right: RoomRect; nearLeft: RoomRect; nearRight: RoomRect };
  /** Everything else the hero collides with. */
  furniture: readonly RoomRect[];
  interactables: readonly Interactable[];
  sequences?: readonly Sequence[];
  idle?: readonly IdleTrigger[];
  approach?: readonly ApproachTrigger[];
  ambient?: readonly Ambient[];
  /** Camera vignette strength (Phaser's Vignette FX). */
  vignette?: number;
  /** World music volume inside, as a share of the outside volume (the walls muffle it). */
  musicDuck?: number;
  /** Colours of the stand-in painted in code while the painting is missing (the Sound Lab paints its own). */
  standIn?: { floor: number; wall: number; furniture: number };
}

/** Everything the hero collides with inside. */
export const roomBlockers = (room: InteriorRoom): RoomRect[] => [...Object.values(room.walls), ...room.furniture];

/**
 * The spawn and the way out, measured from the painted door gap and doormat
 * (pixel corners) the way the Sound Lab's were: spawn 18 px above the mat,
 * the step-out line 12 px onto it.
 */
export function doorway(gap: readonly number[], mat: readonly number[]): Pick<InteriorRoom, 'spawn' | 'exit'> {
  const x = Math.round((gap[0] + gap[2]) / 2) / ART_PX;
  return {
    spawn: { x, y: (mat[1] - 18) / ART_PX },
    exit: {
      zone: px(mat[0] - 18, mat[1] - 48, mat[2] + 16, 1024),
      stepOutY: (mat[1] + 12) / ART_PX,
      label: { x, y: ROOM_HEIGHT - 1.8, lift: -4 },
    },
  };
}
