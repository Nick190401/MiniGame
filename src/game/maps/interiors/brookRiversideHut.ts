import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { ROOM_HEIGHT, ROOM_WIDTH, doorway, pt, px, type InteriorRoom } from './room';

const WATER = 0x3fd8c0;

/** The Brook Listener's Hut: a fisher who catches the lost sounds drifting down the brook. */
export const BROOK_RIVERSIDE_HUT: InteriorRoom = {
  id: 'brook-riverside-hut',
  art: INTERIOR_ROOM_ART['brook-riverside-hut'],
  // The door opens onto the jetty over the river: the hero comes out on its first row of planks.
  door: { landmark: 'landmark-riverside-hut', dx: 9.5, exitDy: 10 },
  zone: 'Brookside Crossing',
  title: "Brook Listener's Hut",
  detail: 'Somebody here catches the sounds the river carries.',
  accent: '#5fe0c8',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([716, 988, 817, 1024], [695, 906, 841, 978]),
  walls: {
    back: px(0, 0, 1536, 296),
    left: px(0, 0, 22, 1024),
    right: px(1510, 0, 1536, 1024),
    nearLeft: px(0, 988, 716, 1024),
    nearRight: px(817, 988, 1536, 1024),
  },
  furniture: [
    px(120, 105, 600, 322), // hammock and posts
    px(22, 180, 176, 745), // oilskin coat, rods and oars
    px(470, 255, 695, 384), // reel
    px(335, 300, 668, 596), // open hatch and its raised lid: never walkable
    px(778, 225, 1020, 368), // low chest under the jar shelf
    px(1108, 255, 1510, 522), // net over a sawhorse, stool
    px(40, 795, 262, 972), // bucket and basket of floats
    px(1285, 815, 1498, 948), // coil of rope
  ],
  // Each jar's cue sounds as it is uncorked, after its label is read.
  interactables: [
    {
      id: 'teal-jar',
      object: px(781, 114, 826, 182),
      reach: px(778, 370, 860, 462),
      verb: 'Use',
      steps: [[{
        lines: [
          'The label says: ECHO. CANYON. AUTUMN.',
          'You uncork it. An echo tumbles out,',
          'bounces once around the hut and is gone.',
        ],
        hooks: [
          { type: 'sfx', key: 'sfx-attack-echo-wave', volume: 0.6, line: 1 },
          { type: 'glow', at: pt(803, 148), tint: 0x52f0d8, size: 60, mode: 'ring', line: 1 },
        ],
      }]],
    },
    {
      id: 'amber-jar',
      object: px(898, 100, 944, 180),
      reach: px(864, 370, 987, 462),
      verb: 'Use',
      steps: [[{
        lines: [
          "The label says: A DOOR THAT WOULDN'T OPEN.",
          'You uncork it. A stubborn little thunk.',
          'You cork it back up.',
        ],
        hooks: [
          { type: 'sfx', key: 'sfx-gate-blocked', volume: 0.6, line: 1 },
          { type: 'glow', at: pt(921, 140), tint: 0xffc061, size: 22, mode: 'pulse', line: 1 },
        ],
      }]],
    },
    {
      id: 'violet-jar',
      object: px(1036, 112, 1079, 180),
      reach: px(991, 370, 1106, 462),
      verb: 'Use',
      steps: [[{
        lines: [
          'The label says: COIN, DROPPED IN THE BROOK.',
          'You uncork it. A bright little chime.',
          'Whoever dropped it is probably still looking.',
        ],
        hooks: [
          { type: 'sfx', key: 'sfx-item-pickup', volume: 0.6, line: 1 },
          { type: 'glow', at: pt(1057, 146), tint: 0xb07cff, size: 22, mode: 'pulse', line: 1 },
        ],
      }]],
    },
    {
      id: 'horn',
      // The brass horn under the water; the hero listens at the reel, right of it.
      object: px(520, 480, 612, 556),
      reach: px(697, 300, 776, 440),
      verb: 'Listen',
      steps: [[
        {
          when: { bossDefeated: true },
          lines: [
            'You put your ear to the reel.',
            'The river is full of music now.',
            "It's hard to pick out a single song.",
          ],
          hooks: [{ type: 'motes', at: pt(566, 518), tint: 0x8ff5e4, count: 8, dir: 'rise' }],
        },
        {
          lines: [
            'A brass listening horn hangs down into the river.',
            'You put your ear to the reel.',
            'Just water. Then, far away, a few notes...',
            '...drifting south, towards the Highlands.',
          ],
          hooks: [{ type: 'glow', at: pt(566, 518), tint: WATER, size: 40, mode: 'ring' }],
        },
      ]],
    },
    {
      id: 'net',
      object: px(1212, 255, 1508, 522),
      reach: px(1108, 524, 1508, 620),
      verb: 'Look',
      steps: [[{
        lines: [
          'A fishing net, half mended.',
          'Caught in it: a broken guitar pick, a tin whistle...',
          '...and a lot of weed.',
          'The river brings everything here eventually.',
        ],
      }]],
    },
  ],
  idle: [{
    // The floor just below the hatch.
    reach: px(280, 598, 720, 690),
    ms: 6000,
    variant: {
      lines: [
        'The water under the hatch goes very still.',
        'Something down there is humming, slow and patient,',
        'as if waiting for its turn to be heard.',
      ],
      hooks: [{ type: 'glow', at: pt(543, 490), tint: WATER, size: 64, mode: 'ring' }],
    },
  }],
  ambient: [
    // River light through the hatch: a slow shimmer, not a flame's waver.
    { type: 'flicker', at: pt(543, 490), tint: WATER, size: 60, alpha: 0.28, periodMs: 900 },
    { type: 'glow', at: pt(700, 480), tint: WATER, size: 56, alpha: 0.12, pulseMs: 3400 },
    { type: 'motes', area: px(430, 400, 660, 590), tint: 0x8ff5e4, count: 6, drift: 'rise' },
    { type: 'flicker', at: pt(1452, 140), tint: 0xffb85c, size: 34, alpha: 0.4 },
    { type: 'glow', at: pt(803, 148), tint: 0x52f0d8, size: 14, alpha: 0.3, pulseMs: 2000 },
    { type: 'glow', at: pt(921, 140), tint: 0xffc061, size: 14, alpha: 0.3, pulseMs: 2600 },
    { type: 'glow', at: pt(1057, 146), tint: 0xb07cff, size: 14, alpha: 0.3, pulseMs: 3200 },
  ],
  vignette: 0.3,
  // Quiet inside, so the bottled sounds carry.
  musicDuck: 0.15,
  standIn: { floor: 0x645a4d, wall: 0x423b32, furniture: 0x4d4337 },
};
