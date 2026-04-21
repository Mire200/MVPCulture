'use client';
import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Crown, Grid3x3, Sparkles, Trophy, Skull } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { AvatarBadge } from '@/components/AvatarPicker';
import { getSocket } from '@/lib/socket';
import { mvpConfetti } from '@/lib/confetti';
import { mvpSound } from '@/lib/sound';
import { cn } from '@/lib/cn';

type CnColor = 'red' | 'blue' | 'neutral' | 'assassin';

const TEAM_LABEL: Record<'red' | 'blue', string> = { red: 'Rouge', blue: 'Bleu' };
const TEAM_TEXT: Record<'red' | 'blue', string> = {
  red: 'text-neon-rose',
  blue: 'text-neon-cyan',
};
const TEAM_CHIP: Record<'red' | 'blue', string> = {
  red: 'chip-rose',
  blue: 'chip-cyan',
};

const END_REASON_LABEL: Record<'assassin' | 'allFound' | 'forfeit', string> = {
  assassin: "Assassin touché — l'équipe adverse remporte la victoire.",
  allFound: "Tous les mots de l'équipe ont été trouvés.",
  forfeit: 'Forfait au timer.',
};

const TILE_STYLE: Record<CnColor, string> = {
  red: 'bg-neon-rose/25 text-white ring-2 ring-neon-rose/60',
  blue: 'bg-neon-cyan/25 text-white ring-2 ring-neon-cyan/60',
  neutral: 'bg-surface-2 text-text-muted ring-1 ring-border',
  assassin: 'bg-neutral-900 text-neon-rose ring-2 ring-neon-rose/80',
};

export function CodenamesReveal() {
  const snapshot = useGameStore((s) => s.snapshot);
  const reveal = useGameStore((s) => s.reveal);
  const myId = useGameStore((s) => s.playerId);
  const round = snapshot?.round;

  const winner = round?.cnWinner;
  const endReason = round?.cnEndReason;
  const grid = round?.cnGrid ?? [];
  const spymasters = round?.cnSpymasters;
  const history = round?.cnClueHistory ?? [];

  useEffect(() => {
    if (!winner) return;
    mvpSound.bigReveal();
    mvpConfetti.burst({ count: 90, velocity: 22 });
  }, [winner]);

  const winners = useMemo(() => {
    if (!snapshot || !winner) return [];
    return snapshot.players.filter((p) => p.cnTeam === winner);
  }, [snapshot, winner]);

  if (!snapshot || !reveal || !round) return null;
  const isHost = snapshot.hostId === myId;

  const advance = () => {
    mvpSound.whoosh();
    const sock = getSocket();
    sock.emit('round:advance', () => {});
  };

  return (
    <main className="min-h-dvh px-4 py-6 max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-3">
        <div className="chip-magenta mx-auto inline-flex">◉ RÉVÉLATION</div>
        <h2 className="font-display text-2xl sm:text-3xl leading-snug">
          Codenames — fin de partie
        </h2>
      </div>

      {winner && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 16 }}
          className={cn(
            'panel p-6 text-center space-y-2 relative overflow-hidden',
            winner === 'red' ? 'ring-magenta' : 'ring-cyan',
          )}
        >
          <div className={cn('flex justify-center', TEAM_TEXT[winner])}>
            <Trophy className="w-10 h-10" />
          </div>
          <div className={cn('font-display text-3xl font-bold', TEAM_TEXT[winner])}>
            Équipe {TEAM_LABEL[winner]} gagnante
          </div>
          {endReason && (
            <div className="text-text-muted text-sm flex items-center gap-2 justify-center">
              {endReason === 'assassin' && <Skull className="w-4 h-4 text-neon-rose" />}
              {endReason === 'allFound' && <Sparkles className="w-4 h-4 text-neon-lime" />}
              <span>{END_REASON_LABEL[endReason]}</span>
            </div>
          )}
          {winners.length > 0 && (
            <div className="pt-3 flex flex-wrap justify-center gap-2">
              {winners.map((p) => (
                <div
                  key={p.id}
                  className="panel-elevated px-3 py-1.5 flex items-center gap-2 text-sm"
                >
                  <AvatarBadge avatar={p.avatar} size="sm" />
                  <span className="truncate">{p.nickname}</span>
                  {spymasters && spymasters[winner] === p.id && (
                    <Crown className="w-3.5 h-3.5 text-neon-amber shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-text-dim flex items-center gap-2">
          <Grid3x3 className="w-3.5 h-3.5" />
          Grille complète
        </div>
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {grid.map((tile, i) => {
            const color = (tile.color ?? 'neutral') as CnColor;
            return (
              <div
                key={`${tile.word}-${i}`}
                className={cn(
                  'aspect-[4/3] rounded-lg sm:rounded-xl flex items-center justify-center text-center',
                  'font-display font-semibold px-1 text-xs sm:text-sm md:text-base',
                  TILE_STYLE[color],
                )}
                title={color}
              >
                <span className="leading-tight">{tile.word}</span>
              </div>
            );
          })}
        </div>
      </div>

      {history.length > 0 && (
        <div className="panel p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-text-dim">
            Indices donnés ({history.length})
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
            {history.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={cn('chip', TEAM_CHIP[c.byTeam])}>
                  {TEAM_LABEL[c.byTeam]}
                </span>
                <span className="font-mono truncate">{c.word}</span>
                <span className="text-text-dim">({c.count === 0 ? '∞' : c.count})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
          En attente de l'hôte pour passer au score…
        </div>
      )}
    </main>
  );
}
