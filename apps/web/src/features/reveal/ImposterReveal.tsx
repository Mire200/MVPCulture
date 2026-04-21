'use client';
import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Sparkles,
  UserX,
  Vote as VoteIcon,
  X,
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { AvatarBadge } from '@/components/AvatarPicker';
import { getSocket } from '@/lib/socket';
import { mvpConfetti } from '@/lib/confetti';
import { mvpSound } from '@/lib/sound';
import { cn } from '@/lib/cn';

export function ImposterReveal() {
  const snapshot = useGameStore((s) => s.snapshot);
  const reveal = useGameStore((s) => s.reveal);
  const myId = useGameStore((s) => s.playerId);

  const round = snapshot?.round;
  const question = reveal?.question;

  const imposter = useMemo(() => {
    if (!snapshot || !round?.imImposterId) return undefined;
    return snapshot.players.find((p) => p.id === round.imImposterId);
  }, [snapshot, round]);

  useEffect(() => {
    if (!round) return;
    mvpSound.bigReveal();
    const demasque = round.imDemasque;
    if (demasque) {
      mvpConfetti.burst({ count: 80, velocity: 22 });
    }
  }, [round?.imImposterId, round?.imDemasque]);

  if (!snapshot || !reveal || !question || !round) return null;

  const isHost = snapshot.hostId === myId;
  const civilianWord = (question as any).civilianWord as string | undefined;
  const imposterWord = (question as any).imposterWord as string | undefined;
  const demasque = !!round.imDemasque;
  const guess = round.imGuess;
  const guessCorrect = !!round.imGuessCorrect;
  const tally = round.imVoteTally ?? {};
  const clues0 = round.imClues?.[0] ?? {};
  const clues1 = round.imClues?.[1] ?? {};

  const outcomeLabel = !demasque
    ? 'Imposteur introuvable — il s’échappe avec les points !'
    : guessCorrect
      ? 'Démasqué mais il a deviné le mot — demi-victoire'
      : 'Imposteur démasqué et bredouille !';
  const outcomeColor = !demasque
    ? 'chip-magenta'
    : guessCorrect
      ? 'chip-amber'
      : 'chip-lime';

  const advance = () => {
    mvpSound.click();
    const sock = getSocket();
    sock.emit('round:advance', () => {});
  };

  return (
    <main className="min-h-dvh px-4 py-6 max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-3">
        <div className="chip-magenta mx-auto inline-flex">◉ RÉVÉLATION</div>
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl sm:text-3xl leading-snug"
        >
          Mot de l’imposteur
        </motion.h2>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 16 }}
        className="panel p-6 sm:p-8 text-center space-y-4 ring-magenta"
      >
        <div className="flex items-center justify-center gap-2">
          <UserX className="w-5 h-5 text-neon-rose" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-text-dim">
            L’imposteur était
          </span>
        </div>
        {imposter ? (
          <motion.div
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            className="flex flex-col items-center gap-2"
          >
            <AvatarBadge avatar={imposter.avatar} size="xl" pulse />
            <div className="font-display text-3xl font-extrabold text-neon-rose">
              {imposter.nickname}
            </div>
          </motion.div>
        ) : (
          <div className="text-text-muted italic">inconnu</div>
        )}
        <div className={`${outcomeColor} mx-auto inline-flex`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          {outcomeLabel}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="panel p-4 space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-text-dim">
            Mot des civils
          </div>
          <div
            className="font-display font-extrabold text-neon-cyan leading-none"
            style={{ fontSize: 'clamp(22px, 3.5vw, 30px)' }}
          >
            {civilianWord ?? '—'}
          </div>
        </div>
        <div className="panel p-4 space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-text-dim">
            Mot de l’imposteur
          </div>
          <div
            className="font-display font-extrabold text-neon-rose leading-none"
            style={{ fontSize: 'clamp(22px, 3.5vw, 30px)' }}
          >
            {imposterWord ?? '—'}
          </div>
        </div>
      </div>

      {demasque && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            'panel p-5 space-y-2 text-center',
            guessCorrect ? 'ring-lime' : 'ring-magenta',
          )}
        >
          <div className="text-[10px] uppercase tracking-widest text-text-dim">
            Tentative finale de l’imposteur
          </div>
          <div className="flex items-center justify-center gap-3">
            <span
              className={cn(
                'font-display text-2xl font-bold',
                guessCorrect ? 'text-neon-lime' : 'text-neon-rose',
              )}
            >
              {guess || '— rien proposé —'}
            </span>
            {guess && (
              guessCorrect ? (
                <Check className="w-6 h-6 text-neon-lime" />
              ) : (
                <X className="w-6 h-6 text-neon-rose" />
              )
            )}
          </div>
        </motion.div>
      )}

      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <VoteIcon className="w-4 h-4 text-neon-magenta" />
          <div className="font-display text-lg">Répartition des votes</div>
        </div>
        <div className="space-y-2">
          <AnimatePresence>
            {snapshot.players
              .map((p) => ({ p, count: tally[p.id] ?? 0 }))
              .sort((a, b) => b.count - a.count)
              .map(({ p, count }) => {
                const isImposter = p.id === round.imImposterId;
                const max = Math.max(1, ...Object.values(tally));
                const pct = Math.round((count / max) * 100);
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3"
                  >
                    <AvatarBadge avatar={p.avatar} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold truncate">
                          {p.nickname}
                          {isImposter && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-neon-rose">
                              imposteur
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-muted">
                          {count} vote{count > 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-bg-soft mt-1 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className={
                            isImposter ? 'h-full bg-neon-rose' : 'h-full bg-neon-violet'
                          }
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-neon-lime" />
          <div className="font-display text-lg">Tous les indices</div>
        </div>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-2 text-sm">
          <div />
          <div className="text-[10px] uppercase tracking-wider text-text-dim">Tour 1</div>
          <div className="text-[10px] uppercase tracking-wider text-text-dim">Tour 2</div>
          {snapshot.players.map((p) => {
            const isImposter = p.id === round.imImposterId;
            return (
              <div key={`row-${p.id}`} className="contents">
                <div className="flex items-center gap-2 min-w-0">
                  <AvatarBadge avatar={p.avatar} size="xs" />
                  <span
                    className={cn(
                      'truncate text-xs font-semibold',
                      isImposter && 'text-neon-rose',
                    )}
                  >
                    {p.nickname}
                  </span>
                </div>
                <div
                  className={cn(
                    'px-2 py-1 rounded-md text-xs',
                    isImposter
                      ? 'bg-neon-rose/10 text-neon-rose'
                      : 'bg-surface-2 text-text',
                  )}
                >
                  {clues0[p.id] || '—'}
                </div>
                <div
                  className={cn(
                    'px-2 py-1 rounded-md text-xs',
                    isImposter
                      ? 'bg-neon-rose/10 text-neon-rose'
                      : 'bg-surface-2 text-text',
                  )}
                >
                  {clues1[p.id] || '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isHost ? (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={advance}
          className="btn-primary w-full text-lg py-4"
        >
          Calculer les scores
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      ) : (
        <div className="text-text-muted text-sm text-center py-2">
          En attente de l’hôte pour passer au score…
        </div>
      )}
    </main>
  );
}
