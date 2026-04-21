'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Check,
  Eye,
  EyeOff,
  Vote,
  UserSearch,
  Sparkles,
  AlertTriangle,
  Mic,
  Clock3,
} from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { AvatarBadge } from '@/components/AvatarPicker';
import { cn } from '@/lib/cn';

export function ImposterRound() {
  const snapshot = useGameStore((s) => s.snapshot);
  const myId = useGameStore((s) => s.playerId);
  const myWord = useGameStore((s) => s.imposterMyWord);

  if (!snapshot?.round) return null;
  const r = snapshot.round;
  const phase = r.imPhase ?? 'clue-1';
  // Le client n'apprend l'identité de l'imposteur qu'à la phase 'guess' ou
  // à la révélation. On s'en sert uniquement pour afficher le bon écran au
  // joueur démasqué (ou aux autres) durant le guess final.
  const iAmImposter = r.imImposterId != null && r.imImposterId === myId;

  return (
    <div className="space-y-4">
      <SecretWordCard word={myWord} />
      {(phase === 'clue-1' || phase === 'clue-2') && <CluePhase />}
      {phase === 'vote' && <VotePhase />}
      {phase === 'guess' && <GuessPhase iAmImposter={iAmImposter} />}
      {phase === 'done' && (
        <div className="panel p-6 text-center text-text-muted">
          <Sparkles className="w-5 h-5 mx-auto mb-2 text-neon-lime" />
          Fin de manche — révélation en cours…
        </div>
      )}
      {snapshot.players.length >= 1 && <CluesTable />}
    </div>
  );
}

function SecretWordCard({ word }: { word: string | null }) {
  const [hidden, setHidden] = useState(false);
  if (!word) {
    return (
      <div className="panel p-4 text-center text-text-muted">
        En attente du mot secret…
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel p-4 sm:p-5 flex items-center justify-between gap-4 relative overflow-hidden ring-cyan"
    >
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-dim mb-1">
          Ton mot secret
        </div>
        <div
          className="font-display font-extrabold leading-none truncate text-neon-cyan"
          style={{ fontSize: 'clamp(24px, 4vw, 34px)' }}
        >
          {hidden ? '••••••' : word}
        </div>
        <div className="text-xs text-text-muted mt-2">
          Donne un indice discret : assez clair pour les autres, assez flou pour
          piéger l’imposteur (qui ne sait pas qu’il en est un !).
        </div>
      </div>
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        className="btn-ghost shrink-0"
        title={hidden ? 'Afficher le mot' : 'Masquer le mot'}
      >
        {hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        <span className="hidden sm:inline">{hidden ? 'Afficher' : 'Masquer'}</span>
      </button>
    </motion.div>
  );
}

function CluePhase() {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const myId = useGameStore((s) => s.playerId);
  const r = snapshot.round!;
  const phase = r.imPhase ?? 'clue-1';
  const roundIdx = phase === 'clue-1' ? 0 : 1;
  const speakerId = r.currentPlayerId ?? null;
  const isMyTurn = !!myId && speakerId === myId;
  const speaker = useMemo(
    () => snapshot.players.find((p) => p.id === speakerId) ?? null,
    [snapshot.players, speakerId],
  );
  const submittedCount = Object.keys(r.imClues?.[roundIdx] ?? {}).length;
  const total = snapshot.players.length;

  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset la saisie quand c'est à un autre joueur de parler.
  useEffect(() => {
    setValue('');
    setSubmitting(false);
  }, [speakerId, phase]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || submitting || !isMyTurn) return;
    setSubmitting(true);
    const sock = getSocket();
    sock.emit('imposter:submitClue', { clue: value.trim() }, (res) => {
      setSubmitting(false);
      if (!res.ok) {
        if (res.code === 'INVALID_PAYLOAD') {
          alert('Ce mot est trop proche du mot secret — trouve autre chose.');
        } else if (res.code === 'NOT_YOUR_TURN') {
          // Le serveur a déjà avancé le tour : silencieux.
        } else {
          alert(res.message);
        }
      }
    });
  };

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="chip-violet">
          <Vote className="w-3.5 h-3.5" />
          Tour d’indices {roundIdx + 1}/2
        </div>
        <div className="text-xs text-text-muted">
          {submittedCount}/{total} joueur{total > 1 ? 's' : ''} ont parlé
        </div>
      </div>

      {isMyTurn ? (
        <form onSubmit={send} className="space-y-3">
          <div className="chip-magenta inline-flex">
            <Mic className="w-3.5 h-3.5" />
            À toi de jouer
          </div>
          <label className="text-text-muted text-sm block">
            Ton indice (1 mot idéalement, 40 caractères max)
          </label>
          <input
            autoFocus
            className="input text-xl"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={submitting}
            maxLength={40}
            placeholder="Un indice qui ne balance pas le mot…"
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={submitting || !value.trim()}
            className="btn-primary w-full disabled:opacity-60"
          >
            <Send className="w-5 h-5" />
            Envoyer l’indice
          </motion.button>
        </form>
      ) : (
        <div className="panel-elevated p-4 flex items-center gap-3">
          {speaker ? (
            <>
              <AvatarBadge avatar={speaker.avatar} size="md" />
              <div className="min-w-0">
                <div className="text-sm">
                  <span className="font-semibold text-text">{speaker.nickname}</span>{' '}
                  réfléchit à son indice…
                </div>
                <div className="text-xs text-text-dim flex items-center gap-1 mt-0.5">
                  <Clock3 className="w-3 h-3" />
                  On attend que ce soit ton tour.
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-text-muted">En attente du prochain joueur…</div>
          )}
        </div>
      )}

      <TurnOrderStrip speakerId={speakerId} roundIdx={roundIdx} />
    </div>
  );
}

