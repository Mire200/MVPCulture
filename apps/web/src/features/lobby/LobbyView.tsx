'use client';
import { useGameStore } from '@/store/gameStore';
import { AvatarBadge } from '@/components/AvatarPicker';
import { Copy, Check, Crown, Play, Settings2, Eraser, Grid3x3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameModeId } from '@mvpc/shared';
import { lobbyPenColorForPlayer } from '@mvpc/shared';
import { mvpSound } from '@/lib/sound';
import {
  LobbyDrawingCanvas,
  readStoredPenWidthNorm,
  DEFAULT_PEN_WIDTH_NORM,
} from './LobbyDrawingCanvas';
import { CodenamesLobbyPanel } from './CodenamesLobbyPanel';
import { TvPlayer } from '@/components/TvPlayer';

type ModeTone = 'cyan' | 'magenta' | 'violet' | 'lime' | 'amber' | 'rose';

const MODE_META: Record<GameModeId, {
  label: string;
  emoji: string;
  tone: ModeTone;
  solo?: boolean;
}> = {
  classic: { label: 'Classique', emoji: '📝', tone: 'cyan' },
  qcm: { label: 'QCM', emoji: '🔘', tone: 'violet' },
  estimation: { label: 'Estimation', emoji: '🎯', tone: 'amber' },
  'list-turns': { label: 'Liste', emoji: '📋', tone: 'lime' },
  'hot-potato': { label: 'Patate', emoji: '🥵', tone: 'rose' },
  'speed-elim': { label: 'Rapidité', emoji: '⚡', tone: 'amber' },
  map: { label: 'Carte', emoji: '🗺️', tone: 'cyan' },
  chronology: { label: 'Chrono', emoji: '⏳', tone: 'violet' },
  'guess-who': { label: 'Qui est-ce ?', emoji: '🕵️', tone: 'magenta', solo: true },
  imposter: { label: 'Imposteur', emoji: '🎭', tone: 'violet', solo: true },
  codenames: { label: 'Codenames', emoji: '🔤', tone: 'cyan', solo: true },
  wikirace: { label: 'Wikirace', emoji: '🏁', tone: 'lime', solo: true },
  'gartic-phone': { label: 'Gartic Phone', emoji: '✏️', tone: 'violet', solo: true },
  bombparty: { label: 'Bombparty', emoji: '💣', tone: 'amber', solo: true },
  'ticket-to-ride': { label: 'Aventuriers', emoji: '🚂', tone: 'amber', solo: true },
};

const ALL_MODE_IDS = Object.keys(MODE_META) as GameModeId[];

const TONE_RGB: Record<ModeTone, string> = {
  cyan: '34, 211, 238',
  magenta: '236, 72, 153',
  violet: '168, 85, 247',
  lime: '163, 230, 53',
  amber: '251, 191, 36',
  rose: '244, 63, 94',
};

const EXCLUSIVE_MODES = new Set<GameModeId>([
  'guess-who',
  'imposter',
  'codenames',
  'wikirace',
  'ticket-to-ride',
]);

