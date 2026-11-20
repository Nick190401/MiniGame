import { OVERWORLD_LANDMARKS } from '../PokemonOverworld';
import type { InteriorRoomId } from '../../assets/InteriorArt';
import type { InteriorRoom } from './room';
import { SOUND_LAB } from './soundLab';
import { ECHO_COTTAGE } from './echoCottage';
import { ECHO_CLINIC } from './echoClinic';
import { ECHO_INN } from './echoInn';
import { ECHO_WORKSHOP } from './echoWorkshop';
import { BROOK_RIVERSIDE_HUT } from './brookRiversideHut';
import { JUNCTION_SIGNAL_STATION } from './junctionSignalStation';
import { JUNCTION_INN } from './junctionInn';
import { JUNCTION_CLINIC } from './junctionClinic';
import { JUNCTION_WORKSHOP } from './junctionWorkshop';
import { JUNCTION_GUARD_POST } from './junctionGuardPost';
import { GROVE_ARCHIVE_SHRINE } from './groveArchiveShrine';
import { GROVE_RANGER_HUT } from './groveRangerHut';

const TILE = 16;

/** Every building that can be entered, by room id. */
export const INTERIOR_ROOMS: Readonly<Record<InteriorRoomId, InteriorRoom>> = {
  'sound-lab': SOUND_LAB,
  'echo-cottage': ECHO_COTTAGE,
  'echo-clinic': ECHO_CLINIC,
  'echo-inn': ECHO_INN,
  'echo-workshop': ECHO_WORKSHOP,
  'brook-riverside-hut': BROOK_RIVERSIDE_HUT,
  'junction-signal-station': JUNCTION_SIGNAL_STATION,
  'junction-inn': JUNCTION_INN,
  'junction-clinic': JUNCTION_CLINIC,
  'junction-workshop': JUNCTION_WORKSHOP,
  'junction-guard-post': JUNCTION_GUARD_POST,
  'grove-archive-shrine': GROVE_ARCHIVE_SHRINE,
  'grove-ranger-hut': GROVE_RANGER_HUT,
};

export interface InteriorDoor {
  room: InteriorRoomId;
  /** The door's middle, where it meets the ground (the building's foot line). */
  x: number;
  y: number;
  /** Where the hero stands after coming out. */
  exitY: number;
}

/**
 * Every front door in the overworld, derived from the landmark stamps, so a
 * door follows its building if the stamp moves. The world editor only
 * repaints the tile grid, never the stamps.
 */
export function interiorDoors(): InteriorDoor[] {
  return Object.values(INTERIOR_ROOMS).flatMap((room) => {
    const building = OVERWORLD_LANDMARKS.find(landmark => landmark.texture === room.door.landmark);
    if (!building) return [];
    const y = (building.row + building.height) * TILE;
    return [{ room: room.id, x: (building.col + building.width / 2) * TILE + room.door.dx, y, exitY: y + room.door.exitDy }];
  });
}
