'use client';
import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarBadge } from '@/components/AvatarPicker';
import { Send, Flame } from 'lucide-react';

export function ListTurnsRound() {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const myId = useGameStore((s) => s.playerId);
  const eliminations = useGameStore((s) => s.eliminations);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);

  const currentId = snapshot.round?.currentPlayerId;
  const current = snapshot.players.find((p) => p.id === currentId);
  const isMyTurn = currentId === myId;
  const iAmEliminated = eliminations.some((e) => e.playerId === myId);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMyTurn || !value.trim() || pending) return;
    setPending(true);
    const sock = getSocket();
    const text = value.trim();
    setValue('');
    sock.emit('round:answer', { listItem: text }, (res) => {
      setPending(false);
      if (!res.ok) {
        alert(res.message);
      }
    });
  };

  return (
    <div className="space-y-4">
      <motion.div
        animate={{ borderColor: isMyTurn ? '#A855F7' : '#2A2A3F' }}
        className="panel p-6 border-2 text-center"
      >
        {current && (
          <div className="flex items-center justify-center gap-3 mb-4">
            <AvatarBadge avatar={current.avatar} size="lg" />
            <div className="text-left">
              <div className="text-text-muted text-xs uppercase tracking-widest">
                C'est au tour de
              </div>
              <div className="font-display text-2xl font-bold">{current.nickname}</div>
            </div>
          </div>
        )}
        {isMyTurn && !iAmEliminated && (
          <form onSubmit={send} className="flex items-center gap-2 max-w-md mx-auto">
            <input
              autoFocus
              className="input text-lg text-center"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Cite un élément…"
              disabled={pending}
            />
            <button type="submit" className="btn-primary" disabled={pending || !value.trim()}>
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
        {!isMyTurn && !iAmEliminated && (
          <p className="text-text-muted">Patience… attends ton tour.</p>
        )}
        {iAmEliminated && (
          <div className="text-neon-magenta flex items-center justify-center gap-2">
            <Flame className="w-4 h-4" />
            Tu es éliminé. Regarde les autres continuer !
          </div>
        )}
      </motion.div>

      <div className="panel p-4">
        <div className="text-xs text-text-muted mb-2 uppercase tracking-widest">Éliminations</div>
        <AnimatePresence>
          {eliminations.length === 0 && (
            <div className="text-text-dim text-sm py-2">Aucun éliminé pour l'instant.</div>
          )}
          {eliminations.map((e, i) => {
            const p = snapshot.players.find((pp) => pp.id === e.playerId);
            if (!p) return null;
            const reasonLabel =
              e.reason === 'duplicate'
                ? 'doublon'
                : e.reason === 'invalid'
                  ? 'réponse invalide'
                  : 'temps écoulé';
            return (
              <motion.div
                key={`${e.playerId}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 py-1.5"
              >
                <AvatarBadge avatar={p.avatar} size="sm" />
                <span className="font-semibold">{p.nickname}</span>
                <span className="text-text-muted text-sm">— {reasonLabel}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
