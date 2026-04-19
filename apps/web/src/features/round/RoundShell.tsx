'use client';
import { useGameStore } from '@/store/gameStore';
import { AvatarBadge } from '@/components/AvatarPicker';
import { motion } from 'framer-motion';
import { Flame, Sparkles, Zap, MapPin, Hourglass, Dices, HelpCircle } from 'lucide-react';
import { Timer } from '@/components/Timer';

type ChipVariant = 'cyan' | 'magenta' | 'violet' | 'lime' | 'amber';

const MODE_META: Record<
  string,
  { label: string; chip: ChipVariant; icon: React.ReactNode }
> = {
  classic: { label: 'Question ouverte', chip: 'cyan', icon: <Sparkles className="w-3.5 h-3.5" /> },
  estimation: { label: 'Estimation', chip: 'magenta', icon: <Dices className="w-3.5 h-3.5" /> },
  'list-turns': { label: 'Liste tour par tour', chip: 'violet', icon: <Flame className="w-3.5 h-3.5" /> },
  'hot-potato': { label: 'Patate chaude', chip: 'magenta', icon: <Flame className="w-3.5 h-3.5" /> },
  'speed-elim': { label: 'Rapidité', chip: 'cyan', icon: <Zap className="w-3.5 h-3.5" /> },
  map: { label: 'Carte', chip: 'cyan', icon: <MapPin className="w-3.5 h-3.5" /> },
  chronology: { label: 'Chronologie', chip: 'violet', icon: <Hourglass className="w-3.5 h-3.5" /> },
  'guess-who': { label: 'Qui est-ce ?', chip: 'amber', icon: <HelpCircle className="w-3.5 h-3.5" /> },
};

export function RoundShell({ children }: { children: React.ReactNode }) {
  const snapshot = useGameStore((s) => s.snapshot);
  if (!snapshot?.round) return null;
  const r = snapshot.round;
  const meta = MODE_META[r.mode] ?? MODE_META.classic!;

  return (
    <main className="min-h-dvh flex flex-col px-4 sm:px-6 py-6 max-w-4xl mx-auto w-full">
      <header className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`chip-${meta.chip}`}>
            {meta.icon}
            {meta.label}
          </div>
          <div className="text-text-muted text-sm">
            Manche <span className="text-text font-semibold">{r.roundIndex + 1}</span>
            <span className="text-text-dim"> / {snapshot.totalRounds}</span>
          </div>
        </div>
        {r.endsAt && <Timer endsAt={r.endsAt} />}
      </header>

      <motion.div
        key={r.question.id}
        initial={{ opacity: 0, y: 16, rotateX: -6 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="panel p-8 mb-6 relative overflow-hidden"
      >
        <span className="corner-ornament tl" />
        <span className="corner-ornament br" />
        <div className="text-text-dim uppercase tracking-widest text-[11px] mb-2">
          {r.question.category} · {r.question.difficulty}
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold leading-snug">
          {r.question.prompt}
        </h2>
      </motion.div>

      <div className="flex-1">{children}</div>

      <footer className="mt-6 player-strip">
        {snapshot.players.map((p) => (
          <PlayerPill key={p.id} playerId={p.id} />
        ))}
      </footer>
    </main>
  );
}

function PlayerPill({ playerId }: { playerId: string }) {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const answered = useGameStore((s) => s.answeredPlayerIds.has(playerId));
  const eliminated = useGameStore((s) =>
    s.eliminations.some((e) => e.playerId === playerId),
  );
  const player = snapshot.players.find((p) => p.id === playerId);
  if (!player) return null;
  const isCurrent = snapshot.round?.currentPlayerId === playerId;

  const cls = eliminated
    ? 'player-pill eliminated'
    : isCurrent
      ? 'player-pill current'
      : answered
        ? 'player-pill ready'
        : 'player-pill';

  return (
    <motion.div
      layout
      animate={isCurrent ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={isCurrent ? { duration: 1.3, repeat: Infinity } : { duration: 0.3 }}
      className={cls}
    >
      <AvatarBadge avatar={player.avatar} size="sm" />
      <div className="text-sm leading-tight">
        <div className="nickname font-semibold">{player.nickname}</div>
        <div className="text-[11px] text-text-dim">
          {player.score} pts
          {answered && !eliminated && <span className="text-neon-lime"> · prêt</span>}
          {eliminated && <span className="text-neon-rose"> · éliminé</span>}
        </div>
      </div>
    </motion.div>
  );
}
