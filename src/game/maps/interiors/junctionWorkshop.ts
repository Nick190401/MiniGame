import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { ROOM_HEIGHT, ROOM_WIDTH, doorway, pt, px, type InteriorRoom } from './room';

/** The cyan neon waveform over the pegboard. */
const NEON = pt(810, 78);
/** The cracked gauge of the 'unfixable' box. */
const GAUGE = pt(1183, 143);

/** REPAIR: Neon Junction's electronics and amplifier repair shop, corrugated steel and copper wire. */
export const JUNCTION_WORKSHOP: InteriorRoom = {
  id: 'junction-workshop',
  art: INTERIOR_ROOM_ART['junction-workshop'],
  // The roller shutter sits right of the building's middle.
  door: { landmark: 'landmark-junction-workshop', dx: 8, exitDy: 24 },
  zone: 'Neon Junction',
  title: 'REPAIR',
  detail: 'Radios, amps and relay parts, all waiting their turn.',
  accent: '#7ff0ff',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([704, 989, 826, 1024], [687, 934, 840, 989]),
  walls: {
    back: px(0, 0, 1536, 390),
    left: px(0, 0, 24, 1024),
    right: px(1510, 0, 1536, 1024),
    nearLeft: px(0, 989, 704, 1024),
    nearRight: px(826, 989, 1536, 1024),
  },
  furniture: [
    px(24, 108, 360, 426), // amplifier tower
    px(465, 252, 1187, 490), // long workbench
    px(683, 386, 777, 520), // shop stool
    px(1283, 85, 1510, 600), // parts racks
    px(24, 476, 477, 714), // service counter
    px(24, 710, 257, 960), // cable spool
    px(1260, 693, 1497, 954), // wire bin of broken radios
  ],
  interactables: [
    {
      id: 'amp-tower',
      object: px(52, 110, 358, 424),
      // The floor below the tower is closed off by the counter and the bench.
      reach: px(479, 530, 640, 640),
      verb: 'Use',
      // On the stack, below the HUD card that covers the room's top-left corner.
      label: { x: 41, y: 52, lift: 7 },
      // One kick per visit; after that the hero knows better.
      selector: { kind: 'counter', at: [1, 2] },
      steps: [
        [{
          lines: [
            'A tower of mismatched amplifiers.',
            'A sticky note on top says: KICK ME.',
            'You give it a gentle kick.',
            'It roars to life for exactly one second, then dies.',
            'Somewhere outside, a dog barks.',
            'You decide not to do that again.',
          ],
          hooks: [
            { type: 'sfx', key: 'sfx-enemy-distortion', volume: 0.5, line: 3 },
            { type: 'glow', at: NEON, tint: 0x7ff0ff, size: 80, mode: 'pulse', ms: 450, line: 3 },
            { type: 'glow', at: pt(130, 340), tint: 0xffb060, size: 46, mode: 'pulse', ms: 1000, line: 3 },
          ],
        }],
        [{ lines: ['The note still says KICK ME.', 'You have learned your lesson. Mostly.'] }],
      ],
    },
    {
      id: 'unfixable',
      object: px(1075, 105, 1218, 180),
      // The slot between the bench and the racks, and the floor below its mouth.
      reach: px(1190, 392, 1282, 630),
      verb: 'Look',
      steps: [[
        {
          when: { bossDefeated: true },
          lines: [
            'The little grey box has gone quiet.',
            'Properly quiet. The good kind.',
            'Someone has moved the UNFIXABLE label to the bin.',
          ],
        },
        {
          lines: [
            'A shelf marked UNFIXABLE.',
            'On it, a small grey box with a cracked dial.',
            "It's humming. Unfixable things shouldn't hum.",
          ],
          hooks: [{ type: 'glow', at: GAUGE, tint: 0xb8ffd0, size: 22, mode: 'pulse' }],
        },
      ]],
    },
    {
      id: 'radio',
      object: px(285, 478, 385, 555),
      reach: px(257, 716, 477, 850),
      verb: 'Listen',
      steps: [[
        {
          when: { bossDefeated: true },
          lines: [
            'The radio picks up a song from the Junction plaza.',
            'Somebody out there is playing it very, very loud.',
          ],
          hooks: [{ type: 'motes', at: pt(335, 500), tint: 0xffd27a, count: 6, dir: 'rise' }],
        },
        {
          lines: ['A radio tuned to nothing. Just a thin hiss.'],
          hooks: [{ type: 'sfx', key: 'sfx-enemy-white-noise', volume: 0.25 }],
        },
      ]],
    },
    {
      id: 'oscilloscope',
      object: px(1042, 258, 1170, 355),
      reach: px(1010, 530, 1190, 630),
      verb: 'Look',
      steps: [[
        {
          when: { bossDefeated: true },
          lines: ['The green line has a tiny bump in it now.', "A twelfth strip of tape: 'NOT FLAT!'"],
          hooks: [{ type: 'glow', at: pt(1100, 302), tint: 0x7dff9a, size: 30, mode: 'pulse' }],
        },
        {
          lines: [
            'A flat green line.',
            "Under the screen, a strip of tape: 'still flat'.",
            'There are eleven strips of tape.',
          ],
        },
      ]],
    },
  ],
  ambient: [
    // The neon tube hums and wavers.
    { type: 'flicker', at: NEON, tint: 0x7ff0ff, size: 70, alpha: 0.3 },
    { type: 'glow', at: pt(735, 262), tint: 0xffc870, size: 40, alpha: 0.26 },
    // The 'unfixable' box hums until the silence lifts.
    { type: 'flicker', at: GAUGE, tint: 0xb8ffd0, size: 16, alpha: 0.2, when: { bossDefeated: false } },
  ],
  standIn: { floor: 0x6a6258, wall: 0x46546a, furniture: 0x50555c },
};
