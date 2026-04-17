'use client';
import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';
import { Send, Check } from 'lucide-react';

export function ClassicRound() {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const myId = useGameStore((s) => s.playerId);
  const alreadyAnswered = useGameStore((s) =>
    myId ? s.answeredPlayerIds.has(myId) : false,
  );

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    const sock = getSocket();
    sock.emit('round:answer', { text: value.trim() }, (res) => {
      if (!res.ok) {
        setSubmitted(false);
        alert(res.message);
      }
    });
  };

  const done = submitted || alreadyAnswered;

  return (
    <form onSubmit={send} className="panel p-6 space-y-4">
      <label className="text-text-muted text-sm">Ta réponse</label>
      <input
        autoFocus
        className="input text-xl"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={done}
        maxLength={200}
        placeholder="Écris ta réponse et valide…"
      />
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={done || !value.trim()}
        className="btn-primary w-full disabled:opacity-60"
      >
        {done ? (
          <>
            <Check className="w-5 h-5" />
            Réponse envoyée — en attente des autres
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            Valider
          </>
        )}
      </motion.button>
      <p className="text-xs text-text-dim">
        La vitesse ne compte pas : prends le temps de bien répondre. L'hôte validera les réponses libres à la révélation.
      </p>
    </form>
  );
}