function TurnOrderStrip({
  speakerId,
  roundIdx,
}: {
  speakerId: string | null;
  roundIdx: number;
}) {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const r = snapshot.round!;
  const map = r.imClues?.[roundIdx] ?? {};
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
      <div className="text-[10px] uppercase tracking-widest text-text-dim mr-1">
        Ordre
      </div>
      {snapshot.players.map((p) => {
        const hasSpoken = !!map[p.id];
        const isSpeaker = speakerId === p.id;
        return (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
              isSpeaker
                ? 'bg-neon-magenta/15 ring-1 ring-neon-magenta text-text'
                : hasSpoken
                  ? 'bg-neon-lime/10 text-text-muted'
                  : 'bg-bg-soft text-text-dim',
            )}
          >
            <AvatarBadge avatar={p.avatar} size="xs" />
            <span className="truncate max-w-[6rem]">{p.nickname}</span>
            {hasSpoken && !isSpeaker && (
              <Check className="w-3 h-3 text-neon-lime" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function VotePhase() {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const myId = useGameStore((s) => s.playerId);
  const r = snapshot.round!;
  const voters = new Set(r.imVoters ?? []);
  const alreadyVoted = voters.has(myId ?? '');
  const [pending, setPending] = useState<string | null>(null);

  const choose = (targetId: string) => {
    if (alreadyVoted || pending) return;
    setPending(targetId);
    const sock = getSocket();
    sock.emit('imposter:vote', { targetId }, (res) => {
      if (!res.ok) {
        setPending(null);
        alert(res.message);
      }
    });
  };

  const others = snapshot.players.filter((p) => p.id !== myId);

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="chip-magenta">
          <UserSearch className="w-3.5 h-3.5" />
          Qui est l’imposteur ?
        </div>
        <div className="text-xs text-text-muted">
          {voters.size}/{snapshot.players.length} joueurs ont voté
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {others.map((p) => {
          const voted = voters.has(p.id);
          const isMyPick = pending === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={alreadyVoted || !!pending}
              onClick={() => choose(p.id)}
              className={cn(
                'panel-elevated p-3 flex flex-col items-center gap-2 transition border-2',
                isMyPick
                  ? 'border-neon-rose ring-magenta'
                  : alreadyVoted
                    ? 'border-border opacity-70'
                    : 'border-border hover:border-neon-rose',
              )}
            >
              <AvatarBadge avatar={p.avatar} size="lg" />
              <div className="text-sm font-semibold truncate max-w-full">{p.nickname}</div>
              {voted && (
                <div className="text-[10px] text-neon-lime uppercase tracking-wider">
                  a voté
                </div>
              )}
            </button>
          );
        })}
      </div>
      {alreadyVoted && (
        <div className="text-xs text-text-muted text-center">
          Vote enregistré. Les votes sont anonymes jusqu’à la révélation.
        </div>
      )}
    </div>
  );
}

function GuessPhase({ iAmImposter }: { iAmImposter: boolean }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!iAmImposter) {
    return (
      <div className="panel p-6 text-center space-y-2">
        <div className="chip-amber inline-flex mx-auto">
          <AlertTriangle className="w-3.5 h-3.5" />
          Imposteur démasqué !
        </div>
        <p className="text-text-muted text-sm">
          Il a une dernière chance : deviner ton mot pour sauver des points. Croise les doigts…
        </p>
      </div>
    );
  }

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    const sock = getSocket();
    sock.emit('imposter:guessWord', { guess: value.trim() }, (res) => {
      setSubmitting(false);
      if (!res.ok) alert(res.message);
    });
  };

  return (
    <form onSubmit={send} className="panel p-5 space-y-3 ring-magenta">
      <div className="chip-magenta">
        <AlertTriangle className="w-3.5 h-3.5" />
        Surprise : tu étais l’imposteur — dernière chance
      </div>
      <p className="text-sm text-text-muted">
        Les autres t’ont pointé du doigt. Devine leur vrai mot pour grappiller 2 points. Sinon, tu repars bredouille.
      </p>
      <input
        autoFocus
        className="input text-xl"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={submitting}
        maxLength={60}
        placeholder="Le mot que tous les autres avaient…"
      />
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={submitting || !value.trim()}
        className="btn-primary w-full disabled:opacity-60"
      >
        <Send className="w-5 h-5" />
        Valider ma réponse
      </motion.button>
    </form>
  );
}

function CluesTable() {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const r = snapshot.round!;
  const clues0 = r.imClues?.[0] ?? {};
  const clues1 = r.imClues?.[1] ?? {};
  const any0 = Object.keys(clues0).length > 0;
  const any1 = Object.keys(clues1).length > 0;
  if (!any0 && !any1) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="panel p-4 space-y-2"
    >
      <div className="text-[10px] uppercase tracking-widest text-text-dim">
        Indices du tour
      </div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-2 text-sm">
        <div />
        <div className="text-[10px] uppercase tracking-wider text-text-dim">Tour 1</div>
        <div className="text-[10px] uppercase tracking-wider text-text-dim">Tour 2</div>
        <AnimatePresence initial={false}>
          {snapshot.players.map((p) => {
            const c0 = clues0[p.id];
            const c1 = clues1[p.id];
            return (
              <motion.div
                key={`row-${p.id}`}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="contents"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AvatarBadge avatar={p.avatar} size="xs" />
                  <span className="truncate text-xs font-semibold">{p.nickname}</span>
                </div>
                <div
                  className={cn(
                    'px-2 py-1 rounded-md text-xs',
                    c0 ? 'bg-surface-2 text-text' : 'bg-bg-soft text-text-dim italic',
                  )}
                >
                  {c0 || '—'}
                </div>
                <div
                  className={cn(
                    'px-2 py-1 rounded-md text-xs',
                    c1 ? 'bg-surface-2 text-text' : 'bg-bg-soft text-text-dim italic',
                  )}
                >
                  {c1 || '—'}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
