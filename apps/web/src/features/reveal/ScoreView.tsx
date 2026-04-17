'use client';
import { useGameStore } from '@/store/gameStore';
import { AvatarBadge } from '@/components/AvatarPicker';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, TrendingUp } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { useEffect, useMemo } from 'react';
import { mvpSound } from '@/lib/sound';

export function ScoreView() {
  const snapshot = useGameStore((s) => s.snapshot);
  const scoring = useGameStore((s) => s.scoring);
  const myId = useGameStore((s) => s.playerId);
  const isHost = snapshot && myId && snapshot.hostId === myId;

  const rows = useMemo(() => {
    if (!snapshot || !scoring) return [];
    return snapshot.players
      .map((p) => ({
        player: p,
        delta: scoring.deltas[p.id] ?? 0,
        total: scoring.totals[p.id] ?? p.score,
      }))
      .sort((a, b) => b.total - a.total);
  }, [snapshot, scoring]);

  useEffect(() => {
    mvpSound.whoosh();
  }, []);

  const advance = () => {
    mvpSound.click();
    const sock = getSocket();
    sock.emit('round:advance', () => {});
  };

  const isLastRound = snapshot && snapshot.roundIndex + 1 >= snapshot.totalRounds;

  if (!snapshot || !scoring) return null;

  const medalColors = (idx: number) =>
    idx === 0
      ? 'linear-gradient(135deg, #FBBF24, #F97316)'
      : idx === 1
        ? 'linear-gradient(135deg, #E5E5EC, #8C8CA0)'
        : idx === 2
          ? 'linear-gradient(135deg, #D97757, #8A4422)'
          : 'var(--surface-2)';

  return (
    <main className="min-h-dvh px-4 py-8 max-w-3xl mx-auto space-y-7">
      <div className="text-center space-y-2">
        <div className="chip-cyan mx-auto inline-flex">
          <TrendingUp className="w-3 h-3" />
          Classement · manche {snapshot.roundIndex + 1}
        </div>
        <h2 className="font-display text-gradient text-2xl sm:text-3xl">
          Bonne réponse : {scoring.officialAnswer}
        </h2>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {rows.map(({ player, delta, total }, idx) => (
            <motion.div
              key={player.id}
              layout
              layoutId={`score-${player.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 180,
                damping: 22,
                delay: idx * 0.06,
              }}
              className="panel p-4 flex items-center gap-4"
              style={
                idx === 0
                  ? {
                      borderColor: 'rgba(251,191,36,0.5)',
                      boxShadow: '0 0 28px rgba(251,191,36,0.2)',
                    }
                  : undefined
              }
            >
              <motion.div
                className="font-display flex items-center justify-center font-extrabold shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: medalColors(idx),
                  color: idx <= 2 ? '#1a1005' : 'var(--text-muted)',
                  fontSize: 22,
                }}
                animate={idx === 0 ? { rotate: [0, -4, 4, 0] } : {}}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                {idx + 1}
              </motion.div>
              <AvatarBadge avatar={player.avatar} size="md" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{player.nickname}</div>
                <div className="text-xs text-text-dim">total</div>
              </div>
              <div className="text-right">
                {delta > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.6 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.2 + idx * 0.06, type: 'spring', stiffness: 300 }}
                    className="text-neon-lime font-mono font-bold"
                  >
                    +{delta}
                  </motion.div>
                ) : (
                  <div className="text-text-dim text-xs">+0</div>
                )}
                <motion.div
                  key={total}
                  className="font-display font-extrabold text-2xl"
                  initial={{ scale: 1.2, color: '#A3E635' }}
                  animate={{ scale: 1, color: '#f4f0ff' }}
                  transition={{ duration: 0.6 }}
                >
                  {total}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {isHost ? (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={advance}
          className="btn-primary w-full text-lg py-4"
        >
          {isLastRound ? '🏆 Voir le podium' : 'Manche suivante'}
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      ) : (
        <div className="text-text-muted text-center text-sm">
          En attente de l'hôte…
        </div>
      )}
    </main>
  );
}
