'use client';
import { useGameStore } from '@/store/gameStore';
import { AvatarBadge } from '@/components/AvatarPicker';
import { motion } from 'framer-motion';
import { Repeat } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { useEffect } from 'react';
import { mvpConfetti } from '@/lib/confetti';
import { mvpSound } from '@/lib/sound';

export function FinalView() {
  const snapshot = useGameStore((s) => s.snapshot);
  const final = useGameStore((s) => s.finalStandings);
  const myId = useGameStore((s) => s.playerId);
  const isHost = snapshot && myId && snapshot.hostId === myId;

  const standings =
    final ?? (snapshot ? [...snapshot.players].sort((a, b) => b.score - a.score) : []);
  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);

  const visualOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as NonNullable<
    (typeof top3)[number]
  >[];
  const tiers: Array<'silver' | 'gold' | 'bronze'> = ['silver', 'gold', 'bronze'];
  const ranks = [2, 1, 3];
  const delays = [0.5, 0.9, 0.7];

  useEffect(() => {
    const t1 = setTimeout(() => {
      mvpSound.fanfare();
      mvpConfetti.cannon();
    }, 400);
    const t2 = setTimeout(() => mvpConfetti.shower(), 1400);
    const t3 = setTimeout(() => mvpConfetti.cannon(), 2400);
    const loop = setInterval(() => mvpConfetti.shower(), 4500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(loop);
    };
  }, []);

  const rematch = () => {
    mvpSound.click();
    const sock = getSocket();
    sock.emit('match:rematch', () => {});
  };

  if (!standings.length) return null;

  return (
    <main className="min-h-dvh px-4 py-8 max-w-4xl mx-auto">
      <motion.div
        className="chip-amber mx-auto mb-4 inline-flex"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        ♔ PARTIE TERMINÉE
      </motion.div>
      <motion.h1
        className="font-display text-gradient chroma text-center font-extrabold leading-none"
        style={{ fontSize: 'clamp(42px, 7vw, 72px)', letterSpacing: '-0.01em' }}
        initial={{ opacity: 0, y: 20, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 16 }}
      >
        {top3[0]?.nickname} gagne !
      </motion.h1>

      <div
        className="flex items-end justify-center gap-5 my-10 relative"
        style={{ minHeight: 340 }}
      >
        {visualOrder.map((p, i) => {
          if (!p) return null;
          return (
            <motion.div
              key={p.id}
              className="podium-col"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: delays[i], type: 'spring', stiffness: 120, damping: 18 }}
            >
              {ranks[i] === 1 && (
                <motion.div
                  className="absolute pointer-events-none"
                  style={{
                    top: -200,
                    width: 220,
                    height: 420,
                    background:
                      'conic-gradient(from 180deg at 50% 0, transparent 160deg, rgba(251,191,36,0.25) 180deg, transparent 200deg)',
                    zIndex: -1,
                  }}
                  animate={{ rotate: [-5, 5, -5] }}
                  transition={{ duration: 4, repeat: Infinity }}
                />
              )}
              <motion.div
                animate={ranks[i] === 1 ? { y: [0, -8, 0] } : {}}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                <AvatarBadge avatar={p.avatar} size="xl" pulse />
              </motion.div>
              <div className="font-semibold truncate max-w-[160px] text-center">
                {p.nickname}
              </div>
              <div className="font-mono text-text-muted text-sm">{p.score} pts</div>
              <div className={`podium-block ${tiers[i]}`}>#{ranks[i]}</div>
            </motion.div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <div className="flex gap-2 justify-center flex-wrap mb-8">
          {rest.map((p, i) => (
            <motion.div
              key={p.id}
              className="chip"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 + i * 0.08 }}
              style={{ padding: '8px 14px', textTransform: 'none', letterSpacing: 0, fontSize: 13 }}
            >
              <span className="text-text-dim mr-1">#{i + 4}</span>
              <AvatarBadge avatar={p.avatar} size="xs" />
              <span className="ml-1 text-text">{p.nickname}</span>
              <span className="ml-2 font-mono text-neon-cyan">{p.score}</span>
            </motion.div>
          ))}
        </div>
      )}

      {isHost ? (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={rematch}
          className="btn-primary mx-auto block text-lg py-4"
          style={{ maxWidth: 340, width: '100%' }}
        >
          <Repeat className="w-5 h-5" />
          Rejouer une partie
        </motion.button>
      ) : (
        <div className="text-text-muted text-center text-sm">
          En attente de l'hôte pour la revanche…
        </div>
      )}
    </main>
  );
}
