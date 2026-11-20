import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { ROOM_HEIGHT, ROOM_WIDTH, doorway, pt, px, type Hook, type InteriorRoom } from './room';

/** The small signal lamp over the test cabin's padded door. */
const CABIN_LAMP = pt(1303, 155);
/** The grey wax seal on the top patient file. */
const SEAL = pt(219, 259);
const RED = 0xff4a4a;
const GREEN = 0x5dff8a;

/** Three test tones with the beep line, each fainter than the last (the third is meant to be hard to hear). */
const hearingTest = (lamp: number): Hook[] => [
  { type: 'glow', at: CABIN_LAMP, tint: lamp, size: 12, mode: 'pulse', ms: 2000, line: 2 },
  { type: 'sfx', key: 'sfx-ui-click', volume: 0.9, rate: 1.4, delayMs: 200, repeat: 2, intervalMs: 700, fade: 0.4, line: 2 },
];

/** Junction Hearing Clinic: an audiology clinic that measures what the silence took. It tests and records; it does not heal. */
export const JUNCTION_CLINIC: InteriorRoom = {
  id: 'junction-clinic',
  art: INTERIOR_ROOM_ART['junction-clinic'],
  door: { landmark: 'landmark-junction-clinic', dx: 0, exitDy: 24 },
  zone: 'Neon Junction',
  title: 'Junction Hearing Clinic',
  detail: 'Quiet, please. Hearing tests in progress.',
  accent: '#9fd4ff',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([695, 985, 840, 1024], [682, 907, 854, 983]),
  walls: {
    back: px(0, 0, 1536, 292),
    left: px(0, 0, 24, 1024),
    right: px(1510, 0, 1536, 1024),
    nearLeft: px(0, 985, 695, 1024),
    nearRight: px(840, 985, 1536, 1024),
  },
  // The painted potted plant was painted out; its corner is floor the hero cannot reach.
  furniture: [
    px(132, 165, 562, 440), // reception desk, chair and ticket dispenser
    px(740, 180, 882, 424), // giant plaster ear on its pedestal
    px(1100, 35, 1510, 428), // padded test cabin
    px(50, 440, 184, 932), // linked waiting chairs
    px(1248, 535, 1500, 846), // magazine rack and water cooler
  ],
  // Reach zones run about 100 px below what they face: the hero, drawn larger indoors, stops 43 px short of it.
  interactables: [
    {
      id: 'test-cabin',
      object: px(1226, 178, 1388, 425),
      // The end of the blue guide line, in front of the padded door, down to the magazine rack.
      reach: px(1200, 428, 1410, 532),
      verb: 'Use',
      steps: [[
        {
          when: { sfxAudible: false },
          lines: [
            'You step into the padded cabin.',
            'You put on the headphones.',
            'Beep? ...Result: inconclusive.',
            'Is your sound turned off?',
          ],
          hooks: hearingTest(RED),
        },
        {
          when: { bossDefeated: true },
          lines: [
            'You step into the padded cabin.',
            'You put on the headphones.',
            'Beep. Beep. beep.',
            'Result: perfect hearing.',
            'The nurse would be thrilled.',
          ],
          hooks: hearingTest(GREEN),
        },
        {
          lines: [
            'You step into the padded cabin.',
            'You put on the headphones.',
            'Beep. Beep. ...was there a third one?',
            'Result: mildly faded. Like everyone, these days.',
          ],
          hooks: hearingTest(RED),
        },
      ]],
    },
    {
      id: 'patient-files',
      object: px(168, 225, 256, 318),
      reach: px(186, 440, 360, 540),
      verb: 'Read',
      steps: [[
        {
          when: { bossDefeated: true },
          lines: [
            'The grey wax has cracked open. Inside:',
            "'Patient: THE GATEKEEPER.'",
            "'Complaint: everything is too loud.'",
            "'Recommended: listen to something you love. Slowly.'",
          ],
          hooks: [{ type: 'motes', at: SEAL, tint: 0xd8e4ff, count: 5, dir: 'rise' }],
        },
        {
          lines: [
            'A stack of patient files.',
            "'Can't hear the birds.' 'Can't hear the rain.'",
            "'Can't hear myself hum.'",
            'The top folder is sealed with grey wax.',
            'The wax hums faintly.',
          ],
          hooks: [{ type: 'glow', at: SEAL, tint: 0xc4c8dc, size: 10, mode: 'pulse' }],
        },
      ]],
    },
    {
      id: 'giant-ear',
      object: px(765, 180, 880, 350),
      reach: px(740, 424, 882, 524),
      verb: 'Use',
      steps: [[{ lines: ['A giant plaster ear. You lean in and whisper hello.', "It doesn't answer. Rude."] }]],
    },
    {
      id: 'ticket-dispenser',
      object: px(485, 165, 545, 315),
      reach: px(420, 440, 600, 540),
      verb: 'Use',
      steps: [[{
        lines: [
          'You take a number: 47. Now serving: 3.',
          'You put the ticket back.',
          'Nobody needs to wait that long.',
        ],
      }]],
    },
  ],
  ambient: [
    // Red while the world is quiet, green once it can be heard again.
    { type: 'glow', at: CABIN_LAMP, tint: RED, size: 8, alpha: 0.5, pulseMs: 1800, when: { bossDefeated: false } },
    { type: 'glow', at: CABIN_LAMP, tint: GREEN, size: 8, alpha: 0.5, when: { bossDefeated: true } },
  ],
  // Bright and even, as the brief asks; the music stays low so the faintest test tone can be heard.
  vignette: 0.22,
  musicDuck: 0.15,
  standIn: { floor: 0x9fcfbf, wall: 0xe4e4e0, furniture: 0xc4bed6 },
};
