'use client';
import { use, useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getSocket } from '@/lib/socket';
import {
  getAvatar,
  getDefaultNickname,
  getOrCreatePlayerId,
  loadHostToken,
  saveHostToken,
  setAvatar as storeAvatar,
  setNickname as storeNickname,
} from '@/lib/identity';
import type { Avatar } from '@mvpc/shared';
import { IdentityForm } from '@/components/IdentityForm';
import { LobbyView } from '@/features/lobby/LobbyView';
import { RoundView } from '@/features/round/RoundView';
import { RevealView } from '@/features/reveal/RevealView';
import { ScoreView } from '@/features/reveal/ScoreView';
import { FinalView } from '@/features/reveal/FinalView';

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();

  const snapshot = useGameStore((s) => s.snapshot);
  const setRoom = useGameStore((s) => s.setRoom);
  const setSnapshot = useGameStore((s) => s.setSnapshot);
  const playerIdInStore = useGameStore((s) => s.playerId);
  const [mode, setMode] = useState<'loading' | 'identity' | 'ready'>('loading');
  const [initial, setInitial] = useState<{ nickname: string; avatar: Avatar } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getOrCreatePlayerId();
    setInitial({ nickname: getDefaultNickname(), avatar: getAvatar() });

    if (playerIdInStore && snapshot?.code === code) {
      setMode('ready');
      return;
    }

    const sock = getSocket();
    const tryResume = () => {
      const playerId = getOrCreatePlayerId();
      const hostToken = loadHostToken(code);
      sock.emit('room:resume', { code, playerId, hostToken }, (res) => {
        if (res.ok) {
          setRoom(res.data.code, res.data.playerId);
          setSnapshot(res.data.snapshot);
          if (res.data.hostToken) saveHostToken(res.data.code, res.data.hostToken);
          setMode('ready');
        } else if (res.code === 'NOT_IN_ROOM' || res.code === 'ROOM_NOT_FOUND') {
          setMode('identity');
        } else {
          setErr(res.message);
          setMode('identity');
        }
      });
    };

    if (sock.connected) tryResume();
    else sock.once('connect', tryResume);
  }, [code, snapshot?.code, playerIdInStore, setRoom, setSnapshot]);

  const doJoin = async ({ nickname, avatar }: { nickname: string; avatar: Avatar }) => {
    storeNickname(nickname);
    storeAvatar(avatar);
    const sock = getSocket();
    await new Promise<void>((resolve) => {
      if (sock.connected) resolve();
      else sock.once('connect', () => resolve());
    });
    sock.emit(
      'room:join',
      { code, nickname, avatar, playerId: getOrCreatePlayerId() },
      (res) => {
        if (!res.ok) {
          setErr(res.message);
          return;
        }
        setRoom(res.data.code, res.data.playerId);
        setSnapshot(res.data.snapshot);
        setMode('ready');
      },
    );
  };

  if (mode === 'loading' || !initial) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="text-text-muted animate-pulse">Connexion…</div>
      </main>
    );
  }

  if (mode === 'identity') {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 space-y-4">
        {err && (
          <div className="text-neon-magenta text-sm bg-neon-magenta/10 border border-neon-magenta/30 rounded-xl px-4 py-2">
            {err}
          </div>
        )}
        <IdentityForm
          title={`Rejoindre ${code}`}
          submitLabel="Rejoindre le salon"
          initialNickname={initial.nickname}
          initialAvatar={initial.avatar}
          onSubmit={doJoin}
        />
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="text-text-muted animate-pulse">Chargement du salon…</div>
      </main>
    );
  }

  return <RoomContent />;
}

function RoomContent() {
  const snapshot = useGameStore((s) => s.snapshot)!;
  switch (snapshot.phase) {
    case 'lobby':
      return <LobbyView />;
    case 'round_prepare':
    case 'round_ask':
    case 'round_collect':
      return <RoundView />;
    case 'round_reveal':
      return <RevealView />;
    case 'round_score':
      return <ScoreView />;
    case 'match_final':
      return <FinalView />;
    default:
      return <LobbyView />;
  }
}
