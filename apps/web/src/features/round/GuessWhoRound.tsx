'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  SkipForward,
  CircleOff,
  HelpCircle,
  Target,
  X,
  Sparkles,
} from 'lucide-react';
import { AVATAR_POOL } from '@mvpc/shared';
import type { Player } from '@mvpc/shared';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/cn';

/* ─── X icon for the masked overlay ─── */
function GwXIcon() {
  return (
    <svg className="gw-x-icon" viewBox="0 0 24 24" aria-hidden>
      <line x1="4" y1="4" x2="20" y2="20" />
      <line x1="20" y1="4" x2="4" y2="20" />
    </svg>
  );
}

export function GuessWhoRound() {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const round = snapshot.round!;
  const myId = useGameStore((s) => s.playerId);
  const mySecret = useGameStore((s) => s.gwMySecret);
  const setMySecret = useGameStore((s) => s.setGwMySecret);
  const masks = useGameStore((s) => s.gwMasks);

  const phase = round.gwPhase ?? 'select';

  if (phase === 'select') {
    return (
      <SelectPhase
        mySecret={mySecret}
        setMySecret={setMySecret}
        players={snapshot.players}
        secretsMap={round.gwSecrets ?? {}}
        myId={myId}
      />
    );
  }

  return (
    <PlayPhase
      myId={myId}
      mySecret={mySecret}
      currentTargetId={round.currentPlayerId}
      currentGrid={round.gwCurrentGrid ?? []}
      eliminated={round.gwEliminated ?? []}
      revealed={round.gwRevealed ?? {}}
      players={snapshot.players}
      masks={masks}
      guesses={round.gwGuesses ?? []}
      roundIndex={round.roundIndex}
    />
  );
}

