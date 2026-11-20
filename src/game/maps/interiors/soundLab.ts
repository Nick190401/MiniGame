import { SOUND_LAB_ROOM_ART } from '../../assets/InteriorArt';
import { SOUND_LAB_ROOM } from '../SoundLabRoom';
import type { InteriorRoom } from './room';

const { door, note } = SOUND_LAB_ROOM;

/** The Sound Lab: a dusty, abandoned recording studio (layout in SoundLabRoom.ts, look in art/soundLabArt.ts). */
export const SOUND_LAB: InteriorRoom = {
  id: 'sound-lab',
  art: SOUND_LAB_ROOM_ART,
  door: { landmark: 'landmark-professor-lab', dx: 0, exitDy: 24 },
  zone: 'Echo Village',
  title: 'Sound Lab',
  detail: 'Dust on every fader. Nobody has recorded here in a long time.',
  accent: '#9ff0ff',
  width: SOUND_LAB_ROOM.width,
  height: SOUND_LAB_ROOM.height,
  spawn: SOUND_LAB_ROOM.spawn,
  exit: { zone: door.zone, stepOutY: door.stepOutY, label: door.label },
  walls: SOUND_LAB_ROOM.walls,
  furniture: Object.values(SOUND_LAB_ROOM.furniture),
  interactables: [{
    id: 'note',
    object: note.paper,
    reach: note.reach,
    verb: 'Read',
    label: note.label,
    // Pinned to the music stand, in Professor Krys's hand.
    note: {
      title: 'Studio closed.',
      lines: [
        'Nobody has recorded here since the Gatekeeper took the Lost Track.',
        'Every take since comes back as hiss, and the world outside grows a little quieter each day.',
        'I covered the desk and left the tapes where they lie.',
      ],
      signature: '— Krys, last engineer on duty',
      postscript: { when: { bossDefeated: true }, text: 'P.S. The silence has lifted. I swear I heard the desk hum. — K.' },
    },
  }],
};
