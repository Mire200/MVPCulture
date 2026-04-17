'use client';
import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';
import { Zap, Check } from 'lucide-react';

export function SpeedElimRound() {
  const myId = useGameStore((s) => s.playerId);
  const alreadyAnswered = useGameStore((s) => (myId ? s.answeredPlayerIds.has(myId) : false));
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    const socket = getSocket();
    socket.emit('round:answer', { text: value.trim() }, (res) => {
      if (!res.ok) {
        setSubmitted(false);
        alert(res.message);
      }
    });
  };

  const done = submitted || alreadyAnswered;

  return (
    <form onSubmit={send} className="panel p-6 space-y-4 ring-2 ring-accent-amber/30">
      <div className="flex items-center gap-2 text-accent-amber">
        <Zap className="w-5 h-5" />
        <span className="font-semibold">Rapidité — le plus lent perd.</span>
      </div>
      <input
        ref={inputRef}
        className="input text-xl"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={done}
        maxLength={120}
        placeholder="Réponds vite !"
      />
      <motion.button
        whileTap={{ scale: 0.95 }}
        type="submit"
        disabled={done || !value.trim()}
        className="btn-primary w-full disabled:opacity-60"
      >
        {done ? (
          <>
            <Check className="w-5 h-5" /> Envoyé !
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" /> GO !
          </>
        )}
      </motion.button>
      <p className="text-xs text-text-dim">Plus tu réponds vite et juste, plus tu marques.</p>
    </form>
  );
}
