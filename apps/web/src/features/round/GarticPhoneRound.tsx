'use client';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Loader2, Pencil, Send, Type, FastForward } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { AvatarBadge } from '@/components/AvatarPicker';
import { GarticCanvas } from './GarticCanvas';
import { cn } from '@/lib/cn';

export function GarticPhoneRound() {
  const snapshot = useGameStore((s) => s.snapshot);
  const myId = useGameStore((s) => s.playerId);
  const garticPrompt = useGameStore((s) => s.garticPrompt);

  if (!snapshot?.round) return null;
  const r = snapshot.round;
  const phase = r.gpPhase ?? 'write';
  const stepIndex = r.gpStepIndex ?? 0;
  const totalSteps = r.gpTotalSteps ?? 0;
  const submitted = new Set(r.gpSubmitted ?? []);
  const iSubmitted = submitted.has(myId ?? '');

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="panel p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <div className="chip-violet">
            {phase === 'write' && (
              <>
                <Type className="w-3.5 h-3.5" /> Écris une phrase
              </>
            )}
            {phase === 'draw' && (
              <>
                <Pencil className="w-3.5 h-3.5" /> Dessine !
              </>
            )}
            {phase === 'guess' && (
              <>
                <Type className="w-3.5 h-3.5" /> Devine le dessin
              </>
            )}
            {phase === 'reveal' && 'Révélation 🎬'}
            {phase === 'done' && 'Terminé ✨'}
          </div>
          <div className="text-text-dim">
            Étape {stepIndex + 1}/{totalSteps}
          </div>
        </div>
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, var(--neon-cyan), var(--neon-violet), var(--neon-magenta))',
            }}
            initial={false}
            animate={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Phase content */}
      <AnimatePresence mode="wait">
        {phase === 'write' && (
          <WritePhase key="write" iSubmitted={iSubmitted} submitted={submitted} />
        )}
        {phase === 'draw' && (
          <DrawPhase key="draw" prompt={garticPrompt} iSubmitted={iSubmitted} submitted={submitted} />
        )}
        {phase === 'guess' && (
          <GuessPhase key="guess" prompt={garticPrompt} iSubmitted={iSubmitted} submitted={submitted} />
        )}
        {phase === 'reveal' && (
          <RevealPhase key="reveal" />
        )}
        {phase === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="panel p-6 text-center text-text-muted"
          >
            Partie terminée — en attente de la révélation.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Players submission status */}
      {phase !== 'reveal' && phase !== 'done' && (
        <SubmissionStatus submitted={submitted} />
      )}
    </div>
  );
}

/* ─────────────── WRITE PHASE ─────────────── */

function WritePhase({
  iSubmitted,
  submitted,
}: {
  iSubmitted: boolean;
  submitted: Set<string>;
}) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || sending) return;
    setSending(true);
    const sock = getSocket();
    sock.emit('garticPhone:submitText', { text: value.trim() }, (res) => {
      setSending(false);
      if (!res.ok) alert(res.message);
    });
  };

  if (iSubmitted) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel p-6 text-center">
        <Check className="w-6 h-6 text-neon-lime mx-auto mb-2" />
        <div className="text-text-muted text-sm">Phrase envoyée ! En attente des autres…</div>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onSubmit={send}
      className="panel p-5 space-y-3"
    >
      <div className="text-sm text-text-muted">
        Écris une phrase, une scène, un concept… Le joueur suivant devra la dessiner !
      </div>
      <input
        autoFocus
        className="input text-lg"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={sending}
        maxLength={200}
        placeholder="Un pingouin qui fait du surf au coucher du soleil…"
      />
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={sending || !value.trim()}
        className="btn-primary w-full"
      >
        <Send className="w-5 h-5" />
        Envoyer
      </motion.button>
    </motion.form>
  );
}

/* ─────────────── DRAW PHASE ─────────────── */

function DrawPhase({
  prompt,
  iSubmitted,
  submitted,
}: {
  prompt: { type: 'text' | 'drawing'; content: string } | null;
  iSubmitted: boolean;
  submitted: Set<string>;
}) {
  const [sending, setSending] = useState(false);

  const handleExport = useCallback(
    (dataUrl: string) => {
      if (sending) return;
      setSending(true);
      const sock = getSocket();
      sock.emit('garticPhone:submitDrawing', { dataUrl }, (res) => {
        setSending(false);
        if (!res.ok) alert(res.message);
      });
    },
    [sending],
  );

  if (iSubmitted) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel p-6 text-center">
        <Check className="w-6 h-6 text-neon-lime mx-auto mb-2" />
        <div className="text-text-muted text-sm">Dessin envoyé ! En attente des autres…</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="panel p-5 space-y-4"
    >
      {prompt?.type === 'text' && (
        <div className="panel-elevated p-4 text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-dim mb-1">
            Dessine cette phrase
          </div>
          <div className="text-lg font-display text-neon-cyan">{prompt.content}</div>
        </div>
      )}
      <GarticCanvas onExport={handleExport} disabled={sending} />
    </motion.div>
  );
}

/* ─────────────── GUESS PHASE ─────────────── */

