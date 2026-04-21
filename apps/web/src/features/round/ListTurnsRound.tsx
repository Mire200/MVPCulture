'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarBadge } from '@/components/AvatarPicker';
import { Send, Flame, XCircle, Clock, Trophy } from 'lucide-react';
import type { Player } from '@mvpc/shared';

/**
 * Mode "liste tour par tour" : cercle central avec l'ordre de passage.
 *
 * Chaque joueur est placé à un angle fixe autour du cercle (déterminé côté
 * serveur via `round.turnOrder`). Un indicateur (rayon + halo néon) pivote
 * pour pointer le joueur dont c'est le tour. Les éliminés restent visibles
 * mais sont grisés + marqués d'une croix + flamme de pénalité au moment
 * exact où ils sortent.
 *
 * Au centre : le joueur actif en grand, son pseudo, et l'input pour soumettre
 * une réponse (s'il s'agit du joueur local).
 */
export function ListTurnsRound() {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const myId = useGameStore((s) => s.playerId);
  const eliminations = useGameStore((s) => s.eliminations);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [shake, setShake] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const round = snapshot.round!;
  const currentId = round.currentPlayerId;
  const isMyTurn = currentId === myId;
  const iAmEliminated = eliminations.some((e) => e.playerId === myId);

  // Ordre figé depuis le serveur ; fallback sur l'ordre actuel des joueurs si
  // jamais l'info n'est pas (encore) dans le snapshot.
  const order = useMemo<string[]>(() => {
    if (round.turnOrder && round.turnOrder.length > 0) return round.turnOrder;
    return snapshot.players.map((p) => p.id);
  }, [round.turnOrder, snapshot.players]);

  const eliminatedSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of eliminations) s.add(e.playerId);
    if (round.turnEliminated) for (const id of round.turnEliminated) s.add(id);
    return s;
  }, [eliminations, round.turnEliminated]);

  const playersById = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of snapshot.players) m.set(p.id, p);
    return m;
  }, [snapshot.players]);

  const orderedPlayers = order
    .map((id) => playersById.get(id))
    .filter((p): p is Player => !!p);

  const currentIndex = currentId
    ? orderedPlayers.findIndex((p) => p.id === currentId)
    : -1;
  const current = currentIndex >= 0 ? orderedPlayers[currentIndex] : undefined;
  const n = orderedPlayers.length;

  useEffect(() => {
    if (isMyTurn && !iAmEliminated) {
      inputRef.current?.focus();
    }
  }, [isMyTurn, iAmEliminated]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMyTurn || !value.trim() || pending) return;
    setPending(true);
    const sock = getSocket();
    const text = value.trim();
    sock.emit('round:answer', { listItem: text }, (res) => {
      setPending(false);
      if (!res.ok) {
        // L'erreur peut être "déjà utilisé" ou "pas valide" → petit shake +
        // on laisse l'utilisateur corriger / réessayer sur le même tour.
        setShake((s) => s + 1);
      } else {
        setValue('');
      }
    });
  };

  // Géométrie du cercle : rayon, angle par joueur (0 = midi, sens horaire).
  // On utilise % pour rester fluide, et les valeurs CSS exactes en px pour
  // positionner chaque avatar.
  const size = 360; // taille du conteneur en px (responsive clamp plus bas via CSS)
  const ringRadius = size / 2 - 36; // 36 = demi-largeur avatar + marge

  return (
    <div className="space-y-5">
      <div className="panel p-5 sm:p-6">
        <div className="flex items-center justify-center mb-3">
          <div className="chip-violet">
            <Flame className="w-3.5 h-3.5" />
            Ordre de passage
          </div>
        </div>

        {/* Conteneur cercle — centré, avec viewport scalable via CSS. */}
        <div className="lt-ring-wrap">
          <div
            className="lt-ring"
            style={
              {
                '--ring-size': `${size}px`,
              } as React.CSSProperties
            }
          >
            {/* Anneau décoratif */}
            <div className="lt-ring-circle" />
            <div className="lt-ring-dotted" />

            {/* Indicateur rotatif (rayon + halo) pointant vers le joueur actif. */}
            {currentIndex >= 0 && n > 0 && (
              <motion.div
                className="lt-ring-pointer"
                initial={false}
                animate={{ rotate: (360 * currentIndex) / n }}
                transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              >
                <div className="lt-ring-pointer-beam" />
                <div className="lt-ring-pointer-dot" />
              </motion.div>
            )}

            {/* Avatars autour du cercle. */}
            {orderedPlayers.map((p, i) => {
              const angle = (2 * Math.PI * i) / n - Math.PI / 2;
              const x = Math.cos(angle) * ringRadius;
              const y = Math.sin(angle) * ringRadius;
              const isActive = p.id === currentId;
              const isOut = eliminatedSet.has(p.id);
              return (
                <motion.div
                  key={p.id}
                  className="lt-ring-slot"
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                  }}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{
                    scale: isActive ? 1.1 : isOut ? 0.82 : 0.95,
                    opacity: isOut ? 0.45 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                >
                  <div
                    className={
                      'lt-ring-avatar ' +
                      (isActive
                        ? 'lt-ring-avatar-active'
                        : isOut
                          ? 'lt-ring-avatar-out'
                          : 'lt-ring-avatar-idle')
                    }
                  >
                    <AvatarBadge avatar={p.avatar} size="md" />
                    {isActive && (
                      <motion.div
                        className="lt-ring-active-halo"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.2, 0.9, 0.2] }}
                        transition={{
                          duration: 1.6,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    )}
                    {isOut && (
                      <>
                        <div className="lt-ring-cross">
                          <XCircle className="w-6 h-6" />
                        </div>
                        <motion.div
                          className="lt-ring-flame"
                          initial={{ scale: 0, y: 0, opacity: 0 }}
                          animate={{
                            scale: [0, 1.2, 1],
                            y: [8, -6, -4],
                            opacity: [0, 1, 0.7],
                          }}
                          transition={{ duration: 0.7 }}
                        >
                          <Flame className="w-4 h-4" />
                        </motion.div>
                      </>
                    )}
                    {p.id === myId && !isOut && (
                      <span className="lt-ring-you">toi</span>
                    )}
                  </div>
                  <div
                    className={
                      'lt-ring-name ' +
                      (isActive ? 'text-text' : 'text-text-muted')
                    }
                    title={p.nickname}
                  >
                    {p.nickname}
                  </div>
                </motion.div>
              );
            })}

            {/* Bulle centrale : joueur actif + input / statut. */}
            <div className="lt-ring-center">
              <AnimatePresence mode="wait">
                {current ? (
                  <motion.div
                    key={current.id}
                    initial={{ scale: 0.85, opacity: 0, rotate: -6 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.85, opacity: 0, rotate: 6 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                    className="lt-ring-center-inner"
                  >
                    <AvatarBadge avatar={current.avatar} size="xl" />
                    <div className="lt-ring-center-name font-display">
                      {current.nickname}
                    </div>
                    <div className="lt-ring-center-sub">
                      {isMyTurn ? (
                        <span className="text-neon-cyan font-semibold">
                          À toi !
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 justify-center">
                          <Clock className="w-3 h-3" />
                          en train de répondre
                        </span>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="lt-ring-center-inner">
                    <Trophy className="w-8 h-8 text-neon-amber" />
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Zone d'action sous le cercle */}
        <div className="mt-5">
          {isMyTurn && !iAmEliminated ? (
            <motion.form
              key={shake}
              onSubmit={send}
              initial={false}
              animate={
                shake > 0
                  ? { x: [0, -8, 8, -6, 6, 0] }
                  : { x: 0 }
              }
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 max-w-md mx-auto"
            >
              <input
                ref={inputRef}
                className="input text-lg text-center"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Cite un élément…"
                disabled={pending}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={pending || !value.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </motion.form>
          ) : iAmEliminated ? (
            <div className="text-neon-magenta flex items-center justify-center gap-2 py-2">
              <Flame className="w-4 h-4" />
              Tu es éliminé. Regarde les autres continuer !
            </div>
          ) : (
            <p className="text-text-muted text-center py-2">
              Patience… en attendant ton tour.
            </p>
          )}
        </div>
      </div>

      {/* Journal d'éliminations (recap rapide sous le cercle). */}
      <div className="panel p-4">
        <div className="text-xs text-text-muted mb-2 uppercase tracking-widest">
          Éliminations
        </div>
        <AnimatePresence>
          {eliminations.length === 0 && (
            <div className="text-text-dim text-sm py-2">
              Aucun éliminé pour l'instant.
            </div>
          )}
          {eliminations.map((e, i) => {
            const p = playersById.get(e.playerId);
            if (!p) return null;
            const reasonLabel =
              e.reason === 'duplicate'
                ? 'doublon'
                : e.reason === 'invalid'
                  ? 'réponse invalide'
                  : 'temps écoulé';
            return (
              <motion.div
                key={`${e.playerId}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 py-1.5"
              >
                <AvatarBadge avatar={p.avatar} size="sm" />
                <span className="font-semibold">{p.nickname}</span>
                <span className="text-text-muted text-sm">— {reasonLabel}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
