import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { ROOM_HEIGHT, ROOM_WIDTH, doorway, pt, px, type Ambient, type Hook, type InteriorRoom } from './room';

const NEON = 0xffa24a;
const READING_LIGHT = 0xffb35c;
/** The brass service bell at the desk's right end. */
const BELL = pt(1437, 342);

const readingLight = (x: number, y: number): Ambient => ({ type: 'glow', at: pt(x, y), tint: READING_LIGHT, size: 9, alpha: 0.3 });
const ding: readonly Hook[] = [
  { type: 'sfx', key: 'sfx-ui-click', rate: 1.8 },
  { type: 'glow', at: BELL, tint: 0xffd27a, size: 14, mode: 'ring' },
];

/** INN 24/7: a night-shift capsule hostel for relay workers and travellers. */
export const JUNCTION_INN: InteriorRoom = {
  id: 'junction-inn',
  art: INTERIOR_ROOM_ART['junction-inn'],
  door: { landmark: 'landmark-junction-inn', dx: 0, exitDy: 24 },
  zone: 'Neon Junction',
  title: 'INN 24/7',
  detail: 'Capsules for the night shift. Please keep it down.',
  accent: '#ffa24a',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([695, 984, 840, 1024], [675, 901, 860, 981]),
  walls: {
    // The capsule wall is built into the back wall.
    back: px(0, 0, 1536, 388),
    left: px(0, 0, 24, 1024),
    right: px(1510, 0, 1536, 1024),
    nearLeft: px(0, 984, 695, 1024),
    nearRight: px(840, 984, 1536, 1024),
  },
  furniture: [
    px(24, 68, 386, 396), // lockers and the vending machine
    px(1138, 270, 1510, 502), // reception desk and its empty chair
    px(42, 474, 226, 642), // beanbag
    px(210, 580, 354, 750), // upturned crate
    px(42, 662, 230, 838), // beanbag
    px(1305, 565, 1487, 852), // luggage trolley
  ],
  // Reach zones run about 100 px below what they face: the hero, drawn larger indoors, stops 43 px short of it.
  interactables: [
    {
      id: 'vending-machine',
      object: px(258, 85, 385, 395),
      reach: px(258, 396, 386, 496),
      verb: 'Use',
      // On the glass, below the HUD that covers the room's top-left corner on a desktop screen.
      label: { x: 64.3, y: 50, lift: 7 },
      selector: { kind: 'random', chances: [0.9, 0.1] },
      steps: [
        [{
          lines: ['You press a button. The machine thinks about it...', '...and keeps your coin.'],
          hooks: [{ type: 'sfx', key: 'sfx-ui-click' }],
        }],
        [{
          lines: [
            'Clunk! A can of STATIC FIZZ drops out.',
            'It tastes like a radio between stations.',
            'You put it back.',
          ],
          hooks: [
            { type: 'sfx', key: 'sfx-ui-click' },
            { type: 'sfx', key: 'sfx-item-pickup', delayMs: 300 },
            { type: 'glow', at: pt(322, 348), tint: 0xffc070, size: 20, mode: 'ring' },
          ],
        }],
      ],
    },
    {
      id: 'service-bell',
      object: px(1412, 322, 1462, 366),
      // The trolley leaves only a slot under the desk's right end, so the zone also reaches left of the trolley.
      reach: px(1240, 502, 1500, 600),
      verb: 'Use',
      // One line per ring, so five rings fit in the window.
      selector: { kind: 'rapid', uses: 5, windowMs: 4000 },
      steps: [
        [{ lines: ['Ding. ...Nobody comes.'], hooks: ding }],
        [{
          lines: ["A tired voice from the back room: 'WE HEARD YOU.'", "These days, that's honestly good news."],
          hooks: ding,
        }],
      ],
    },
    {
      id: 'open-capsule',
      object: px(700, 205, 925, 330),
      reach: px(690, 388, 935, 488),
      verb: 'Look',
      steps: [[
        {
          when: { bossDefeated: true },
          lines: ['The capsule is empty.', 'Someone has scrawled THANKS! across the note.'],
        },
        {
          lines: [
            "One capsule's hatch is open.",
            'A thin blanket, a reading light,',
            'and a note taped to the ceiling:',
            "'Wake me when the music comes back.'",
          ],
        },
      ]],
    },
  ],
  ambient: [
    // The orange neon arrow over the key rack, with the odd double blink.
    { type: 'flicker', at: pt(1372, 95), tint: NEON, size: 40, alpha: 0.42, blink: true },
    readingLight(457, 95),
    readingLight(743, 95),
    readingLight(1030, 95),
    readingLight(457, 232),
    { type: 'glow', at: pt(750, 232), tint: READING_LIGHT, size: 14, alpha: 0.38 },
    readingLight(1030, 232),
    // The two eggs: the glowing vending machine and the small brass bell.
    { type: 'glow', at: pt(322, 215), tint: 0xffc878, size: 30, alpha: 0.12, pulseMs: 2600 },
    { type: 'glow', at: BELL, tint: 0xffd27a, size: 8, alpha: 0.22, pulseMs: 2200 },
  ],
  // The darkest room: a light vignette keeps the lockers and beanbags readable.
  vignette: 0.26,
  musicDuck: 0.2,
  standIn: { floor: 0x4a2533, wall: 0x3a3536, furniture: 0x6a3428 },
};