function GuessPhase({
  prompt,
  iSubmitted,
  submitted,
}: {
  prompt: { type: 'text' | 'drawing'; content: string } | null;
  iSubmitted: boolean;
  submitted: Set<string>;
}) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || sending) return;
    setSending(true);
    const sock = getSocket();
    sock.emit('garticPhone:submitText', { text: value.trim() }, (res) => {
      setSending(false);
      if (!res.ok) alert(res.message);
    });
  };

  if (iSubmitted) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel p-6 text-center">
        <Check className="w-6 h-6 text-neon-lime mx-auto mb-2" />
        <div className="text-text-muted text-sm">Devinette envoyée ! En attente des autres…</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="panel p-5 space-y-4"
    >
      {prompt?.type === 'drawing' && prompt.content && (
        <div className="panel-elevated p-3 flex justify-center">
          <img
            src={prompt.content}
            alt="Dessin à deviner"
            className="rounded-lg max-w-full"
            style={{ maxHeight: 360 }}
          />
        </div>
      )}
      <form onSubmit={send} className="space-y-3">
        <div className="text-sm text-text-muted">
          Que représente ce dessin ? Décris-le en une phrase.
        </div>
        <input
          autoFocus
          className="input text-lg"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={sending}
          maxLength={200}
          placeholder="Je pense que c'est…"
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={sending || !value.trim()}
          className="btn-primary w-full"
        >
          <Send className="w-5 h-5" />
          Envoyer
        </motion.button>
      </form>
    </motion.div>
  );
}

/* ─────────────── REVEAL PHASE ─────────────── */

function RevealPhase() {
  const snapshot = useGameStore((s) => s.snapshot);
  const myId = useGameStore((s) => s.playerId);
  if (!snapshot?.round) return null;
  const r = snapshot.round;
  const chainIdx = r.gpRevealChainIndex ?? 0;
  const stepIdx = r.gpRevealStepIndex ?? 0;
  const fullChain = r.gpRevealChain ?? [];
  const chain = fullChain.slice(0, stepIdx);
  const playerOrder = r.gpPlayerOrder ?? [];
  const chainOwner = playerOrder[chainIdx];
  const ownerPlayer = snapshot.players.find((p) => p.id === chainOwner);
  const isHost = snapshot.hostId === myId;
  const [advancing, setAdvancing] = useState(false);

  const advance = useCallback(() => {
    if (!isHost || advancing) return;
    setAdvancing(true);
    const sock = getSocket();
    sock.emit('garticPhone:advanceReveal', {}, (res) => {
      setAdvancing(false);
      if (!res.ok) alert(res.message);
    });
  }, [isHost, advancing]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="panel p-5 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="chip-magenta">🎬 Chaîne de</div>
        {ownerPlayer && (
          <div className="flex items-center gap-2">
            <AvatarBadge avatar={ownerPlayer.avatar} size="sm" />
            <span className="font-semibold">{ownerPlayer.nickname}</span>
          </div>
        )}
        <div className="ml-auto text-xs text-text-dim">
          {chainIdx + 1}/{playerOrder.length}
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {chain.map((entry, i) => {
            const player = snapshot.players.find((p) => p.id === entry.playerId);
            const isEven = i % 2 === 0;
            return (
              <motion.div
                key={`${chainIdx}-${i}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={cn(
                  'flex flex-col gap-1 w-fit max-w-[85%]',
                  isEven ? 'mr-auto items-start' : 'ml-auto items-end'
                )}
              >
                <div className={cn('flex items-center gap-1.5 text-xs text-text-dim px-2', isEven ? 'flex-row' : 'flex-row-reverse')}>
                  {player && <AvatarBadge avatar={player.avatar} size="xs" />}
                  <span className="font-semibold">{player?.nickname ?? 'Joueur'}</span>
                  <span>·</span>
                  <span>{entry.type === 'text' ? 'a écrit' : 'a dessiné'}</span>
                </div>
                
                <div
                  className={cn(
                    'p-4 rounded-2xl shadow-sm border border-white/5',
                    isEven 
                      ? 'bg-surface-2 rounded-tl-sm' 
                      : 'bg-neon-violet/10 rounded-tr-sm border-neon-violet/20'
                  )}
                >
                  {entry.type === 'text' ? (
                    <div className="text-text font-display text-xl leading-tight whitespace-pre-wrap">{entry.content}</div>
                  ) : entry.content ? (
                    <img
                      src={entry.content}
                      alt="Dessin"
                      className="rounded-lg object-contain max-w-full"
                      style={{ maxHeight: 280 }}
                    />
                  ) : (
                    <div className="text-text-dim italic text-sm">(pas de dessin)</div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {chain.length === 0 && (
        <div className="text-center py-8 text-text-dim">
          Le téléphone arabe de {ownerPlayer?.nickname ?? 'ce joueur'} s'apprête à être révélé...
        </div>
      )}

      {isHost && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.97 }}
          onClick={advance}
          disabled={advancing}
          className="btn-primary w-full mt-6"
        >
          {advancing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : stepIdx >= fullChain.length ? (
            chainIdx + 1 >= playerOrder.length ? (
              <><Check className="w-5 h-5" /> Terminer</>
            ) : (
              <><FastForward className="w-5 h-5" /> Chaîne suivante</>
            )
          ) : (
            <><ChevronRight className="w-5 h-5" /> Suivant</>
          )}
        </motion.button>
      )}
    </motion.div>
  );
}

/* ─────────────── SUBMISSION STATUS ─────────────── */

function SubmissionStatus({ submitted }: { submitted: Set<string> }) {
  const snapshot = useGameStore((s) => s.snapshot);
  if (!snapshot) return null;

  return (
    <div className="panel p-4">
      <div className="text-[10px] uppercase tracking-widest text-text-dim mb-2">
        Soumissions
      </div>
      <div className="flex flex-wrap gap-2">
        {snapshot.players.map((p) => {
          const done = submitted.has(p.id);
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition',
                done
                  ? 'bg-neon-lime/10 text-neon-lime'
                  : 'bg-bg-soft text-text-dim',
              )}
            >
              <AvatarBadge avatar={p.avatar} size="xs" />
              <span className="truncate max-w-[5rem]">{p.nickname}</span>
              {done && <Check className="w-3 h-3" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
