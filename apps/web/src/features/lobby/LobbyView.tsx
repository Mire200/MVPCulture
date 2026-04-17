'use client';
import { useGameStore } from '@/store/gameStore';
import { AvatarBadge } from '@/components/AvatarPicker';
import { Copy, Check, Crown, Play, Settings2, Tags } from 'lucide-react';
import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameModeId } from '@mvpc/shared';
import { ALL_CATEGORIES } from '@mvpc/content';
import { mvpSound } from '@/lib/sound';

const MODE_LABELS: Record<string, string> = {
  classic: 'Classique',
  estimation: 'Estimation',
  'list-turns': 'Liste',
  'hot-potato': 'Patate',
  'speed-elim': 'Rapidité',
  map: 'Carte',
  chronology: 'Chrono',
};

const ALL_MODE_IDS: GameModeId[] = [
  'classic',
  'estimation',
  'list-turns',
  'hot-potato',
  'speed-elim',
  'map',
  'chronology',
];

export function LobbyView() {
  const snapshot = useGameStore((s) => s.snapshot);
  const myId = useGameStore((s) => s.playerId);
  const [copied, setCopied] = useState(false);
  const [rounds, setRounds] = useState(snapshot?.config.rounds ?? 8);
  const [modesPool, setModesPool] = useState<GameModeId[]>(
    (snapshot?.config.modesPool as GameModeId[]) ?? ['classic', 'estimation', 'list-turns'],
  );
  const [categoriesPool, setCategoriesPool] = useState<string[]>(
    snapshot?.config.categoriesPool ?? [],
  );

  if (!snapshot) return null;
  const isHost = snapshot.hostId === myId;
  const inviteUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/r/${snapshot.code}` : '';

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    mvpSound.click();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const start = () => {
    mvpSound.whoosh();
    const sock = getSocket();
    sock.emit('game:start', { config: { rounds, modesPool, categoriesPool } }, (res) => {
      if (!res.ok) alert(res.message);
    });
  };

  const toggleMode = (id: GameModeId) => {
    setModesPool((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const toggleCategory = (cat: string) => {
    setCategoriesPool((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  return (
    <main className="min-h-dvh px-4 py-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="chip-violet mb-3 inline-flex">● SALON OUVERT</div>
          <motion.h1
            className="font-display text-gradient font-extrabold leading-none"
            style={{ fontSize: 'clamp(56px, 10vw, 96px)', letterSpacing: '0.12em' }}
            animate={{
              textShadow: [
                '0 0 30px rgba(168,85,247,0.3)',
                '0 0 50px rgba(236,72,153,0.45)',
                '0 0 30px rgba(34,211,238,0.3)',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity, repeatType: 'reverse' }}
          >
            {snapshot.code}
          </motion.h1>
          <p className="text-text-muted text-sm mt-3">
            <span className="font-mono">{inviteUrl.replace(/^https?:\/\//, '')}</span>
            <span className="mx-1 text-text-dim">·</span>
            partage le lien ou le code
          </p>
        </div>
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={copyLink}
          className="btn-ghost min-w-[190px]"
        >
          {copied ? <Check className="w-4 h-4 text-neon-lime" /> : <Copy className="w-4 h-4" />}
          <span className="truncate">{copied ? 'Copié !' : 'Copier le lien'}</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">
              Joueurs{' '}
              <span className="text-text-muted font-normal">
                ({snapshot.players.length}/12)
              </span>
            </h2>
            <span className="text-text-dim text-xs">max 12</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <AnimatePresence>
              {snapshot.players.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.6, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.6, x: -40 }}
                  transition={{
                    type: 'spring',
                    stiffness: 260,
                    damping: 22,
                    delay: i * 0.03,
                  }}
                  className="panel-elevated p-3 flex items-center gap-3 relative overflow-hidden"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.6, 0] }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 'inherit',
                      background: `radial-gradient(circle at 16% 50%, ${p.avatar.color}55, transparent 60%)`,
                      pointerEvents: 'none',
                    }}
                  />
                  <AvatarBadge avatar={p.avatar} size="md" />
                  <div className="min-w-0 flex-1 relative">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold truncate">{p.nickname}</span>
                      {p.isHost && (
                        <Crown className="w-3.5 h-3.5 text-neon-amber shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-text-dim">
                      {p.isHost ? 'hôte' : p.id === myId ? 'toi' : 'en ligne'}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="panel p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-neon-cyan" />
            <h2 className="font-display text-xl font-semibold">Configuration</h2>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-text-muted uppercase tracking-[0.1em]">
              Nombre de manches
            </label>
            <input
              type="range"
              min={3}
              max={20}
              value={rounds}
              onChange={(e) => setRounds(parseInt(e.target.value, 10))}
              disabled={!isHost}
              className="w-full accent-neon-cyan"
            />
            <div className="text-right text-neon-cyan font-mono font-bold">
              {rounds} manches
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] text-text-muted uppercase tracking-[0.1em]">
              Modes actifs
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_MODE_IDS.map((id) => {
                const active = modesPool.includes(id);
                return (
                  <motion.button
                    key={id}
                    type="button"
                    disabled={!isHost}
                    whileHover={isHost ? { y: -1 } : undefined}
                    onClick={() => toggleMode(id)}
                    className={
                      active ? 'chip-cyan' : 'chip opacity-50 hover:opacity-80'
                    }
                  >
                    {MODE_LABELS[id]}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-text-muted uppercase tracking-[0.1em] flex items-center gap-1.5">
                <Tags className="w-3 h-3" />
                Catégories
                <span className="text-text-dim normal-case tracking-normal">
                  {categoriesPool.length === 0
                    ? '(toutes)'
                    : `(${categoriesPool.length}/${ALL_CATEGORIES.length})`}
                </span>
              </label>
              {isHost && categoriesPool.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCategoriesPool([])}
                  className="text-[10px] text-text-dim hover:text-neon-magenta uppercase tracking-wider"
                >
                  réinitialiser
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map((cat) => {
                const active = categoriesPool.includes(cat);
                return (
                  <motion.button
                    key={cat}
                    type="button"
                    disabled={!isHost}
                    whileHover={isHost ? { y: -1 } : undefined}
                    onClick={() => toggleCategory(cat)}
                    className={
                      active ? 'chip-magenta' : 'chip opacity-50 hover:opacity-80'
                    }
                  >
                    {cat}
                  </motion.button>
                );
              })}
            </div>
            {categoriesPool.length === 0 && (
              <p className="text-[10px] text-text-dim">
                Aucune sélection = toutes catégories actives.
              </p>
            )}
          </div>

          {isHost ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={modesPool.length === 0 || snapshot.players.length < 1}
              onClick={start}
              className="btn-primary w-full text-lg py-4 disabled:opacity-50"
            >
              <Play className="w-5 h-5" />
              Lancer la partie
            </motion.button>
          ) : (
            <div className="text-center text-text-muted text-sm py-4 border-t border-border">
              En attente de l'hôte…
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
