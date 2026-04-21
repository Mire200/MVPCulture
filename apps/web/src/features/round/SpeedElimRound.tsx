'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Check, Send, Flame, Sparkles } from 'lucide-react';
import { AvatarBadge } from '@/components/AvatarPicker';

/**
 * Rapidité v2 :
 * - Chaque joueur peut faire autant de propositions qu'il veut.
 * - La manche se termine quand `seTargetFinders` joueurs ont trouvé
 *   (la moitié, arrondie à l'entier supérieur).
 * - UI : rangée des joueurs au dessus, grande grille en dessous qui se
 *   colorie/anime au fur et à mesure des trouvailles.
 */
export function SpeedElimRound() {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const round = snapshot.round!;
  const myId = useGameStore((s) => s.playerId);
  const players = snapshot.players;

  const targetFinders = round.seTargetFinders ?? Math.ceil(players.length / 2);
  const finders = round.seFinders ?? [];
  const finderSet = useMemo(() => new Set(finders), [finders]);
  const attemptCount = round.seAttemptCount ?? {};

  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [shake, setShake] = useState(0);
  const [flashCorrect, setFlashCorrect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const iHaveFound = myId ? finderSet.has(myId) : false;
  const myAttempts = myId ? attemptCount[myId] ?? 0 : 0;

  useEffect(() => {
    if (!iHaveFound) inputRef.current?.focus();
  }, [iHaveFound, round.roundIndex]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || sending || iHaveFound) return;
    setSending(true);
    const socket = getSocket();
    socket.emit('round:answer', { text }, (res) => {
      setSending(false);
      if (!res.ok) {
        alert(res.message);
        return;
      }
      const correct = res.data && typeof res.data === 'object' && 'correct' in res.data
        ? Boolean(res.data.correct)
        : undefined;
      if (correct === false) {
        setShake((x) => x + 1);
        setValue('');
        inputRef.current?.focus();
      } else if (correct === true) {
        setFlashCorrect(true);
        setValue('');
        window.setTimeout(() => setFlashCorrect(false), 1200);
      } else {
        setValue('');
      }
    });
  };

  const remaining = Math.max(0, targetFinders - finders.length);

  return (
    <div className="space-y-4">
      <div className="panel se-hero p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2" style={{ color: 'var(--neon-amber)' }}>
            <Zap className="w-5 h-5" />
            <span className="font-display font-bold text-lg sm:text-xl">Rapidité</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="se-counter">
              <span className="se-counter-big">{finders.length}</span>
              <span className="se-counter-sep">/</span>
              <span className="se-counter-target">{targetFinders}</span>
              <span className="se-counter-label">trouvés</span>
            </div>
            {remaining > 0 ? (
              <div className="text-xs text-text-muted hidden sm:block">
                Encore {remaining} pour clôturer la manche
              </div>
            ) : (
              <div className="text-xs" style={{ color: 'var(--neon-lime)' }}>
                Manche bouclée !
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rangée des joueurs */}
      <div className="panel p-4">
        <div className="se-row-scroll">
          <div className="se-row">
            {players.map((p) => {
              const rank = finders.indexOf(p.id);
              const found = rank !== -1;
              const count = attemptCount[p.id] ?? 0;
              return (
                <motion.div
                  key={p.id}
                  layout
                  className={`se-row-item ${found ? 'se-row-item-found' : ''} ${p.id === myId ? 'se-row-item-me' : ''}`}
                  animate={{
                    y: found ? -4 : 0,
                  }}
                  transition={{ type: 'spring', stiffness: 180, damping: 16 }}
                >
                  <div className="se-row-avatar-wrap">
                    <AvatarBadge avatar={p.avatar} size="md" />
                    {found && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                        className="se-row-check"
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      </motion.div>
                    )}
                    {found && (
                      <motion.div
                        className="se-row-rank-badge"
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.08 }}
                      >
                        {rank + 1}
                      </motion.div>
                    )}
                  </div>
                  <div className="se-row-nick" title={p.nickname}>
                    {p.nickname}
                    {p.id === myId && <span className="se-row-me"> · toi</span>}
                  </div>
                  <div className="se-row-count">
                    {count > 0 && !found && (
                      <span className="text-text-dim">{count} essai{count > 1 ? 's' : ''}</span>
                    )}
                    {found && (
                      <span style={{ color: 'var(--neon-lime)' }} className="font-semibold">
                        <Sparkles className="inline w-3 h-3 mr-0.5" />
                        Trouvé !
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grille géante */}
      <div className="panel se-grid-panel p-4 sm:p-5">
        <div className="se-grid" style={{ '--se-cols': `${players.length}` } as React.CSSProperties}>
          {players.map((p) => {
            const rank = finders.indexOf(p.id);
            const found = rank !== -1;
            return (
              <motion.div
                key={p.id}
                layout
                className={`se-tile ${found ? 'se-tile-found' : ''}`}
                animate={
                  found
                    ? { scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] }
                    : { scale: 1, rotate: 0 }
                }
                transition={{
                  duration: 0.7,
                  times: [0, 0.4, 1],
                  ease: 'easeOut',
                }}
                style={{
                  '--se-hue': `${(hashPid(p.id) * 37) % 360}`,
                } as React.CSSProperties}
              >
                <div className="se-tile-glow" />
                <div className="se-tile-inner">
                  <AvatarBadge avatar={p.avatar} size="lg" />
                  <div className="se-tile-name">{p.nickname}</div>
                  {found ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                      className="se-tile-rank"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>#{rank + 1}</span>
                    </motion.div>
                  ) : (
                    <div className="se-tile-pending">
                      {attemptCount[p.id] ? `${attemptCount[p.id]} essai${attemptCount[p.id]! > 1 ? 's' : ''}` : 'en recherche…'}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Saisie */}
      <div className="panel p-4 sm:p-5 relative overflow-hidden">
        <AnimatePresence>
          {flashCorrect && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(163,230,53,0.35), transparent 70%)',
              }}
            />
          )}
        </AnimatePresence>
        {iHaveFound ? (
          <div className="text-center py-2" style={{ color: 'var(--neon-lime)' }}>
            <Check className="inline w-5 h-5 mr-2" strokeWidth={3} />
            <span className="font-semibold">Bien joué, tu as trouvé !</span>
            <div className="text-text-muted text-xs mt-1">
              Attendez les autres pour révéler la manche.
            </div>
          </div>
        ) : (
          <motion.form
            key={shake}
            onSubmit={send}
            initial={false}
            animate={shake > 0 ? { x: [0, -10, 10, -8, 8, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              className="input text-lg"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Tente ta réponse…"
              disabled={sending}
              maxLength={120}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={sending || !value.trim()}
              style={{ padding: '12px 18px' }}
            >
              {sending ? (
                <div
                  className="w-5 h-5 rounded-full animate-spin"
                  style={{
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                  }}
                />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </motion.form>
        )}
        {!iHaveFound && (
          <p className="text-xs text-text-dim mt-2">
            Tu peux retenter autant que tu veux. Sois dans les {targetFinders} premiers à trouver !
            {myAttempts > 0 && <> · <span className="font-mono">{myAttempts}</span> essai{myAttempts > 1 ? 's' : ''}</>}
          </p>
        )}
      </div>
    </div>
  );
}

function hashPid(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
