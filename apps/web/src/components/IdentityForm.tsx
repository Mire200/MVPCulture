'use client';
import { useState } from 'react';
import { AvatarBadge, AvatarPicker } from './AvatarPicker';
import { randomAvatar, randomNickname } from '@/lib/avatars';
import type { Avatar } from '@mvpc/shared';
import { Shuffle } from 'lucide-react';

export function IdentityForm({
  initialNickname,
  initialAvatar,
  onSubmit,
  submitLabel,
  title,
}: {
  initialNickname: string;
  initialAvatar: Avatar;
  onSubmit: (data: { nickname: string; avatar: Avatar }) => void | Promise<void>;
  submitLabel: string;
  title: string;
}) {
  const [nickname, setNickname] = useState(initialNickname || randomNickname());
  const [avatar, setAvatar] = useState<Avatar>(initialAvatar);
  const [loading, setLoading] = useState(false);

  const shuffle = () => {
    setNickname(randomNickname());
    setAvatar(randomAvatar());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ nickname: nickname.trim().slice(0, 20), avatar });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel p-8 w-full max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <AvatarBadge avatar={avatar} size="xl" />
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <p className="text-text-muted text-sm">Choisis un pseudo et un avatar stylé.</p>
        </div>
        <button type="button" onClick={shuffle} className="btn-ghost" title="Aléatoire">
          <Shuffle className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-text-muted">Pseudo</label>
        <input
          autoFocus
          className="input text-lg"
          value={nickname}
          maxLength={20}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Ton pseudo"
        />
      </div>

      <AvatarPicker value={avatar} onChange={setAvatar} />

      <button
        type="submit"
        disabled={loading || !nickname.trim()}
        className="btn-primary w-full text-lg py-4 disabled:opacity-60"
      >
        {loading ? 'Connexion…' : submitLabel}
      </button>
    </form>
  );
}
