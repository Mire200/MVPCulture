'use client';
import { useGameStore } from '@/store/gameStore';
import { ClassicRound } from './ClassicRound';
import { QcmRound } from './QcmRound';
import { EstimationRound } from './EstimationRound';
import { ListTurnsRound } from './ListTurnsRound';
import { HotPotatoRound } from './HotPotatoRound';
import { SpeedElimRound } from './SpeedElimRound';
import { MapRound } from './MapRound';
import { ChronologyRound } from './ChronologyRound';
import { GuessWhoRound } from './GuessWhoRound';
import { ImposterRound } from './ImposterRound';
import { CodenamesRound } from './CodenamesRound';
import { RoundShell } from './RoundShell';

export function RoundView() {
  const snapshot = useGameStore((s) => s.snapshot);
  if (!snapshot || !snapshot.round) return null;
  const mode = snapshot.round.mode;

  return (
    <RoundShell>
      {mode === 'classic' && <ClassicRound />}
      {mode === 'qcm' && <QcmRound />}
      {mode === 'estimation' && <EstimationRound />}
      {mode === 'list-turns' && <ListTurnsRound />}
      {mode === 'hot-potato' && <HotPotatoRound />}
      {mode === 'speed-elim' && <SpeedElimRound />}
      {mode === 'map' && <MapRound />}
      {mode === 'chronology' && <ChronologyRound />}
      {mode === 'guess-who' && <GuessWhoRound />}
      {mode === 'imposter' && <ImposterRound />}
      {mode === 'codenames' && <CodenamesRound />}
    </RoundShell>
  );
}
