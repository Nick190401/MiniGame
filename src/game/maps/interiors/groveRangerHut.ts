import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { ROOM_HEIGHT, ROOM_WIDTH, doorway, pt, px, type InteriorRoom } from './room';

/**
 * The Grove Ranger's Cabin, a birdsong survey post. The painting is mirrored
 * (the stove stands under the outside chimney, back right), and so is every
 * rect here: x -> 1536 - x on the original measurements.
 */
export const GROVE_RANGER_HUT: InteriorRoom = {
  id: 'grove-ranger-hut',
  art: INTERIOR_ROOM_ART['grove-ranger-hut'],
  // A one-tile doorstep: the hut above, the ledge wall one row below.
  door: { landmark: 'landmark-ranger-hut', dx: 8, exitDy: 10 },
  zone: 'Whisper Grove',
  title: "Grove Ranger's Cabin",
  detail: 'Woodsmoke, feathers and a survey of silent mornings.',
  accent: '#ffa257',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([710, 980, 827, 1024], [689, 904, 847, 978]),
  walls: {
    back: px(0, 0, 1536, 330),
    left: px(0, 0, 28, 1024),
    right: px(1514, 0, 1536, 1024),
    nearLeft: px(0, 980, 710, 1024),
    nearRight: px(827, 980, 1536, 1024),
  },
  furniture: [
    px(1204, 22, 1514, 415), // wood stove and woodbox
    px(651, 243, 1071, 438), // survey desk
    px(792, 322, 908, 494), // desk chair
    px(244, 92, 588, 442), // bunk bed
    px(28, 68, 226, 340), // whistle and nest shelf
    px(28, 393, 216, 642), // coat rack
    px(1379, 405, 1514, 682), // snowshoes
    px(1332, 736, 1514, 957), // lost-and-found crate
  ],
  interactables: [
    {
      id: 'bunk',
      // The pine carved into the upper rail: the hero, standing at the bunk, hides the lower one.
      object: px(361, 210, 496, 245),
      reach: px(346, 444, 586, 540),
      verb: 'Look',
      steps: [[
        {
          lines: ['Under the carved pine, cut smaller and deeper:', 'K.V. and Q., a lopsided music note between them.'],
          hooks: [{ type: 'glow', at: pt(428, 228), tint: 0xffd9a0, size: 18, mode: 'pulse' }],
        },
        {
          when: { seen: ['kian-met', 'quincy-met'] },
          lines: ['Kian and Quincy? They must have camped here as kids.', "Whoever carved the note couldn't stop laughing."],
          append: true,
        },
      ]],
    },
    {
      id: 'crate',
      object: px(1334, 738, 1498, 955),
      reach: px(1246, 760, 1330, 955),
      verb: 'Look',
      // Nudged right of the crate's middle, clear of the hero standing beside it.
      label: { x: 1432 / 5, y: 738 / 5 + 8.8, lift: 7 },
      // One find per look, then only pine needles until the next visit.
      selector: { kind: 'counter', at: [1, 2, 3, 4, 5] },
      steps: [
        [{ lines: ['A kazoo. Slightly chewed.'] }],
        [{ lines: ['One earring, shaped like a little music note.'] }],
        [{ lines: ["A child's mitten. Just the left one."] }],
        [{ lines: ['A crumpled map of the Void Cave.', "Someone has circled the Core and written: DON'T."] }],
        [{ lines: ['Mostly pine needles now.'] }],
      ],
    },
    {
      id: 'notebook',
      object: px(794, 248, 908, 310),
      // Either side of the chair.
      reach: px(656, 440, 1066, 550),
      verb: 'Read',
      steps: [[
        {
          when: { bossDefeated: true },
          lines: ['The newest page has one word, written very large:', "'EVERYONE.'"],
        },
        {
          lines: ["The ranger's birdsong survey.", 'Every page says the same:', "'Dawn chorus: none.' 'Dusk chorus: none.'"],
        },
      ]],
    },
    {
      id: 'whistles',
      object: px(46, 75, 211, 180),
      // Below the bunk's end: the strip under the shelf is too narrow to walk into.
      reach: px(218, 444, 336, 540),
      verb: 'Use',
      // On the shelf, below the HUD card that covers the room's top-left corner on a desktop screen.
      label: { x: 25.7, y: 45, lift: 7 },
      steps: [[
        {
          lines: ['Carved whistles, one for every bird in the grove.', 'You blow the smallest one.', 'Pip!'],
          hooks: [{ type: 'sfx', key: 'sfx-ui-click', rate: 2, line: 2 }],
        },
        { when: { bossDefeated: true }, lines: ['From somewhere outside, a real bird answers.'], append: true },
      ]],
    },
  ],
  ambient: [
    { type: 'flicker', at: pt(1278, 304), tint: 0xff8a3a, size: 26, alpha: 0.45 },
    { type: 'glow', at: pt(1274, 430), tint: 0xff9a4a, size: 50, alpha: 0.18, pulseMs: 2200 },
    { type: 'motes', area: px(260, 360, 1300, 900), tint: 0xe8d8a8, count: 12, drift: 'hang' },
  ],
  vignette: 0.3,
  // Thick round logs muffle the grove.
  musicDuck: 0.22,
  standIn: { floor: 0x5e4628, wall: 0x403417, furniture: 0x47341a },
};
