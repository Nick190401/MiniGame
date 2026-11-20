import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { ROOM_HEIGHT, ROOM_WIDTH, doorway, pt, px, type Ambient, type Condition, type InteriorRoom } from './room';

const CYAN = 0x8ff6ff;
const AMBER = 0xffb347;
const TEAL = 0x6ff7e0;
const RED = 0xff4a3a;
const GOLD = 0xffd166;

/** The relay map's seven lamps, top (Echo Village) to bottom (the Core), as painted. */
const NODES = [pt(794, 75), pt(848, 116), pt(790, 157), pt(838, 198), pt(779, 241), pt(838, 282), pt(779, 325)];
/** The big dial's face. */
const DIAL = pt(1130, 160);

const lamp = (index: number, when?: Condition): Ambient =>
  ({ type: 'glow', at: NODES[index], tint: CYAN, size: 10, alpha: 0.55, pulseMs: 1900 + index * 230, when });
/** The towers past the opened gate, while the Core is still silent. */
const unsteadyLamp = (index: number): Ambient =>
  ({ type: 'flicker', at: NODES[index], tint: CYAN, size: 10, alpha: 0.55, when: { gateOpen: true, bossDefeated: false } });

/** Relay Control: the Junction's telemetry room for the relay towers. Deliberately no studio: no faders, no microphone. */
export const JUNCTION_SIGNAL_STATION: InteriorRoom = {
  id: 'junction-signal-station',
  art: INTERIOR_ROOM_ART['junction-signal-station'],
  door: { landmark: 'landmark-signal-station', dx: 0, exitDy: 24 },
  zone: 'Neon Junction',
  title: 'Relay Control',
  detail: 'Telemetry for every relay tower. Most read flat.',
  accent: '#6ff0c8',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([696, 985, 840, 1024], [687, 914, 848, 984]),
  walls: {
    back: px(0, 0, 1536, 385),
    left: px(0, 0, 24, 1024),
    right: px(1510, 0, 1536, 1024),
    nearLeft: px(0, 985, 696, 1024),
    nearRight: px(840, 985, 1536, 1024),
  },
  furniture: [
    px(95, 228, 585, 420), // console desk
    px(212, 325, 305, 466), // office chair, left
    px(384, 325, 473, 466), // office chair, right
    px(1033, 70, 1232, 420), // frequency dial and its cabinet
    px(1295, 78, 1510, 446), // server racks and the hazard tape in front
    px(24, 598, 152, 952), // coffee counter
    px(1213, 530, 1505, 948), // antenna parts, dish and coiled cable
  ],
  // Reach zones run about 100 px below what they face: the hero, drawn larger indoors, stops 43 px short of it.
  interactables: [
    {
      id: 'frequency-dial',
      object: px(1060, 92, 1200, 230),
      reach: px(1033, 420, 1232, 520),
      verb: 'Use',
      selector: { kind: 'cycle' },
      steps: [
        [{
          lines: ['88.1. Echo Village. Static.'],
          hooks: [{ type: 'sfx', key: 'sfx-enemy-attack', volume: 0.25 }],
        }],
        [{
          lines: ['93.7. Neon Junction. Someone humming. Badly.'],
          hooks: [{ type: 'sfx', key: 'sfx-ui-click', volume: 0.4, rate: 0.75 }],
        }],
        [{
          lines: ['101.3. Whisper Grove. Wind. Just wind.'],
          hooks: [{ type: 'sfx', key: 'sfx-ui-click', volume: 0.4, rate: 0.75 }],
        }],
        [
          {
            when: { bossDefeated: true },
            lines: ['107.9. The Core.', "'...play it loud!' Then laughter, and a drum fill."],
            hooks: [{ type: 'glow', at: DIAL, tint: GOLD, size: 36, mode: 'pulse' }],
          },
          {
            lines: ['107.9. The Core.', "'...no sound passes...'", 'You turn the dial back. Quickly.'],
            hooks: [
              { type: 'sfx', key: 'sfx-enemy-signal-attack', volume: 0.3 },
              { type: 'glow', at: DIAL, tint: RED, size: 36, mode: 'pulse' },
            ],
          },
        ],
      ],
    },
    {
      id: 'relay-map',
      object: px(602, 37, 1007, 370),
      reach: px(600, 385, 1010, 485),
      verb: 'Look',
      // Left of the lamp chain and clear of the room's top edge (the map reaches almost to it).
      label: { x: 138, y: 33, lift: 7 },
      steps: [[
        {
          when: { bossDefeated: true },
          lines: [
            'A map of the relay towers.',
            'They run from Echo Village all the way to the Core.',
            'Every tower is lit. Even the one at the Core.',
          ],
          hooks: [{ type: 'glow', at: NODES[6], tint: GOLD, size: 22, mode: 'ring' }],
        },
        {
          when: { gateOpen: true },
          lines: [
            'A map of the relay towers.',
            'They run from Echo Village all the way to the Core.',
            'The towers past the gate flicker.',
            'The last one, deep underground, stays dead.',
          ],
          hooks: [{ type: 'glow', at: NODES[5], tint: CYAN, size: 22, mode: 'ring' }],
        },
        {
          lines: [
            'A map of the relay towers.',
            'They run from Echo Village all the way to the Core.',
            'Every tower south of the Frequency Gate is dark.',
          ],
          hooks: [{ type: 'glow', at: NODES[3], tint: CYAN, size: 22, mode: 'ring' }],
        },
      ]],
    },
    {
      id: 'clipboard',
      object: px(510, 240, 562, 305),
      reach: px(473, 420, 585, 520),
      verb: 'Read',
      steps: [[
        {
          when: { bossDefeated: true },
          lines: ['A clipboard of readings.', 'Signal strength: 100%.', 'Someone has added three exclamation marks.'],
        },
        { lines: ['A clipboard of readings.', 'Signal strength: 12%... 9%... 4%...'] },
      ]],
    },
    {
      id: 'coffee-machine',
      object: px(38, 598, 120, 700),
      // Low enough that the hero's head stays under the key cap over the machine.
      reach: px(152, 816, 262, 952),
      verb: 'Look',
      steps: [[{
        lines: [
          'A coffee machine with a note:',
          'OUT OF ORDER SINCE THE SILENCE.',
          'Apparently it only worked if it heard itself gurgle.',
        ],
      }]],
    },
  ],
  ambient: [
    // The screen bank's waves throw an uneven cyan light.
    { type: 'flicker', at: pt(245, 140), tint: TEAL, size: 56, alpha: 0.15 },
    { type: 'flicker', at: pt(450, 140), tint: TEAL, size: 56, alpha: 0.13 },
    // Rack lights blink, each at its own pace.
    { type: 'glow', at: pt(1372, 191), tint: AMBER, size: 9, alpha: 0.34, pulseMs: 1100 },
    { type: 'glow', at: pt(1470, 191), tint: TEAL, size: 7, alpha: 0.3, pulseMs: 1700 },
    { type: 'glow', at: pt(1489, 224), tint: RED, size: 5, alpha: 0.36, pulseMs: 800 },
    { type: 'flicker', at: pt(1445, 257), tint: AMBER, size: 8, alpha: 0.3 },
    { type: 'glow', at: pt(1352, 322), tint: TEAL, size: 8, alpha: 0.3, pulseMs: 1400 },
    { type: 'glow', at: pt(1445, 320), tint: AMBER, size: 8, alpha: 0.3, pulseMs: 2100 },
    // The dial panel's lamps: amber always, red while the Core is silent.
    { type: 'glow', at: pt(1061, 242), tint: AMBER, size: 6, alpha: 0.35 },
    { type: 'glow', at: pt(1200, 241), tint: RED, size: 6, alpha: 0.4, pulseMs: 1600, when: { bossDefeated: false } },
    // The relay map follows the world: four towers lit, six past the open gate, all seven once the Core sings.
    lamp(0),
    lamp(1),
    lamp(2),
    lamp(3),
    unsteadyLamp(4),
    unsteadyLamp(5),
    lamp(4, { bossDefeated: true }),
    lamp(5, { bossDefeated: true }),
    { type: 'glow', at: NODES[6], tint: GOLD, size: 12, alpha: 0.65, pulseMs: 2600, when: { bossDefeated: true } },
  ],
  vignette: 0.3,
  musicDuck: 0.25,
  standIn: { floor: 0x767b82, wall: 0xb5b9bd, furniture: 0x4c5560 },
};