export function LobbyView() {
  const snapshot = useGameStore((s) => s.snapshot);
  const myId = useGameStore((s) => s.playerId);
  const [copied, setCopied] = useState(false);
  const [penWidthNorm, setPenWidthNorm] = useState(DEFAULT_PEN_WIDTH_NORM);
  // Valeur locale du slider manches pour une UX fluide ; on debounce
  // l'émission vers le serveur afin d'éviter de spammer lobby:setConfig.
  const [roundsLocal, setRoundsLocal] = useState<number | null>(null);

  useEffect(() => {
    setPenWidthNorm(readStoredPenWidthNorm());
  }, []);

  // Reset local override pour les manches dès que la valeur serveur rattrape
  // (évite de garder un ancien override visuel si un autre client change).
  useEffect(() => {
    if (roundsLocal !== null && snapshot?.config.rounds === roundsLocal) {
      setRoundsLocal(null);
    }
  }, [snapshot?.config.rounds, roundsLocal]);

  if (!snapshot) return null;
  const isHost = snapshot.hostId === myId;
  const myPenColor = lobbyPenColorForPlayer(snapshot.players, myId);
  const inviteUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/r/${snapshot.code}` : '';

  // La config est la source de vérité côté serveur : tous les clients
  // (y compris non-hôte) affichent donc la même sélection et peuvent
  // agir en conséquence (ex. voir le panel Codenames).
  const modesPool = (snapshot.config.modesPool as GameModeId[]) ?? [];
  const roundsFromSnap = snapshot.config.rounds ?? 8;
  const rounds = roundsLocal ?? roundsFromSnap;

  const isGuessWho = modesPool.length === 1 && modesPool[0] === 'guess-who';
  const isImposter = modesPool.length === 1 && modesPool[0] === 'imposter';
  const isCodenames = modesPool.length === 1 && modesPool[0] === 'codenames';
  const isWikirace = modesPool.length === 1 && modesPool[0] === 'wikirace';
  const isTicketToRide = modesPool.length === 1 && modesPool[0] === 'ticket-to-ride';
  const isSoloMode =
    isGuessWho || isImposter || isCodenames || isWikirace || isTicketToRide;
  const notEnoughForImposter = isImposter && snapshot.players.length < 3;
  const redCount = snapshot.players.filter((p) => p.cnTeam === 'red').length;
  const blueCount = snapshot.players.filter((p) => p.cnTeam === 'blue').length;
  const notEnoughForCodenames =
    isCodenames && (redCount < 2 || blueCount < 2);

  const emitConfig = (partial: {
    rounds?: number;
    modesPool?: GameModeId[];
    categoriesPool?: string[];
  }) => {
    const sock = getSocket();
    sock.emit('lobby:setConfig', { config: partial }, (res) => {
      if (!res.ok) alert(res.message);
    });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    mvpSound.click();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const start = () => {
    mvpSound.whoosh();
    const sock = getSocket();
    const effectiveRounds = isSoloMode ? 1 : rounds;
    sock.emit(
      'game:start',
      { config: { rounds: effectiveRounds, modesPool, categoriesPool: [] } },
      (res) => {
        if (!res.ok) alert(res.message);
      },
    );
  };

  const toggleMode = (id: GameModeId) => {
    if (!isHost) return;
    const has = modesPool.includes(id);
    let next: GameModeId[];
    if (EXCLUSIVE_MODES.has(id)) {
      next = has ? [] : [id];
    } else {
      const cleaned = modesPool.filter((m) => !EXCLUSIVE_MODES.has(m));
      next = has ? cleaned.filter((m) => m !== id) : [...cleaned, id];
    }
    emitConfig({ modesPool: next });
  };

  const changeRounds = (n: number) => {
    if (!isHost) return;
    setRoundsLocal(n);
    emitConfig({ rounds: n });
  };

  const clearLobbyCanvas = () => {
    const sock = getSocket();
    sock.emit('lobby:draw:clear', (res) => {
      if (!res.ok) alert(res.message);
    });
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
        <div className="lg:col-span-2 panel p-6 space-y-4 relative overflow-hidden min-h-[220px]">
          <LobbyDrawingCanvas widthNorm={penWidthNorm} penColor={myPenColor} />
          <div className="relative z-10 space-y-4 pointer-events-none">
          <div className="flex items-center justify-between gap-2 pointer-events-auto">
            <h2 className="font-display text-xl font-semibold">
              Joueurs{' '}
              <span className="text-text-muted font-normal">
                ({snapshot.players.length}/12)
              </span>
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-text-dim text-xs hidden sm:inline">
                Dessine dans le fond ·
              </span>
              {isHost && (
                <button
                  type="button"
                  onClick={clearLobbyCanvas}
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-dim hover:text-neon-rose transition-colors"
                  title="Effacer tout le dessin pour tout le monde"
                >
                  <Eraser className="w-3 h-3" />
                  Effacer
                </button>
              )}
              <span className="text-text-dim text-xs">max 12</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pointer-events-auto border border-border/60 rounded-xl px-3 py-2 bg-bg/40">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-text-dim">Stylo</span>
              <span
                className="w-5 h-5 rounded-full border-2 border-white/30 shrink-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)]"
                style={{ backgroundColor: myPenColor }}
                title="Couleur fixe selon l’ordre d’arrivée dans le salon"
              />
            </div>
            <label className="flex items-center gap-2 flex-1 min-w-[160px] max-w-[260px]">
              <span className="text-[10px] text-text-dim whitespace-nowrap">Épaisseur</span>
              <input
                type="range"
                min={4}
                max={120}
                step={1}
                value={Math.round(penWidthNorm * 1000)}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  const next = Math.min(0.12, Math.max(0.004, v / 1000));
                  setPenWidthNorm(next);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('mvpc.lobby.penWidthNorm', String(next));
                  }
                }}
                className="flex-1 h-1.5 rounded-full accent-neon-cyan bg-surface-2"
                aria-label="Épaisseur du trait"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pointer-events-auto">
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
                  className="panel-elevated p-3 flex items-center gap-3 relative overflow-hidden z-20"
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
              value={isSoloMode ? 1 : rounds}
              onChange={(e) => changeRounds(parseInt(e.target.value, 10))}
              disabled={!isHost || isSoloMode}
              className="w-full accent-neon-cyan disabled:opacity-50"
            />
            <div className="text-right text-neon-cyan font-mono font-bold">
              {isSoloMode ? 'Partie unique' : `${rounds} manches`}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-text-muted uppercase tracking-[0.1em]">
                Modes actifs
              </label>
              <span className="text-[10px] text-text-dim">
                {modesPool.length} sélectionné{modesPool.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODE_IDS.map((id) => {
                const meta = MODE_META[id];
                const active = modesPool.includes(id);
                const rgb = TONE_RGB[meta.tone];
                return (
                  <motion.button
                    key={id}
                    type="button"
                    disabled={!isHost}
                    whileHover={isHost ? { y: -2 } : undefined}
                    whileTap={isHost ? { scale: 0.97 } : undefined}
                    onClick={() => toggleMode(id)}
                    className="relative flex items-center text-left rounded-xl px-3 py-3 min-h-[56px] border transition-all duration-150 disabled:cursor-not-allowed"
                    style={{
                      borderColor: active
                        ? `rgba(${rgb}, 0.6)`
                        : 'rgba(148, 163, 184, 0.15)',
                      background: active
                        ? `linear-gradient(135deg, rgba(${rgb}, 0.18), rgba(${rgb}, 0.04))`
                        : 'rgba(15, 23, 42, 0.35)',
                      boxShadow: active
                        ? `0 0 0 1px rgba(${rgb}, 0.35), 0 8px 24px -12px rgba(${rgb}, 0.6), inset 0 1px 0 rgba(255,255,255,0.04)`
                        : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                      opacity: !isHost && !active ? 0.45 : 1,
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-lg leading-none shrink-0">{meta.emoji}</span>
                      <span
                        className="font-semibold text-[13px] leading-tight break-words min-w-0 flex-1"
                        style={{ color: active ? `rgb(${rgb})` : 'var(--text)' }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    {meta.solo && (
                      <span
                        className="absolute bottom-1.5 right-2 text-[8.5px] uppercase tracking-wider font-semibold"
                        style={{ color: `rgba(${rgb}, 0.75)` }}
                      >
                        solo
                      </span>
                    )}
                    {active && (
                      <motion.span
                        layoutId={`mode-dot-${id}`}
                        className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                        style={{ background: `rgb(${rgb})`, boxShadow: `0 0 8px rgb(${rgb})` }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
            {modesPool.length === 0 && (
              <p className="text-[10px] text-neon-rose/80">
                Sélectionne au moins un mode pour lancer.
              </p>
            )}
          </div>

          {isImposter && (
            <div
              className={`text-xs px-3 py-2 rounded-lg border ${
                notEnoughForImposter
                  ? 'border-neon-rose/40 bg-neon-rose/5 text-neon-rose'
                  : 'border-neon-violet/30 bg-neon-violet/5 text-text-muted'
              }`}
            >
              {notEnoughForImposter
                ? 'Il faut au moins 3 joueurs pour l’imposteur.'
                : 'Mode imposteur : 1 imposteur, 2 tours d’indices, vote puis scoring riche.'}
            </div>
          )}

          {isCodenames && (
            <div
              className={`text-xs px-3 py-2 rounded-lg border flex items-start gap-2 ${
                notEnoughForCodenames
                  ? 'border-neon-rose/40 bg-neon-rose/5 text-neon-rose'
                  : 'border-neon-cyan/30 bg-neon-cyan/5 text-text-muted'
              }`}
            >
              <Grid3x3 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {notEnoughForCodenames
                  ? 'Chaque équipe doit avoir au moins 2 joueurs.'
                  : 'Codenames : 2 équipes avec 1 spymaster chacune. Partie unique.'}
              </span>
            </div>
          )}

          {isHost ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={
                modesPool.length === 0 ||
                snapshot.players.length < 1 ||
                notEnoughForImposter ||
                notEnoughForCodenames
              }
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

      {isCodenames && (
        <CodenamesLobbyPanel
          players={snapshot.players}
          myId={myId}
        />
      )}

      <TvPlayer />
    </main>
  );
}
