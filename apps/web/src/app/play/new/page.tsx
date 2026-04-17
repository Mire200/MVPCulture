'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IdentityForm } from '@/components/IdentityForm';
import { getAvatar, getDefaultNickname, saveHostToken, setAvatar as storeAvatar, setNickname as storeNickname, getOrCreatePlayerId } from '@/lib/identity';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import type { Avatar } from '@mvpc/shared';

export default function NewRoomPage() {
  const router = useRouter();
  const setRoom = useGameStore((s) => s.setRoom);
  const setSnapshot = useGameStore((s) => s.setSnapshot);
  const [initial, setInitial] = useState<{ nickname: string; avatar: Avatar } | null>(null);

  useEffect(() => {
    getOrCreatePlayerId();
    setInitial({ nickname: getDefaultNickname(), avatar: getAvatar() });
  }, []);

  if (!initial) return null;

  const handleCreate = async ({ nickname, avatar }: { nickname: string; avatar: Avatar }) => {
    storeNickname(nickname);
    storeAvatar(avatar);
    const sock = getSocket();
    await new Promise<void>((resolve) => {
      const start = () => resolve();
      if (sock.connected) start();
      else sock.once('connect', start);
    });
    sock.emit('room:create', { nickname, avatar, playerId: getOrCreatePlayerId() }, (res) => {
      if (!res.ok) {
        alert(`Erreur: ${res.message}`);
        return;
      }
      saveHostToken(res.data.code, res.data.hostToken);
      setRoom(res.data.code, res.data.playerId);
      setSnapshot(res.data.snapshot);
      router.push(`/r/${res.data.code}`);
    });
  };

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <IdentityForm
        title="Créer un salon"
        submitLabel="Créer le salon"
        initialNickname={initial.nickname}
        initialAvatar={initial.avatar}
        onSubmit={handleCreate}
      />
    </main>
  );
}
