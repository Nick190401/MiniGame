import { INTERIOR_ROOM_ART } from '../../assets/InteriorArt';
import { ROOM_HEIGHT, ROOM_WIDTH, doorway, pt, px, type InteriorRoom } from './room';

const LUTE = pt(735, 375);
const GOLD = 0xffd27a;
/** The floor in front of the bench, where the hero walks past the lute. */
const PAST_THE_BENCH = px(428, 610, 1058, 780);

/** The Tuning Barn: an acoustic luthier's workshop, blond planks and green felt. */
export const ECHO_WORKSHOP: InteriorRoom = {
  id: 'echo-workshop',
  art: INTERIOR_ROOM_ART['echo-workshop'],
  // The X-braced barn door sits right of the building's middle.
  door: { landmark: 'landmark-workshop', dx: 11, exitDy: 24 },
  zone: 'Echo Village',
  title: 'Tuning Barn',
  detail: 'Sawdust, varnish and instruments waiting for strings.',
  accent: '#f2c46d',
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  ...doorway([715, 985, 820, 1024], [682, 905, 856, 974]),
  walls: {
    back: px(0, 0, 1536, 292),
    left: px(0, 0, 22, 1024),
    right: px(1512, 0, 1536, 1024),
    nearLeft: px(0, 985, 715, 1024),
    nearRight: px(820, 985, 1536, 1024),
  },
  furniture: [
    // Free-standing; the strip behind its top is closed too.
    px(428, 292, 1058, 610), // workbench island
    px(1133, 145, 1362, 377), // treadle lathe
    px(1388, 80, 1512, 706), // tonewood rack
    px(22, 195, 192, 628), // clamp rack and bending moulds
    px(22, 608, 216, 950), // offcut bin and broom
    px(1325, 692, 1505, 926), // half-built speaker cabinet
  ],
  interactables: [
    {
      id: 'lute',
      object: px(652, 330, 916, 430),
      reach: px(540, 612, 940, 710),
      verb: 'Look',
      // One string for every sound fragment found.
      steps: [[
        {
          when: { fragments: 3 },
          lines: [
            'All three strings are fitted.',
            'The lute hums the moment you come close.',
            'Somebody here is keeping count of your journey.',
          ],
          hooks: [{ type: 'glow', at: LUTE, tint: GOLD, size: 44, mode: 'pulse' }],
        },
        { when: { fragments: 2 }, lines: ['Two strings now. They hum when you walk past.'] },
        { when: { fragments: 1 }, lines: ['One new string has been fitted.', 'Nobody has been in here...'] },
        { lines: ['A lute on the bench, waiting for its strings.', 'Three pegs are empty.'] },
      ]],
    },
    {
      id: 'guitar',
      object: px(995, 45, 1082, 258),
      // The slot between the bench and the lathe barely fits the hero, so the pocket below the lathe counts too.
      reach: px(1060, 294, 1188, 490),
      verb: 'Look',
      steps: [[
        {
          lines: ['A guitar with a paper tag on its neck.', "'K. Vero. New strings. Pay later.'"],
          hooks: [{ type: 'glow', at: pt(1056, 115), tint: 0xfff0c8, size: 14, mode: 'pulse' }],
        },
        {
          when: { seen: ['kian-met'], bossDefeated: false },
          lines: ["Kian's guitar! He'll want it back...", "...once there's something worth playing again."],
          append: true,
        },
        {
          when: { seen: ['kian-met'], bossDefeated: true },
          lines: ["Kian's guitar! Now there's something worth playing.", "Better tell him it's ready."],
          append: true,
        },
      ]],
    },
    {
      id: 'lathe',
      object: px(1133, 145, 1362, 375),
      reach: px(1192, 379, 1362, 490),
      verb: 'Use',
      steps: [[
        {
          when: { bossDefeated: true },
          lines: ['A foot-powered lathe. You give the pedal a push.', 'It spins with a satisfying whirr. Very satisfying.'],
          hooks: [{ type: 'motes', at: pt(1245, 200), tint: 0xf3d9a4, count: 6, dir: 'fall' }],
        },
        {
          lines: [
            'A foot-powered lathe. You give the pedal a push.',
            'It spins with a satisfying whirr.',
            'Well, it would be satisfying if you could hear it.',
          ],
          hooks: [{ type: 'motes', at: pt(1245, 200), tint: 0xf3d9a4, count: 6, dir: 'fall' }],
        },
      ]],
    },
  ],
  // The lute's new strings hum as the hero walks past, louder with every fragment found.
  approach: [
    { reach: PAST_THE_BENCH, when: { fragments: 2 }, hooks: [{ type: 'glow', at: LUTE, tint: GOLD, size: 30, mode: 'pulse', ms: 1600 }] },
    {
      reach: PAST_THE_BENCH,
      when: { fragments: 3 },
      hooks: [
        { type: 'glow', at: LUTE, tint: GOLD, size: 44, mode: 'pulse', ms: 2000 },
        { type: 'motes', at: LUTE, tint: GOLD, count: 4, dir: 'rise' },
      ],
    },
  ],
  ambient: [
    // Dust in the light falling through the plank gaps, upper left.
    { type: 'motes', area: px(120, 60, 420, 560), tint: 0xffe2a0, count: 14, drift: 'hang' },
    // The repair tag is small at phone scale: a faint pulse draws the eye.
    { type: 'glow', at: pt(1056, 115), tint: 0xfff0c8, size: 10, alpha: 0.16, pulseMs: 1800 },
  ],
  vignette: 0.26,
  // Plank walls with gaps: the village is heard more clearly than through stone.
  musicDuck: 0.35,
  standIn: { floor: 0xa2784e, wall: 0x714f31, furniture: 0x62462d },
};
