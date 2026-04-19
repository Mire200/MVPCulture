import type { GameModeId } from '@mvpc/shared';
import type { GameMode } from './types.js';
import { classicMode } from './modes/classic.js';
import { estimationMode } from './modes/estimation.js';
import { listTurnsMode } from './modes/listTurns.js';
import { hotPotatoMode } from './modes/hotPotato.js';
import { speedElimMode } from './modes/speedElim.js';
import { mapMode } from './modes/mapMode.js';
import { chronologyMode } from './modes/chronology.js';
import { guessWhoMode } from './modes/guessWho.js';

export const MODE_REGISTRY: Partial<Record<GameModeId, GameMode>> = {
  classic: classicMode,
  estimation: estimationMode,
  'list-turns': listTurnsMode,
  'hot-potato': hotPotatoMode,
  'speed-elim': speedElimMode,
  map: mapMode,
  chronology: chronologyMode,
  'guess-who': guessWhoMode,
};

export function getMode(id: GameModeId): GameMode {
  const mode = MODE_REGISTRY[id];
  if (!mode) throw new Error(`Mode ${id} not implemented`);
  return mode;
}
