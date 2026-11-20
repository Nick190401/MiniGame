import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { doorway, pt, px, ROOM_HEIGHT, ROOM_WIDTH, type InteriorRoom } from './room';

const SEA_GLASS = 0x7fe0d0;

/** Echo Village Infirmary: the village's sound-healing ward. Its healer, Maren, is away at the Junction. */
export const ECHO_CLINIC: InteriorRoom = {
  id: 'echo-clinic',
  art: INTERIOR_ROOM_ART['echo-clinic'],
  door: { landmark: 'landmark-clinic', dx: 0, exitDy: 24 },
  zone: 'Echo Village',
  title: 'Echo Village Infirmary',
  detail: 'Fresh linen, empty beds. The healer is away.',
  accent: '#8fe3d6',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([690, 985, 844, 1024], [684, 893, 849, 976]),
  walls: {
    back: px(0, 0, 1536, 350),
    left: px(0, 0, 24, 1024),
    right: px(1510, 0, 1536, 1024),
    nearLeft: px(0, 985, 690, 1024),
    nearRight: px(844, 985, 1536, 1024),
  },
  furniture: [
    px(52, 120, 808, 568), // three beds, curtains and side tables: one block, so the pockets between beds stay closed
    px(968, 185, 1207, 437), // apothecary cabinet
    // Healer's desk. It ends above the stool's legs (y 508): the hero's body keeps his feet below them, and the
    // walkway from the apothecary to the floor right of the bowl table stays as tall as he is.
    px(1226, 250, 1510, 470),
    px(993, 558, 1272, 758), // singing-bowl table
    px(50, 568, 190, 915), // wash basin stand, closing the strip under the beds
    px(1305, 705, 1505, 948), // fern
  ],
  interactables: [
    {
      id: 'bowl-small',
      object: px(1020, 608, 1074, 656),
      // From the floor left of the table too.
      reach: px(940, 760, 1078, 880),
      verb: 'Use',
      steps: [[{
        lines: ['Ting.'],
        hooks: [
          { type: 'sfx', key: 'sfx-heal', rate: 1.5, volume: 0.35 },
          { type: 'glow', at: pt(1047, 632), tint: SEA_GLASS, size: 16, mode: 'ring' },
        ],
      }]],
    },
    {
      id: 'bowl-medium',
      object: px(1082, 596, 1152, 656),
      reach: px(1078, 760, 1156, 880),
      verb: 'Use',
      steps: [[{
        lines: ['Tong.'],
        hooks: [
          { type: 'sfx', key: 'sfx-heal', rate: 1.2, volume: 0.4 },
          { type: 'glow', at: pt(1117, 626), tint: SEA_GLASS, size: 20, mode: 'ring' },
        ],
      }]],
    },
    {
      id: 'bowl-large',
      object: px(1158, 576, 1254, 660),
      reach: px(1156, 760, 1300, 880),
      verb: 'Use',
      steps: [[{
        lines: ['A deep hum you can feel in your teeth.'],
        hooks: [
          { type: 'sfx', key: 'sfx-heal', rate: 0.9, volume: 0.45 },
          { type: 'glow', at: pt(1206, 618), tint: SEA_GLASS, size: 26, mode: 'ring' },
        ],
      }]],
    },
    {
      id: 'pillow',
      object: px(666, 252, 770, 315),
      reach: px(636, 570, 808, 690),
      verb: 'Look',
      steps: [[
        {
          lines: [
            'The third bed is made very neatly.',
            'Something crinkles under the pillow. A folded note:',
            "'Krys, your old tuning fork still works on fevers.'",
            "'Thank you for teaching me. Maren.'",
          ],
        },
        {
          when: { bossDefeated: true },
          append: true,
          lines: ['Below it, in newer ink:', "'The ward's been empty all week.'", "'I think the world is healing itself.'"],
        },
      ]],
    },
    {
      id: 'drawers',
      object: px(975, 245, 1200, 400),
      reach: px(968, 439, 1207, 556),
      verb: 'Look',
      steps: [[{
        lines: [
          'Little drawers of chamomile and mint.',
          "One says 'honey lozenges for tired singers'.",
          'Another says HUSH-ROOT. DO NOT BREW.',
          'DO NOT is underlined three times.',
        ],
      }]],
    },
    {
      id: 'desk',
      object: px(1255, 255, 1480, 335),
      reach: px(1226, 470, 1504, 640),
      verb: 'Look',
      steps: [[{
        lines: [
          'A brass tuning fork rests on a green felt cloth.',
          'Beside it lies the appointment book. You peek.',
          'Every entry this month says the same:',
          "'At Neon Junction. Hearing cases.'",
        ],
      }]],
    },
    {
      id: 'embroidery',
      object: px(812, 110, 937, 255),
      reach: px(810, 352, 966, 470),
      verb: 'Look',
      steps: [[{ lines: ['A stitched tuning fork over a heart-shaped wave.', 'Thousands of small, patient stitches.'] }]],
    },
  ],
  sequences: [{
    order: ['bowl-small', 'bowl-medium', 'bowl-large'],
    windowMs: 6000,
    variant: {
      lines: [
        'Three notes, falling, like a song you almost know.',
        'For a moment the whole ward feels lighter.',
        "(It doesn't heal you. It just feels nice.)",
      ],
      hooks: [
        { type: 'glow', at: pt(1132, 650), tint: SEA_GLASS, size: 150, mode: 'ring' },
        { type: 'motes', at: pt(1132, 600), tint: SEA_GLASS, count: 10, dir: 'rise' },
      ],
    },
  }],
  ambient: [
    { type: 'motes', area: px(140, 160, 1000, 720), tint: 0xeef6ff, count: 14, drift: 'hang' },
    { type: 'glow', at: pt(1137, 628), tint: 0xe8c070, size: 34, alpha: 0.14, pulseMs: 2400 },
  ],
  vignette: 0.22,
  musicDuck: 0.22,
  standIn: { floor: 0xd9c7a4, wall: 0xf0ebe2, furniture: 0x9c7a55 },
};
