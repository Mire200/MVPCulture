import type { GameModeId } from '@mvpc/shared';
import type { GameMode } from './types.js';
import { classicMode } from './modes/classic.js';
import { qcmMode } from './modes/qcm.js';
import { estimationMode } from './modes/estimation.js';
import { listTurnsMode } from './modes/listTurns.js';
import { hotPotatoMode } from './modes/hotPotato.js';
import { speedElimMode } from './modes/speedElim.js';
import { mapMode } from './modes/mapMode.js';
import { chronologyMode } from './modes/chronology.js';
import { guessWhoMode } from './modes/guessWho.js';
import { imposterMode } from './modes/imposter.js';
import { codenamesMode } from './modes/codenames.js';
import { wikiraceMode } from './modes/wikirace.js';
import { garticPhoneMode } from './modes/garticPhone.js';
import { bombpartyMode } from './modes/bombparty.js';
import { ticketToRideMode } from './modes/ticketToRide.js';

export const MODE_REGISTRY: Partial<Record<GameModeId, GameMode>> = {
  classic: classicMode,
  qcm: qcmMode,
  estimation: estimationMode,
  'list-turns': listTurnsMode,
  'hot-potato': hotPotatoMode,
  'speed-elim': speedElimMode,
  map: mapMode,
  chronology: chronologyMode,
  'guess-who': guessWhoMode,
  imposter: imposterMode,
  codenames: codenamesMode,
  wikirace: wikiraceMode,
  'gartic-phone': garticPhoneMode,
  bombparty: bombpartyMode,
  'ticket-to-ride': ticketToRideMode,
};

export function getMode(id: GameModeId): GameMode {
  const mode = MODE_REGISTRY[id];
  if (!mode) throw new Error(`Mode ${id} not implemented`);
  return mode;
}
