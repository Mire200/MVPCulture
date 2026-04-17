'use client';
import { useEffect } from 'react';
import { getSocket } from './socket';
import { useGameStore } from '@/store/gameStore';
import { saveHostToken } from './identity';

/**
 * Monte une seule fois au layout client et relie les events Socket.IO au store Zustand.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const setConnected = useGameStore((s) => s.setConnected);
  const setSnapshot = useGameStore((s) => s.setSnapshot);
  const setReveal = useGameStore((s) => s.setReveal);
  const setScoring = useGameStore((s) => s.setScoring);
  const setFinalStandings = useGameStore((s) => s.setFinalStandings);
  const resetRoundLocal = useGameStore((s) => s.resetRoundLocal);
  const markAnswered = useGameStore((s) => s.markPlayerAnswered);
  const pushElim = useGameStore((s) => s.pushElimination);
  const setHostValidations = useGameStore((s) => s.setHostValidations);
  const setError = useGameStore((s) => s.setError);

  useEffect(() => {
    const sock = getSocket();
    const onConn = () => setConnected(true);
    const onDisc = () => setConnected(false);

    sock.on('connect', onConn);
    sock.on('disconnect', onDisc);
    if (sock.connected) onConn();

    sock.on('room:state', (snapshot) => {
      setSnapshot(snapshot);
      if (snapshot.phase === 'round_collect') {
        // round started / in progress : nothing automatic
      }
    });
    sock.on('round:started', (snapshot) => {
      resetRoundLocal();
      setSnapshot(snapshot);
    });
    sock.on('round:reveal', (reveal) => {
      setReveal(reveal);
    });
    sock.on('round:player_answered', ({ playerId }) => {
      markAnswered(playerId);
    });
    sock.on('round:eliminated', ({ playerId, reason }) => {
      pushElim({ playerId, reason });
    });
    sock.on('round:turn_started', () => {
      // snapshot is updated alongside
    });
    sock.on('round:validated', ({ validations }) => {
      setHostValidations(validations);
    });
    sock.on('round:scored', (scoring) => {
      setScoring(scoring);
    });
    sock.on('match:final', ({ standings }) => {
      setFinalStandings(standings);
    });
    sock.on('error', (err) => setError(err));

    return () => {
      sock.off('connect', onConn);
      sock.off('disconnect', onDisc);
      sock.off('room:state');
      sock.off('round:started');
      sock.off('round:reveal');
      sock.off('round:player_answered');
      sock.off('round:eliminated');
      sock.off('round:turn_started');
      sock.off('round:validated');
      sock.off('round:scored');
      sock.off('match:final');
      sock.off('error');
    };
  }, [
    setConnected,
    setSnapshot,
    setReveal,
    setScoring,
    setFinalStandings,
    resetRoundLocal,
    markAnswered,
    pushElim,
    setHostValidations,
    setError,
  ]);

  // Save host token if we receive one via create ack (handled in the page using the socket directly).
  void saveHostToken;

  return <>{children}</>;
}