/* ─── Phase 1 — select ─── */
function SelectPhase({
  mySecret,
  setMySecret,
  players,
  secretsMap,
  myId,
}: {
  mySecret: string | null;
  setMySecret: (s: string | null) => void;
  players: Player[];
  secretsMap: Record<string, boolean>;
  myId: string | null;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const hasPicked = myId ? !!secretsMap[myId] : false;
  const readyCount = Object.values(secretsMap).filter(Boolean).length;
  const progressPct = players.length > 0 ? (readyCount / players.length) * 100 : 0;

  const pick = (src: string) => {
    if (pending || hasPicked) return;
    setPending(src);
    const sock = getSocket();
    sock.emit('guessWho:pickSecret', { avatarSrc: src }, (res) => {
      setPending(null);
      if (!res.ok) {
        alert(res.message);
        return;
      }
      setMySecret(src);
    });
  };

  return (
    <div className="gw-fade-up space-y-4">
      <div className="panel gw-q-card p-6 sm:p-7">
        <div className="text-[10px] tracking-[0.14em] uppercase text-text-dim mb-1">
          Qui est-ce ? — Phase 1
        </div>
        <div className="font-display text-2xl font-bold leading-tight">
          Choisis ton avatar secret
        </div>
        <div className="text-text-muted text-sm mt-2 max-w-xl">
          Les autres joueurs vont tenter de le deviner dans ta grille.
        </div>
      </div>

      <div className="panel p-4 sm:p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-text-dim uppercase tracking-[0.1em]">
              Prêts
            </span>
            <span className="gw-ready-badge">
              {readyCount}/{players.length}
            </span>
            <div className="gw-progress-bar">
              <div
                className="gw-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          {hasPicked && mySecret && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted">Ton secret :</span>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mySecret}
                  alt="secret"
                  className="w-12 h-12 rounded-full object-cover"
                  style={{ border: '2px solid var(--neon-lime)' }}
                />
                <div
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--neon-lime)' }}
                >
                  <Check className="w-3 h-3" strokeWidth={3} color="#0a0612" />
                </div>
              </div>
              <span className="text-[11px] text-text-dim">
                En attente des autres…
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="panel gw-grid-wrap">
        <div className="gw-grid-scan" />
        <div className="gw-select-grid">
          {AVATAR_POOL.map((src) => {
            const isMine = mySecret === src;
            const isPending = pending === src;
            const others = hasPicked && !isMine;
            return (
              <motion.button
                key={src}
                type="button"
                whileTap={!hasPicked ? { scale: 0.94 } : undefined}
                onClick={() => pick(src)}
                disabled={hasPicked}
                className={cn(
                  'gw-select-cell',
                  isMine && 'picked',
                  others && 'others-picked',
                )}
                title={src.split('/').pop()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" draggable={false} />
                {isPending && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(10,6,18,0.5)' }}
                  >
                    <div
                      className="w-5 h-5 rounded-full animate-spin"
                      style={{
                        border: '2px solid var(--neon-cyan)',
                        borderTopColor: 'transparent',
                      }}
                    />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Phase 2 — play ─── */
type MyGuessResult = { targetId: string; avatarSrc: string; correct: boolean };

function PlayPhase({
  myId,
  mySecret,
  currentTargetId,
  currentGrid,
  eliminated,
  revealed,
  players,
  masks,
  guesses,
  roundIndex,
}: {
  myId: string | null;
  mySecret: string | null;
  currentTargetId?: string;
  currentGrid: string[];
  eliminated: string[];
  revealed: Record<string, string>;
  players: Player[];
  masks: Record<string, Set<string>>;
  guesses: Array<{ playerId: string; targetId: string; avatarSrc: string; correct: boolean }>;
  roundIndex: number;
}) {
  const target = useMemo(
    () => players.find((p) => p.id === currentTargetId),
    [players, currentTargetId],
  );
  const iAmTarget = myId === currentTargetId;
  const iAmEliminated = myId ? eliminated.includes(myId) : false;

  const myMasksForTarget = useMemo(() => {
    if (!currentTargetId) return new Set<string>();
    return masks[currentTargetId] ?? new Set<string>();
  }, [masks, currentTargetId]);

  // Bans locaux : cibles que j'ai déjà tenté de guess (correct ou raté).
  // Reset au début d'une nouvelle manche.
  const [myBannedTargets, setMyBannedTargets] = useState<Set<string>>(() => new Set());
  const [myGuessesByTarget, setMyGuessesByTarget] = useState<Record<string, MyGuessResult>>({});
  const prevRoundRef = useRef<number>(roundIndex);
  useEffect(() => {
    if (prevRoundRef.current !== roundIndex) {
      setMyBannedTargets(new Set());
      setMyGuessesByTarget({});
      prevRoundRef.current = roundIndex;
    }
  }, [roundIndex]);

  const iAmBannedForCurrent = !!(currentTargetId && myBannedTargets.has(currentTargetId));
  const myGuessForCurrent =
    currentTargetId ? myGuessesByTarget[currentTargetId] ?? null : null;

  const [guessMode, setGuessMode] = useState(false);
  const [pendingGuess, setPendingGuess] = useState<string | null>(null);

  useEffect(() => {
    setGuessMode(false);
    setPendingGuess(null);
  }, [currentTargetId]);

  const toggleMask = (avatarSrc: string) => {
    if (!currentTargetId || iAmTarget || iAmEliminated) return;
    if (guessMode) return;
    const nextMasked = !myMasksForTarget.has(avatarSrc);
    const sock = getSocket();
    sock.emit(
      'guessWho:toggleMask',
      { targetId: currentTargetId, avatarSrc, masked: nextMasked },
      (res) => {
        if (!res.ok) alert(res.message);
      },
    );
  };

  const attemptGuess = (avatarSrc: string) => {
    if (!currentTargetId || iAmTarget || iAmEliminated || iAmBannedForCurrent) return;
    if (pendingGuess) return;
    const targetName = target?.nickname ?? 'cette grille';
    if (
      !window.confirm(
        `Tu tentes ton unique guess sur la grille de ${targetName}. ` +
          `Tu ne pourras plus retenter cette grille — mais si tu te trompes, ` +
          `tu pourras toujours guess les autres. Résultats révélés en fin de tour.`,
      )
    ) {
      return;
    }
    setPendingGuess(avatarSrc);
    const sock = getSocket();
    const targetId = currentTargetId;
    sock.emit('guessWho:guess', { avatarSrc }, (res) => {
      setPendingGuess(null);
      if (!res.ok) {
        alert(res.message);
        return;
      }
      const correct = res.data.correct;
      setMyBannedTargets((prev) => {
        const n = new Set(prev);
        n.add(targetId);
        return n;
      });
      setMyGuessesByTarget((prev) => ({
        ...prev,
        [targetId]: { targetId, avatarSrc, correct },
      }));
      setGuessMode(false);
    });
  };

  const nextTurn = () => {
    const sock = getSocket();
    sock.emit('guessWho:nextTurn', (res) => {
      if (!res.ok) alert(res.message);
    });
  };

  const selfEliminate = () => {
    if (!window.confirm('Tu confirmes être démasqué ? Tu sors de la partie.'))
      return;
    const sock = getSocket();
    sock.emit('guessWho:selfEliminate', (res) => {
      if (!res.ok) alert(res.message);
    });
  };

  const remaining = currentGrid.length - myMasksForTarget.size;
  const targetColor = target?.avatar.color ?? '#a855f7';

  return (
    <div className="gw-fade-up space-y-4">
      <div className="panel gw-q-card p-6 sm:p-7">
        <div className="text-[10px] tracking-[0.14em] uppercase text-text-dim mb-1">
          Qui est-ce ? — Phase 2
        </div>
        <div className="font-display text-xl sm:text-2xl font-bold leading-tight">
          Qui est le personnage mystère caché dans la grille ?
        </div>
      </div>

      <div className={cn('panel gw-turn-banner', iAmTarget && 'is-target')}>
        <div
          className="relative flex-shrink-0 rounded-full overflow-hidden"
          style={{
            width: 52,
            height: 52,
            border: `2.5px solid ${targetColor}`,
            boxShadow: `0 0 16px ${targetColor}66`,
            background: 'var(--bg-elev)',
          }}
        >
          {target?.avatar.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={target.avatar.image}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${targetColor}, ${targetColor}99)`,
                fontSize: 22,
              }}
            >
              {target?.avatar.emoji ?? '🎭'}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10px] tracking-[0.1em] uppercase text-text-dim mb-0.5">
            Tour de
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-display text-xl font-bold truncate">
              {target?.nickname ?? '…'}
            </div>
            {iAmTarget && <span className="gw-pulse-pill">Ton tour</span>}
          </div>
          <div className="text-xs text-text-muted mt-0.5 truncate">
            {iAmTarget
              ? 'Réponds oralement aux questions des autres joueurs.'
              : 'Pose une question à l’oral, puis masque les avatars qui ne correspondent pas.'}
          </div>
        </div>

        {iAmTarget && !iAmEliminated && (
          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
            <button
              type="button"
              onClick={nextTurn}
              className="btn-secondary"
              style={{ padding: '10px 16px' }}
              title="Passer au joueur suivant"
            >
              <SkipForward className="w-4 h-4" />
              Suite
            </button>
            <button
              type="button"
              onClick={selfEliminate}
              className="btn-danger"
              style={{ padding: '10px 16px' }}
              title="Admettre que ton avatar a été deviné"
            >
              <CircleOff className="w-4 h-4" />
              Démasqué
            </button>
          </div>
        )}

        {!iAmTarget && !iAmEliminated && (
          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
            {iAmBannedForCurrent ? (
              <div
                className="text-[11px] text-text-dim inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                style={{
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  color: 'var(--neon-amber)',
                }}
                title="Tu as déjà tenté sur cette grille. Tu pourras guess les autres."
              >
                <Sparkles className="w-3 h-3" />
                Guess déjà tenté — attends la prochaine grille
              </div>
            ) : guessMode ? (
              <button
                type="button"
                onClick={() => setGuessMode(false)}
                className="btn-secondary"
                style={{ padding: '10px 16px' }}
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setGuessMode(true)}
                className="btn-primary"
                style={{ padding: '10px 16px' }}
                title="Tenter de deviner l'avatar secret de cette grille (1 essai par grille)"
              >
                <Target className="w-4 h-4" />
                Tenter un guess
              </button>
            )}
          </div>
        )}
      </div>

      <div className={cn('panel gw-grid-wrap', guessMode && 'gw-grid-guess-mode')}>
        <div className="gw-grid-scan" />
        <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-wrap gap-2">
          <div className="text-[11px] uppercase tracking-[0.1em] text-text-dim flex items-center gap-2">
            {guessMode ? (
              <>
                <Target className="w-3 h-3" style={{ color: 'var(--neon-amber)' }} />
                <span style={{ color: 'var(--neon-amber)' }}>
                  Clique sur l'avatar que tu penses être le secret de{' '}
                </span>
                <span className="text-text font-semibold normal-case tracking-normal">
                  {target?.nickname ?? '—'}
                </span>
              </>
            ) : (
              <>
                <HelpCircle className="w-3 h-3" />
                Grille de{' '}
                <span className="text-text font-semibold normal-case tracking-normal">
                  {target?.nickname ?? '—'}
                </span>
              </>
            )}
          </div>
          <div className="font-mono text-xs text-text-muted">
            <span
              className="font-bold"
              style={{ color: 'var(--neon-cyan)' }}
            >
              {remaining}
            </span>{' '}
            / {currentGrid.length} restant{remaining > 1 ? 's' : ''}
          </div>
        </div>
        <div className="gw-avatar-grid">
          {currentGrid.map((src, i) => {
            const masked = myMasksForTarget.has(src);
            const isMyOwnSecret = iAmTarget && src === mySecret;
            const clickable = !iAmTarget && !iAmEliminated;
            const guessing = guessMode && clickable && !iAmBannedForCurrent && !masked;
            const isPendingGuess = pendingGuess === src;
            return (
              <motion.button
                key={src}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.015, duration: 0.25 }}
                whileTap={clickable ? { scale: 0.94 } : undefined}
                disabled={!clickable || (guessMode && (masked || iAmBannedForCurrent))}
                onClick={() => (guessMode ? attemptGuess(src) : toggleMask(src))}
                className={cn(
                  'gw-avatar-cell',
                  masked && 'masked',
                  isMyOwnSecret && 'mine',
                  !clickable && 'disabled',
                  guessing && 'gw-guessable',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" draggable={false} />
                {masked && (
                  <div className="gw-masked-overlay">
                    <GwXIcon />
                  </div>
                )}
                {isMyOwnSecret && <div className="gw-mine-badge">Toi</div>}
                {isPendingGuess && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(10,6,18,0.55)' }}
                  >
                    <div
                      className="w-6 h-6 rounded-full animate-spin"
                      style={{
                        border: '2px solid var(--neon-amber)',
                        borderTopColor: 'transparent',
                      }}
                    />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Rappel privé de MA tentative sur la grille courante (invisible aux
          autres joueurs tant que le tour n'est pas terminé). */}
      <AnimatePresence>
        {myGuessForCurrent && (
          <motion.div
            key={myGuessForCurrent.targetId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="panel p-4 text-sm flex items-center gap-3"
            style={{
              border: '1px solid rgba(251,191,36,0.4)',
              background:
                'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(34,211,238,0.06))',
            }}
          >
            <Sparkles className="w-5 h-5" style={{ color: 'var(--neon-amber)' }} />
            <div className="flex-1 min-w-0">
              <div
                className="font-semibold"
                style={{ color: 'var(--neon-amber)' }}
              >
                Guess envoyé (secret)
              </div>
              <div className="text-text-muted text-xs">
                Tu as tenté sur la grille de{' '}
                <span className="text-text font-semibold">
                  {target?.nickname ?? '—'}
                </span>
                . Le résultat sera révélé à tous en fin de tour.
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={myGuessForCurrent.avatarSrc}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
              style={{ border: '2px solid var(--neon-amber)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {guesses.length > 0 && (
        <div className="panel p-4">
          <div className="text-[11px] uppercase tracking-[0.1em] text-text-dim mb-2 flex items-center gap-2">
            <HelpCircle className="w-3 h-3" />
            Tentatives révélées (tours précédents)
          </div>
          <div className="flex flex-wrap gap-2">
            {guesses.map((g, i) => {
              const guesser = players.find((p) => p.id === g.playerId);
              const tgt = players.find((p) => p.id === g.targetId);
              return (
                <motion.div
                  key={`${g.playerId}-${g.targetId}-${i}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="gw-elim-pill"
                  style={{
                    borderColor: g.correct
                      ? 'rgba(163,230,53,0.5)'
                      : 'rgba(244,63,94,0.5)',
                    background: g.correct
                      ? 'rgba(163,230,53,0.08)'
                      : 'rgba(244,63,94,0.08)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.avatarSrc} alt="" />
                  <span className="nick">
                    {guesser?.nickname ?? '?'} → {tgt?.nickname ?? '?'}
                  </span>
                  {g.correct ? (
                    <Check
                      className="w-3.5 h-3.5 ml-1"
                      style={{ color: 'var(--neon-lime)' }}
                      strokeWidth={3}
                    />
                  ) : (
                    <X
                      className="w-3.5 h-3.5 ml-1"
                      style={{ color: 'var(--neon-rose)' }}
                      strokeWidth={3}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {eliminated.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel"
          >
            <div className="text-[11px] uppercase tracking-[0.1em] text-text-dim px-4 pt-3">
              Démasqués
            </div>
            <div className="gw-elim-strip">
              {eliminated.map((pid) => {
                const p = players.find((pp) => pp.id === pid);
                const avatarSrc = revealed[pid];
                if (!p) return null;
                return (
                  <motion.div
                    key={pid}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="gw-elim-pill"
                  >
                    {avatarSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarSrc} alt="" />
                    ) : p.avatar.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar.image} alt="" />
                    ) : (
                      <div
                        className="w-[30px] h-[30px] rounded-full flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${p.avatar.color}, ${p.avatar.color}99)`,
                          border: '1.5px solid var(--neon-rose)',
                          fontSize: 14,
                        }}
                      >
                        {p.avatar.emoji}
                      </div>
                    )}
                    <span className="nick">{p.nickname}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

