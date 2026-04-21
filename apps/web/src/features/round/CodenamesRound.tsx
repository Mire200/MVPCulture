'use client';
import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Crown, Grid3x3, Hand, Clock3, Sparkles } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { AvatarBadge } from '@/components/AvatarPicker';
import { cn } from '@/lib/cn';

type CnColor = 'red' | 'blue' | 'neutral' | 'assassin';

const TEAM_LABEL: Record<'red' | 'blue', string> = {
  red: 'Rouge',
  blue: 'Bleu',
};

const TEAM_TEXT: Record<'red' | 'blue', string> = {
  red: 'text-neon-rose',
  blue: 'text-neon-cyan',
};

const TEAM_BG_SOFT: Record<'red' | 'blue', string> = {
  red: 'bg-neon-rose/10 ring-1 ring-neon-rose/40',
  blue: 'bg-neon-cyan/10 ring-1 ring-neon-cyan/40',
};

/** Classe Tailwind appliquée à une tuile révélée, selon sa couleur. */
const REVEALED_STYLE: Record<CnColor, string> = {
  red: 'bg-neon-rose/25 text-white ring-2 ring-neon-rose/60 shadow-[0_0_18px_rgba(244,63,94,0.35)]',
  blue: 'bg-neon-cyan/25 text-white ring-2 ring-neon-cyan/60 shadow-[0_0_18px_rgba(34,211,238,0.35)]',
  neutral: 'bg-surface-2 text-text-muted ring-1 ring-border',
  assassin:
    'bg-neutral-900 text-neon-rose ring-2 ring-neon-rose/80 shadow-[0_0_24px_rgba(244,63,94,0.6)]',
};

/**
 * Teinte "spymaster" : fond discret qui rend la couleur de la tuile
 * identifiable avant qu'elle ne soit révélée.
 */
const SPY_HINT: Record<CnColor, string> = {
  red: 'ring-1 ring-neon-rose/50 bg-neon-rose/5',
  blue: 'ring-1 ring-neon-cyan/50 bg-neon-cyan/5',
  neutral: 'ring-1 ring-border bg-surface-2/50',
  assassin: 'ring-2 ring-neon-rose/80 bg-neutral-900/60 text-neon-rose',
};

export function CodenamesRound() {
  const snapshot = useGameStore((s) => s.snapshot);
  const myId = useGameStore((s) => s.playerId);
  const myKey = useGameStore((s) => s.cnMyKey);

  if (!snapshot?.round) return null;
  const r = snapshot.round;
  const phase = r.cnPhase ?? 'clue';
  const currentTeam = r.cnCurrentTeam ?? 'red';
  const spymasters = r.cnSpymasters ?? { red: '', blue: '' };

  const me = snapshot.players.find((p) => p.id === myId);
  const myTeam = me?.cnTeam;
  const iAmSpymaster =
    !!myId && (spymasters.red === myId || spymasters.blue === myId);
  const iAmInActiveTeam = myTeam === currentTeam;
  const iAmActiveSpymaster = iAmSpymaster && myTeam === currentTeam;
  const iAmActiveGuesser =
    iAmInActiveTeam && !iAmSpymaster && (myTeam === 'red' || myTeam === 'blue');

  return (
    <div className="space-y-4">
      <ScoreHeader
        remaining={r.cnRemaining ?? { red: 0, blue: 0 }}
        currentTeam={currentTeam}
        phase={phase}
        spymasters={spymasters}
        players={snapshot.players}
      />

      {phase === 'clue' && (
        <CluePanel
          iAmActiveSpymaster={iAmActiveSpymaster}
          currentTeam={currentTeam}
          spymaster={
            snapshot.players.find((p) => p.id === spymasters[currentTeam])
          }
          lastClue={r.cnClue}
        />
      )}

      {phase === 'guess' && r.cnClue && (
        <GuessFooter
          clue={r.cnClue}
          guessesLeft={r.cnGuessesLeft ?? 0}
          canEndTurn={iAmActiveGuesser}
        />
      )}

      <Grid5x5
        grid={r.cnGrid ?? []}
        myKey={iAmSpymaster ? myKey : null}
        canClick={phase === 'guess' && iAmActiveGuesser}
      />

      {r.cnClueHistory && r.cnClueHistory.length > 0 && (
        <ClueHistory history={r.cnClueHistory} />
      )}

      {phase === 'done' && (
        <div className="panel p-6 text-center text-text-muted">
          <Sparkles className="w-5 h-5 mx-auto mb-2 text-neon-lime" />
          Fin de manche — révélation en cours…
        </div>
      )}
    </div>
  );
}

