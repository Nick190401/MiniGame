import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { doorway, pt, px, ROOM_HEIGHT, ROOM_WIDTH, type InteriorRoom } from './room';

const GOLD_NOTES = 0xffd27a;
const LANTERN = 0xffc070;

/** The Hearthsong: the village tavern, with a bar, a fire and the small stage where Kian played every evening. */
export const ECHO_INN: InteriorRoom = {
  id: 'echo-inn',
  art: INTERIOR_ROOM_ART['echo-inn'],
  door: { landmark: 'landmark-inn', dx: 0, exitDy: 24 },
  zone: 'Echo Village',
  title: 'The Hearthsong',
  detail: 'The fire still burns. The stage stands empty.',
  accent: '#ffb366',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([690, 985, 844, 1024], [685, 893, 849, 976]),
  walls: {
    back: px(0, 0, 1536, 250),
    left: px(0, 0, 26, 1024),
    right: px(1500, 0, 1536, 1024),
    nearLeft: px(0, 985, 690, 1024),
    nearRight: px(844, 985, 1536, 1024),
  },
  // The raised stage is walkable floor.
  furniture: [
    px(26, 248, 582, 516), // bar counter and stools
    px(26, 248, 130, 695), // bar counter, left run
    px(582, 22, 955, 382), // hearth, closing the gaps to the bar and the stage (narrower than the hero)
    px(1215, 90, 1438, 292), // upright piano
    px(978, 172, 1088, 312), // chalkboard easel
    px(1288, 250, 1360, 342), // performer's stool
    px(1080, 465, 1382, 640), // round table and chairs
    px(1080, 702, 1385, 888), // round table and chairs
    px(52, 775, 282, 962), // ale kegs on their rack
  ],
  interactables: [
    {
      id: 'guestbook',
      object: px(398, 296, 497, 345),
      // In front of the stools under the book, and round the counter's end.
      reach: px(380, 520, 680, 630),
      verb: 'Read',
      steps: [[{
        lines: [
          'The guestbook lies open.',
          'The last entry is months old.',
          'Below it, someone has already written your name:',
          "'{playerName}. Room: always kept free.'",
        ],
      }]],
    },
    {
      id: 'stool',
      object: px(1288, 250, 1360, 342),
      reach: px(1270, 344, 1384, 460),
      verb: 'Use',
      steps: [[
        {
          when: { bossDefeated: true },
          lines: ['An empty stool. You bow to the empty room.', 'Somewhere, very faintly, someone claps.'],
          hooks: [{ type: 'sfx', key: 'sfx-victory', volume: 0.3, delayMs: 700 }],
        },
        { lines: ['An empty stool. You bow to the empty room.', '...Silence. Tough crowd.'] },
      ]],
    },
    {
      id: 'piano',
      object: px(1215, 90, 1438, 292),
      reach: px(1120, 294, 1268, 380),
      verb: 'Use',
      steps: [[
        {
          when: { bossDefeated: true },
          lines: ['You press a key. It rings out, warm.', 'A little out of tune. Honestly? Perfect.'],
          hooks: [{ type: 'motes', at: pt(1326, 95), tint: GOLD_NOTES, count: 7, dir: 'rise' }],
        },
        {
          lines: [
            'You press a key. A dull wooden thunk.',
            'Every string has gone slack,',
            'as if the piano gave up waiting.',
          ],
        },
      ]],
    },
    {
      id: 'chalkboard',
      object: px(978, 172, 1088, 312),
      reach: px(960, 314, 1110, 440),
      verb: 'Read',
      steps: [[
        {
          lines: [
            'Smudged chalk. You can just make out:',
            "'TONIGHT: KIAN VERO, strings and stories.'",
            'The date is from before the silence.',
          ],
        },
        { when: { seen: ['kian-met'] }, append: true, lines: ['So this is where Kian played every evening.'] },
      ]],
    },
  ],
  ambient: [
    { type: 'flicker', at: pt(768, 290), tint: 0xff9a40, size: 64, alpha: 0.36 },
    { type: 'motes', area: px(690, 190, 850, 320), tint: 0xffb060, count: 10, drift: 'rise' },
    { type: 'flicker', at: pt(105, 300), tint: LANTERN, size: 20, alpha: 0.24 },
    { type: 'flicker', at: pt(574, 112), tint: LANTERN, size: 18, alpha: 0.2 },
    { type: 'flicker', at: pt(1467, 120), tint: LANTERN, size: 18, alpha: 0.2 },
  ],
  vignette: 0.3,
  musicDuck: 0.3,
  standIn: { floor: 0x4a3020, wall: 0x7d6f60, furniture: 0x5a3522 },
};
