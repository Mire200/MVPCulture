'use client';
import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';
import { Send, Check } from 'lucide-react';

export function EstimationRound() {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const myId = useGameStore((s) => s.playerId);
  const alreadyAnswered = useGameStore((s) =>
    myId ? s.answeredPlayerIds.has(myId) : false,
  );
  const done = submitted || alreadyAnswered;
  const unit = snapshot.round?.question.unit;

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(parsed) || done) return;
    setSubmitted(true);
    const sock = getSocket();
    sock.emit('round:answer', { numeric: parsed }, (res) => {
      if (!res.ok) {
        setSubmitted(false);
        alert(res.message);
      }
    });
  };

  return (
    <form onSubmit={send} className="panel p-6 space-y-4">
      <label className="text-text-muted text-sm">Ton estimation</label>
      <div className="flex items-center gap-3">
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          className="input text-2xl text-center font-mono"
          value={value}
          disabled={done}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
        />
        {unit && <span className="text-text-muted text-lg shrink-0">{unit}</span>}
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={done || !value.trim()}
        className="btn-primary w-full disabled:opacity-60"
      >
        {done ? (
          <>
            <Check className="w-5 h-5" />
            Estimation envoyée
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            Valider
          </>
        )}
      </motion.button>
      <p className="text-xs text-text-dim">
        Le plus proche de la vraie valeur gagne le plus de points. Pas de bonus de vitesse.
      </p>
    </form>
  );
}