function ScoreHeader({
  remaining,
  currentTeam,
  phase,
  spymasters,
  players,
}: {
  remaining: { red: number; blue: number };
  currentTeam: 'red' | 'blue';
  phase: 'clue' | 'guess' | 'done';
  spymasters: { red: string; blue: string };
  players: { id: string; nickname: string; avatar: { emoji: string; color: string; image?: string } }[];
}) {
  return (
    <motion.div
      layout
      className="panel p-4 flex items-center gap-3 flex-wrap"
    >
      {(['red', 'blue'] as const).map((team) => {
        const active = team === currentTeam && phase !== 'done';
        const spy = players.find((p) => p.id === spymasters[team]);
        return (
          <div
            key={team}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-xl transition-all flex-1 min-w-[180px]',
              active ? TEAM_BG_SOFT[team] : 'opacity-70',
            )}
          >
            <div className="flex flex-col items-center justify-center min-w-[56px]">
              <div
                className={cn(
                  'font-display font-extrabold leading-none',
                  TEAM_TEXT[team],
                )}
                style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}
              >
                {remaining[team]}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-text-dim">
                mots
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn('font-semibold text-sm', TEAM_TEXT[team])}>
                Équipe {TEAM_LABEL[team]}
                {active && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-text-dim uppercase tracking-wider">
                    <Clock3 className="w-3 h-3" />
                    {phase === 'clue' ? 'indice' : 'guess'}
                  </span>
                )}
              </div>
              {spy && (
                <div className="text-[11px] text-text-dim flex items-center gap-1 mt-0.5">
                  <Crown className="w-3 h-3 text-neon-amber" />
                  <span className="truncate">{spy.nickname}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}

function CluePanel({
  iAmActiveSpymaster,
  currentTeam,
  spymaster,
  lastClue,
}: {
  iAmActiveSpymaster: boolean;
  currentTeam: 'red' | 'blue';
  spymaster?: { id: string; nickname: string; avatar: { emoji: string; color: string; image?: string } };
  lastClue?: { word: string; count: number; byTeam: 'red' | 'blue' };
}) {
  const [word, setWord] = useState('');
  const [count, setCount] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setWord('');
    setCount(1);
  }, [currentTeam]);

  if (iAmActiveSpymaster) {
    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = word.trim();
      if (!trimmed) return;
      setSubmitting(true);
      const sock = getSocket();
      sock.emit('codenames:submitClue', { word: trimmed, count }, (res) => {
        setSubmitting(false);
        if (!res.ok) {
          alert(res.message || 'Impossible de soumettre cet indice');
        } else {
          setWord('');
          setCount(1);
        }
      });
    };
    return (
      <form onSubmit={submit} className={cn('panel p-5 space-y-3', TEAM_BG_SOFT[currentTeam])}>
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-neon-amber" />
          <span className={cn('font-display text-sm', TEAM_TEXT[currentTeam])}>
            Tu es spymaster — donne un indice pour ton équipe.
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            autoFocus
            type="text"
            maxLength={40}
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Un seul mot"
            className="input flex-1 text-lg"
          />
          <input
            type="number"
            min={0}
            max={9}
            value={count}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setCount(Number.isFinite(v) ? Math.max(0, Math.min(9, v)) : 1);
            }}
            className="input w-24 text-center text-lg"
            title="Nombre de mots visés (0 = infini)"
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={submitting || !word.trim()}
            className="btn-primary disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Envoyer
          </motion.button>
        </div>
        <p className="text-[11px] text-text-dim">
          L'indice doit être un mot unique, sans espace, et ne pas reprendre un mot du plateau.
          Saisis 0 pour "illimité".
        </p>
      </form>
    );
  }

  return (
    <div className={cn('panel p-5 flex items-center gap-3', TEAM_BG_SOFT[currentTeam])}>
      {spymaster ? (
        <>
          <AvatarBadge avatar={spymaster.avatar} size="md" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-text-dim mb-0.5">
              Le spymaster réfléchit…
            </div>
            <div className={cn('font-display font-semibold', TEAM_TEXT[currentTeam])}>
              {spymaster.nickname}{' '}
              <span className="text-text-muted font-normal text-sm">
                (équipe {TEAM_LABEL[currentTeam]})
              </span>
            </div>
            {lastClue && lastClue.byTeam !== currentTeam && (
              <div className="text-xs text-text-muted mt-1">
                Dernier indice adverse :{' '}
                <span className="font-mono text-text">{lastClue.word}</span>{' '}
                <span className="text-text-dim">({lastClue.count})</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <span className="text-text-muted text-sm">Attente du spymaster…</span>
      )}
    </div>
  );
}

function GuessFooter({
  clue,
  guessesLeft,
  canEndTurn,
}: {
  clue: { word: string; count: number; byTeam: 'red' | 'blue' };
  guessesLeft: number;
  canEndTurn: boolean;
}) {
  const endTurn = () => {
    const sock = getSocket();
    sock.emit('codenames:endTurn', (res) => {
      if (!res.ok) alert(res.message);
    });
  };
  return (
    <div className={cn('panel p-4 flex items-center gap-4 flex-wrap', TEAM_BG_SOFT[clue.byTeam])}>
      <div className="flex-1 min-w-[200px]">
        <div className="text-[10px] uppercase tracking-wider text-text-dim">
          Indice · équipe {TEAM_LABEL[clue.byTeam]}
        </div>
        <div
          className={cn('font-display font-extrabold leading-tight', TEAM_TEXT[clue.byTeam])}
          style={{ fontSize: 'clamp(22px, 3.2vw, 30px)' }}
        >
          {clue.word}{' '}
          <span className="text-text-muted text-base font-mono">
            ({clue.count === 0 ? '∞' : clue.count})
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-text-dim">
            Tentatives
          </div>
          <div className="font-display text-2xl font-bold">{guessesLeft}</div>
        </div>
        {canEndTurn && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={endTurn}
            className="btn-ghost"
          >
            <Hand className="w-4 h-4" />
            Fin de tour
          </motion.button>
        )}
      </div>
    </div>
  );
}

