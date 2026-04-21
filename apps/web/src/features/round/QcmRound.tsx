'use client';
import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export function QcmRound() {
  const round = useGameStore((s) => s.snapshot?.round);
  const myId = useGameStore((s) => s.playerId);
  const alreadyAnswered = useGameStore((s) =>
    myId ? s.answeredPlayerIds.has(myId) : false,
  );

  const [picked, setPicked] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const choices = round?.question.choices ?? [];
  const done = picked !== null || alreadyAnswered;

  const pick = (choice: string) => {
    if (done || sending) return;
    setSending(true);
    setPicked(choice);
    const sock = getSocket();
    sock.emit('round:answer', { text: choice }, (res) => {
      setSending(false);
      if (!res.ok) {
        setPicked(null);
        alert(res.message);
      }
    });
  };

  if (choices.length === 0) {
    return (
      <div className="panel p-6 text-text-muted">
        Chargement des choix…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((choice, idx) => {
          const isPicked = picked === choice;
          const letter = LETTERS[idx] ?? String(idx + 1);
          return (
            <motion.button
              key={choice}
              type="button"
              whileTap={{ scale: done ? 1 : 0.97 }}
              whileHover={done ? undefined : { y: -2 }}
              disabled={done}
              onClick={() => pick(choice)}
              className={`panel text-left p-4 sm:p-5 flex items-center gap-4 transition border-2 ${
                isPicked
                  ? 'border-neon-lime ring-lime'
                  : 'border-transparent hover:border-neon-cyan/60'
              } ${done && !isPicked ? 'opacity-60' : ''}`}
            >
              <div
                className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-display text-lg ${
                  isPicked
                    ? 'bg-neon-lime text-black'
                    : 'bg-bg-elevated border border-border text-text-muted'
                }`}
              >
                {letter}
              </div>
              <div className="text-lg leading-snug">{choice}</div>
              {isPicked && (
                <div className="ml-auto chip-lime shrink-0">
                  <Check className="w-3 h-3" />
                  Choisi
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <p className="text-xs text-text-dim text-center">
        {done
          ? 'Réponse envoyée — en attente des autres.'
          : 'Un seul choix possible. La vraie réponse se révélera à la fin du tour.'}
      </p>
    </div>
  );
}
