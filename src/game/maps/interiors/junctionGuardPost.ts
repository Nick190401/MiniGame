import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { ROOM_HEIGHT, ROOM_WIDTH, doorway, pt, px, type Hook, type InteriorRoom } from './room';

/** The record on Quincy's turntable. */
const PLATTER = pt(1365, 298);

/** The flip tiles clattering round, one click per tile. */
const CLACKS = [1.4, 1.2, 1.5, 1.3, 1.6, 1.1].map((rate, index): Hook => (
  { type: 'sfx', key: 'sfx-ui-click', volume: 0.45, rate, delayMs: index * 80 }
));

/** The Checkpoint Booth: Guard Quincy's post on the Junction's south-east exit, and his record collection. */
export const JUNCTION_GUARD_POST: InteriorRoom = {
  id: 'junction-guard-post',
  art: INTERIOR_ROOM_ART['junction-guard-post'],
  // The glass door is at the booth's far right.
  door: { landmark: 'landmark-guard-post', dx: 25.5, exitDy: 24 },
  zone: 'Neon Junction',
  title: 'Checkpoint Booth',
  detail: "Quincy's post: one desk, one window, a lot of vinyl.",
  accent: '#ffa142',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([680, 969, 836, 1024], [687, 880, 850, 941]),
  walls: {
    back: px(0, 0, 1536, 472),
    left: px(0, 0, 30, 1024),
    right: px(1505, 0, 1536, 1024),
    nearLeft: px(0, 969, 680, 1024),
    nearRight: px(836, 969, 1536, 1024),
  },
  furniture: [
    px(30, 228, 296, 527), // CRT monitor cart
    px(328, 215, 460, 480), // filing cabinet
    px(460, 280, 1027, 490), // long desk
    px(680, 346, 808, 524), // desk chair
    px(1046, 358, 1267, 498), // vinyl crates
    px(1265, 218, 1505, 474), // record player cabinet
    px(30, 530, 170, 895), // locker
    px(1308, 490, 1505, 884), // folding camp cot
    px(445, 826, 520, 964), // fire extinguisher
  ],
  interactables: [
    {
      id: 'record-player',
      object: px(1305, 218, 1448, 350),
      // The crates and the cot fence the cabinet in: the floor below the crates reaches it.
      reach: px(1060, 540, 1306, 650),
      verb: 'Use',
      steps: [[
        {
          when: { bonusSongUnlocked: true, recordPlaying: true },
          lines: ['You lift the needle.', 'Quincy would want it played loud, though.'],
          hooks: [{ type: 'record', play: false, platter: PLATTER }],
        },
        {
          when: { bonusSongUnlocked: true },
          lines: ['A brand-new record sits on the platter.', 'You know exactly what it is.', 'You lower the needle.'],
          hooks: [{ type: 'record', play: true, platter: PLATTER, line: 2 }],
        },
        {
          lines: [
            "Quincy's record player, and crates of old vinyl.",
            'Every sleeve is labelled by hand.',
            'One sleeve, set apart, says: FOR EMERGENCIES.',
          ],
        },
        {
          when: { bonusSongUnlocked: false, seen: ['quincy-met'] },
          lines: ["That must be Quincy's old healing recording.", 'Best leave it where it is.'],
          append: true,
        },
      ]],
    },
    {
      id: 'monitors',
      object: px(70, 232, 262, 385),
      reach: px(190, 560, 330, 660),
      verb: 'Look',
      selector: { kind: 'counter', at: [1, 2] },
      steps: [
        [{
          lines: [
            'Grainy footage of the plaza, and of this booth.',
            'A small figure in a cap stares up at the camera.',
            "...Oh. That's you.",
            'You wave. It waves back. Good.',
          ],
          hooks: [{ type: 'cameo', screen: px(193, 322, 257, 367), tint: 0xc8f0c0 }],
        }],
        [{
          lines: ['The little figure on the screen is still you.', 'You wave again. It waves again. Still good.'],
          hooks: [{ type: 'cameo', screen: px(193, 322, 257, 367), tint: 0xc8f0c0 }],
        }],
      ],
    },
    {
      id: 'status-board',
      object: px(100, 40, 428, 205),
      reach: px(330, 520, 470, 630),
      verb: 'Look',
      // On the lower tiles: over the board it would leave the room and sit under the HUD card.
      label: { x: 52.8, y: 46, lift: 7 },
      steps: [[
        { lines: ['The status board clacks through its tiles.'], hooks: CLACKS },
        { when: { bossDefeated: true }, lines: ['FREQUENCY GATE: OPEN. SILENCE: LIFTED.'], append: true },
        {
          when: { bossDefeated: false, gateOpen: true },
          lines: ['FREQUENCY GATE: OPEN.', 'Travellers since the silence: 1.', "That's you. You're the one."],
          append: true,
        },
        {
          when: { bossDefeated: false, gateOpen: false },
          lines: ['FREQUENCY GATE: SEALED.', 'Travellers since the silence: 0.'],
          append: true,
        },
      ]],
    },
    {
      id: 'thermos',
      object: px(848, 245, 882, 328),
      reach: px(846, 530, 1010, 630),
      verb: 'Look',
      steps: [[{ lines: ["Quincy's thermos. Still warm.", 'Smells like strong tea and determination.'] }]],
    },
  ],
  ambient: [
    // The CRTs' green glow, never quite steady.
    { type: 'flicker', at: pt(166, 308), tint: 0x9dffb0, size: 50, alpha: 0.2 },
    { type: 'glow', at: pt(612, 262), tint: 0xffb860, size: 44, alpha: 0.28 },
  ],
  // The darkest of the Junction rooms: the locker and the cot must stay readable.
  vignette: 0.3,
  standIn: { floor: 0x3c4148, wall: 0x2c3542, furniture: 0x4f5458 },
};
