import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { doorway, pt, px, ROOM_HEIGHT, ROOM_WIDTH, type Hook, type InteriorRoom } from './room';

const MUSIC_BOX_TOP = pt(805, 190);

const WIND_UP: readonly Hook[] = [{ type: 'sfx', key: 'sfx-ui-click', volume: 0.7, repeat: 2, intervalMs: 200 }];

const steam = (count: number): Hook => ({ type: 'motes', at: pt(170, 162), tint: 0xf4eee4, count, dir: 'rise' });

/** Larkspur Cottage: a lived-in family home, kitchen left, parlour right, stairs up to the bedrooms. */
export const ECHO_COTTAGE: InteriorRoom = {
  id: 'echo-cottage',
  art: INTERIOR_ROOM_ART['echo-cottage'],
  door: { landmark: 'landmark-cottage', dx: 0, exitDy: 24 },
  zone: 'Echo Village',
  title: 'Larkspur Cottage',
  detail: 'Fresh bread on the table. The family must be out.',
  accent: '#ffd08a',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([690, 985, 844, 1024], [685, 895, 848, 976]),
  walls: {
    back: px(0, 0, 1536, 272),
    left: px(0, 0, 26, 1024),
    right: px(1500, 0, 1536, 1024),
    nearLeft: px(0, 985, 690, 1024),
    nearRight: px(844, 985, 1536, 1024),
  },
  furniture: [
    px(66, 22, 264, 356), // kitchen range and stovepipe
    px(270, 195, 524, 358), // sink cabinet
    px(682, 28, 921, 392), // dresser
    // Armchair, wide enough to close the narrow wall pockets beside it, to the dresser and to the stairs.
    px(921, 165, 1252, 418),
    px(1252, 22, 1500, 448), // staircase and newel post
    px(50, 388, 388, 684), // dining table, chair backs included
    px(72, 752, 348, 968), // boot rack and umbrella stand
    px(350, 798, 472, 956), // yarn basket
    px(1200, 794, 1500, 960), // toy table with the xylophone, closing the strip to the right wall
  ],
  interactables: [
    {
      id: 'music-box',
      object: px(770, 195, 866, 253),
      reach: px(700, 394, 905, 520),
      verb: 'Use',
      steps: [[
        {
          when: { bonusSongUnlocked: true },
          lines: [
            'You wind the little music box. Click. Click. Click.',
            '...and a thin, tinkling melody fills the room.',
            "It's the Lost Track.",
            'Someone in this house hummed it so often,',
            'the box learned it by heart.',
          ],
          hooks: [
            ...WIND_UP,
            { type: 'sfx', key: 'sfx-level-up', rate: 0.75, volume: 0.6, delayMs: 700 },
            { type: 'glow', at: pt(818, 224), tint: 0xffd27a, size: 26, mode: 'pulse' },
            { type: 'motes', at: MUSIC_BOX_TOP, tint: 0xffd27a, count: 8, dir: 'rise' },
          ],
        },
        {
          when: { bossDefeated: true },
          lines: [
            'You wind the little music box. Click. Click. Click.',
            '...and a thin, tinkling melody starts up.',
            'A few bars, then it falters and stops.',
            'The rest of the tune is still out there somewhere.',
          ],
          hooks: [
            ...WIND_UP,
            { type: 'sfx', key: 'sfx-level-up', rate: 0.75, volume: 0.4, delayMs: 700 },
            { type: 'motes', at: MUSIC_BOX_TOP, tint: 0xffd27a, count: 3, dir: 'rise' },
          ],
        },
        {
          lines: [
            'You wind the little music box. Click. Click. Click.',
            '...nothing. The comb is fine.',
            "It's the tune that's missing.",
          ],
          hooks: WIND_UP,
        },
      ]],
    },
    {
      id: 'cat',
      object: px(1020, 276, 1106, 334),
      reach: px(962, 420, 1172, 540),
      verb: 'Look',
      selector: { kind: 'counter', at: [1, 2, 3, 4, 7] },
      steps: [
        [{ lines: ['A grey cat, curled into a perfect circle.', 'Fast asleep.'] }],
        [{ lines: ['Still asleep.'] }],
        [{ lines: ['One ear twitches. Still asleep.'] }],
        [{ lines: ['Still. Asleep.'] }],
        [
          {
            when: { bossDefeated: true },
            lines: ['It purrs, louder than you thought a cat could.'],
            hooks: [{ type: 'glow', at: pt(1063, 305), tint: 0xffc890, size: 24, mode: 'pulse' }],
          },
          {
            lines: ['It purrs, very softly, without waking up.', "Well. That's one sound the Gatekeeper never got."],
            hooks: [{ type: 'glow', at: pt(1063, 305), tint: 0xffc890, size: 18, mode: 'pulse' }],
          },
        ],
      ],
    },
    {
      id: 'kettle',
      object: px(162, 138, 232, 200),
      // The floor under the range is a dead end narrower than the hero: the kettle is used from the table's corner.
      reach: px(388, 356, 526, 520),
      verb: 'Look',
      // Just under the kettle, on the oven door: over it the cap would sit under the HUD card.
      label: { x: 39.4, y: 66, lift: 7 },
      steps: [[
        {
          when: { bossDefeated: true },
          lines: ['The kettle has started whistling again.', 'Somebody should really take it off the heat.'],
          hooks: [steam(9)],
        },
        {
          lines: ['A copper kettle on the stove. It used to whistle.', 'Now it just steams. Politely.'],
          hooks: [steam(5)],
        },
      ]],
    },
    {
      id: 'drawing',
      object: px(572, 115, 668, 212),
      reach: px(526, 274, 680, 400),
      verb: 'Look',
      steps: [[{
        lines: [
          "A child's crayon drawing: a house, a tree, a sun.",
          'You lift a corner. On the back, in wobbly letters:',
          "'FOR THE SOUND KEEPER. COME HOME SAFE.'",
        ],
      }]],
    },
  ],
  ambient: [
    { type: 'motes', area: px(200, 150, 1300, 640), tint: 0xffe6b0, count: 18, drift: 'hang' },
    { type: 'flicker', at: pt(116, 282), tint: 0xffa860, size: 14, alpha: 0.24 },
    // The music box is small at phone scale: a faint glint draws the eye to it.
    { type: 'glow', at: pt(818, 224), tint: 0xffd27a, size: 14, alpha: 0.16, pulseMs: 1800 },
  ],
  vignette: 0.24,
  musicDuck: 0.3,
  standIn: { floor: 0xa87440, wall: 0xe6d3b0, furniture: 0x6b4a2e },
};
