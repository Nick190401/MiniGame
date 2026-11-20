import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { ROOM_HEIGHT, ROOM_WIDTH, doorway, pt, px, type InteriorRoom } from './room';

/** The middle of the great bell, and the round window above it. */
const BELL = pt(768, 230);
const WINDOW = pt(768, 65);
const SORTED_BY_FEELING = ['Sheet music sorted by feeling instead of title:', 'Rainy. Brave. Homesick.'];

/** The Echo Archive: a hushed shrine-library of songs round a great bronze bell. */
export const GROVE_ARCHIVE_SHRINE: InteriorRoom = {
  id: 'grove-archive-shrine',
  art: INTERIOR_ROOM_ART['grove-archive-shrine'],
  door: { landmark: 'landmark-archive-shrine', dx: 0, exitDy: 24 },
  zone: 'Whisper Grove',
  title: 'The Echo Archive',
  detail: 'Songs on every shelf, sorted by how they feel.',
  accent: '#ffd27a',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([724, 991, 812, 1024], [695, 919, 841, 979]),
  walls: {
    // The back shelves, columns and the bell's arch stand on the wall line.
    back: px(0, 0, 1536, 400),
    left: px(0, 0, 22, 1024),
    right: px(1514, 0, 1536, 1024),
    nearLeft: px(0, 991, 724, 1024),
    nearRight: px(812, 991, 1536, 1024),
  },
  furniture: [
    px(0, 0, 130, 1024), // left side shelves
    px(1408, 0, 1536, 1024), // right side shelves
    px(654, 325, 884, 444), // stone altar
    px(550, 225, 620, 449), // candelabra, left
    px(916, 225, 987, 449), // candelabra, right
    px(350, 498, 552, 717), // left lectern, the Book of Echoes
    px(1013, 525, 1117, 717), // right lectern, the register
  ],
  interactables: [
    {
      id: 'bell',
      object: px(695, 150, 840, 305),
      reach: px(640, 446, 896, 590),
      verb: 'Use',
      steps: [[
        {
          lines: ['You strike the great bronze bell, green with age.'],
          hooks: [{ type: 'motes', at: pt(768, 40), tint: 0xe8d6a8, count: 8, dir: 'fall' }],
        },
        {
          when: { bossDefeated: false },
          lines: ['The note dies almost at once,', 'as if the silence swallowed it.'],
          hooks: [
            { type: 'sfx', key: 'sfx-attack-reverb-strike', volume: 0.55, rate: 1.1 },
            { type: 'glow', at: BELL, tint: 0xffc860, size: 44, mode: 'ring', ms: 500 },
          ],
          append: true,
        },
        {
          when: { bossDefeated: true },
          lines: ['The note rolls on and on,', 'out through the doors and across the whole grove.'],
          hooks: [
            { type: 'sfx', key: 'sfx-attack-reverb-strike', volume: 0.7, rate: 0.85 },
            { type: 'glow', at: BELL, tint: 0xffc860, size: 150, mode: 'ring', ms: 2800 },
            { type: 'glow', at: WINDOW, tint: 0xffb648, size: 60, mode: 'pulse', ms: 2400 },
          ],
          append: true,
        },
      ]],
    },
    {
      id: 'book-of-echoes',
      object: px(355, 505, 548, 615),
      reach: px(340, 719, 562, 850),
      verb: 'Read',
      // One page fills in for every sound fragment found.
      steps: [[
        {
          when: { fragments: 3 },
          lines: ['The Book of Echoes. A third page has filled in:', "'Carried together, the pieces", "will find their way home.'"],
          hooks: [{ type: 'glow', at: pt(451, 560), tint: 0xffe2a0, size: 40, mode: 'pulse' }],
        },
        {
          when: { fragments: 2 },
          lines: ['The Book of Echoes. Another page has filled in:', "'The song was split in three,", "so no single hand could hold it.'"],
          hooks: [{ type: 'glow', at: pt(451, 560), tint: 0xffe2a0, size: 40, mode: 'pulse' }],
        },
        {
          when: { fragments: 1 },
          lines: ['The Book of Echoes. One page has filled in:', "'Before the gate had a keeper, it had a song.'"],
          hooks: [{ type: 'glow', at: pt(451, 560), tint: 0xffe2a0, size: 40, mode: 'pulse' }],
        },
        { lines: ['The Book of Echoes.', 'Most of its pages are blank, waiting.'] },
        {
          when: { bossDefeated: true },
          lines: ['A new page, the ink still wet:', "'...and the one who carried them", "was called {playerName}.'"],
          append: true,
        },
      ]],
    },
    {
      id: 'register',
      object: px(1018, 530, 1112, 610),
      reach: px(1003, 719, 1127, 850),
      verb: 'Read',
      steps: [[{
        lines: [
          "The archive's visitor register.",
          'Most entries are signed with a tiny tuning fork.',
          'Professor Krys has been here. Often.',
        ],
      }]],
    },
    {
      id: 'side-shelves',
      object: px(1410, 380, 1514, 700),
      // Below the key cap's height, so the hero's head stays clear of it.
      reach: px(1290, 600, 1406, 860),
      verb: 'Look',
      // Pulled in from the room's edge.
      label: { x: 290, y: 84.8, lift: 7 },
      steps: [[
        {
          when: { bossDefeated: true },
          lines: [...SORTED_BY_FEELING, 'One shelf was labelled LOST.', 'Someone has crossed out LOST and written FOUND.'],
        },
        { lines: [...SORTED_BY_FEELING, 'One shelf is labelled LOST. It is empty.'] },
      ]],
    },
    {
      id: 'cylinders',
      object: px(22, 380, 128, 700),
      reach: px(130, 600, 246, 860),
      verb: 'Look',
      label: { x: 17.4, y: 84.8, lift: 7 },
      steps: [[{ lines: ['Wax cylinders, each one labelled with a place.', 'Brookside. The Junction. The Grove at dawn.'] }]],
    },
  ],
  ambient: [
    { type: 'flicker', at: pt(585, 250), tint: 0xffc46a, size: 34, alpha: 0.38 },
    { type: 'flicker', at: pt(952, 250), tint: 0xffc46a, size: 34, alpha: 0.38 },
    { type: 'glow', at: WINDOW, tint: 0xffb648, size: 40, alpha: 0.3, pulseMs: 3200 },
    // Dust hanging in the beam from the round window.
    { type: 'motes', area: px(690, 90, 846, 330), tint: 0xffe2a0, count: 10, drift: 'hang' },
  ],
  // Stone and hush: the bell carries over the muffled world.
  musicDuck: 0.15,
  standIn: { floor: 0xa48a5e, wall: 0x8a7452, furniture: 0x5e4228 },
};