function Grid5x5({
  grid,
  myKey,
  canClick,
}: {
  grid: Array<{ word: string; color?: CnColor }>;
  myKey: CnColor[] | null;
  canClick: boolean;
}) {
  const guess = (index: number) => {
    if (!canClick) return;
    const tile = grid[index];
    if (!tile || tile.color) return; // already revealed
    const sock = getSocket();
    sock.emit('codenames:guessTile', { index }, (res) => {
      if (!res.ok) alert(res.message);
    });
  };

  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {grid.map((tile, i) => {
        const revealed = !!tile.color;
        const spyHint = myKey?.[i];
        const classes = revealed
          ? REVEALED_STYLE[tile.color!]
          : spyHint
            ? SPY_HINT[spyHint]
            : 'bg-surface text-text border border-border';
        const clickable = canClick && !revealed;
        return (
          <motion.button
            key={`${tile.word}-${i}`}
            type="button"
            whileHover={clickable ? { y: -2, scale: 1.03 } : undefined}
            whileTap={clickable ? { scale: 0.96 } : undefined}
            onClick={() => guess(i)}
            disabled={!clickable}
            className={cn(
              'aspect-[4/3] rounded-lg sm:rounded-xl flex items-center justify-center text-center',
              'font-display font-semibold px-1 text-xs sm:text-sm md:text-base',
              'transition-all',
              classes,
              !clickable && 'cursor-default',
            )}
            title={revealed ? `Révélée : ${tile.color}` : tile.word}
          >
            <span className={cn('leading-tight', revealed && 'line-through opacity-90')}>
              {tile.word}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function ClueHistory({
  history,
}: {
  history: Array<{ word: string; count: number; byTeam: 'red' | 'blue' }>;
}) {
  const items = useMemo(() => history.slice(-6).reverse(), [history]);
  return (
    <details className="panel p-3">
      <summary className="cursor-pointer text-sm text-text-muted flex items-center gap-2">
        <Grid3x3 className="w-3.5 h-3.5" />
        Historique des indices ({history.length})
      </summary>
      <ul className="mt-2 space-y-1 text-sm">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className={cn('chip', c.byTeam === 'red' ? 'chip-rose' : 'chip-cyan')}>
              {TEAM_LABEL[c.byTeam]}
            </span>
            <span className="font-mono">{c.word}</span>
            <span className="text-text-dim">({c.count === 0 ? '∞' : c.count})</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
