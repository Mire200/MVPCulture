'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Crown, SkipForward, CircleOff, HelpCircle } from 'lucide-react';
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

/* ─── Confetti for the winner screen ─── */
function GwConfetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      left: number;
      color: string;
      duration: number;
      delay: number;
      dx: number;
      rot: number;
      size: number;
    }>
  >([]);

  useEffect(() => {
    if (!active) return;
    const colors = ['#a3e635', '#22d3ee', '#f43f5e', '#fbbf24', '#a855f7'];
    const ps = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      duration: 1.6 + Math.random() * 1.6,
      delay: Math.random() * 0.8,
      dx: (Math.random() - 0.5) * 220,
      rot: (Math.random() - 0.5) * 720,
      size: 6 + Math.random() * 8,
    }));
    setParticles(ps);
    const t = setTimeout(() => setParticles([]), 4200);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="gw-confetti-particle"
          style={
            {
              left: `${p.left}vw`,
              top: '-20px',
              width: p.size,
              height: p.size,
              background: p.color,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              ['--gw-dx' as string]: `${p.dx}px`,
              ['--gw-rot' as string]: `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
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
      winnerId={round.gwWinnerId}
      players={snapshot.players}
      masks={masks}
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
function PlayPhase({
  myId,
  mySecret,
  currentTargetId,
  currentGrid,
  eliminated,
  revealed,
  winnerId,
  players,
  masks,
}: {
  myId: string | null;
  mySecret: string | null;
  currentTargetId?: string;
  currentGrid: string[];
  eliminated: string[];
  revealed: Record<string, string>;
  winnerId?: string;
  players: Player[];
  masks: Record<string, Set<string>>;
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

  const toggleMask = (avatarSrc: string) => {
    if (!currentTargetId || iAmTarget || iAmEliminated) return;
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

  if (winnerId) {
    const winner = players.find((p) => p.id === winnerId);
    return <WinnerScreen winner={winner} mySecret={mySecret} />;
  }

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
      </div>

      <div className="panel gw-grid-wrap">
        <div className="gw-grid-scan" />
        <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-wrap gap-2">
          <div className="text-[11px] uppercase tracking-[0.1em] text-text-dim flex items-center gap-2">
            <HelpCircle className="w-3 h-3" />
            Grille de{' '}
            <span className="text-text font-semibold normal-case tracking-normal">
              {target?.nickname ?? '—'}
            </span>
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
            return (
              <motion.button
                key={src}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.015, duration: 0.25 }}
                whileTap={clickable ? { scale: 0.94 } : undefined}
                disabled={!clickable}
                onClick={() => toggleMask(src)}
                className={cn(
                  'gw-avatar-cell',
                  masked && 'masked',
                  isMyOwnSecret && 'mine',
                  !clickable && 'disabled',
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
              </motion.button>
            );
          })}
        </div>
      </div>

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

/* ─── Winner screen ─── */
function WinnerScreen({
  winner,
  mySecret,
}: {
  winner?: Player;
  mySecret: string | null;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 100);
    return () => clearTimeout(t);
  }, []);

  const winnerImage = winner?.avatar.image;
  const winnerColor = winner?.avatar.color ?? '#fbbf24';

  return (
    <div className="relative">
      <GwConfetti active={shown} />
      <div className="panel gw-fade-up text-center p-10 sm:p-14">
        <Crown className="gw-crown text-neon-amber mx-auto" />
        <div className="font-display text-4xl sm:text-5xl font-extrabold mt-3 mb-1">
          Victoire !
        </div>
        <div className="text-text-muted text-sm mb-8">
          Le dernier avatar non démasqué
        </div>

        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="rounded-full overflow-hidden"
            style={{
              width: 96,
              height: 96,
              border: '3px solid var(--neon-amber)',
              boxShadow: '0 0 44px rgba(251, 191, 36, 0.45)',
              background: 'var(--bg-elev)',
            }}
          >
            {winnerImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={winnerImage}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${winnerColor}, ${winnerColor}99)`,
                  fontSize: 48,
                }}
              >
                {winner?.avatar.emoji ?? '🎭'}
              </div>
            )}
          </div>
          <div
            className="font-display text-2xl sm:text-3xl font-bold"
            style={{ color: 'var(--neon-amber)' }}
          >
            {winner?.nickname ?? '—'}
          </div>
        </div>

        <div className="gw-glow-line mb-6" />

        {mySecret && (
          <div className="text-sm text-text-muted inline-flex items-center gap-3 justify-center">
            Ton avatar secret était :
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mySecret}
              alt="mon secret"
              className="w-10 h-10 rounded-full object-cover"
              style={{ border: '2px solid var(--neon-lime)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
