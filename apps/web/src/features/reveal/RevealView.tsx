'use client';
import dynamic from 'next/dynamic';
import { useGameStore } from '@/store/gameStore';
import { AvatarBadge } from '@/components/AvatarPicker';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ChevronRight, Sparkles, Target, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { mvpConfetti } from '@/lib/confetti';
import { mvpSound } from '@/lib/sound';
import { ImposterReveal } from './ImposterReveal';
import { CodenamesReveal } from './CodenamesReveal';
import { EstimationTimelineReveal } from './EstimationTimelineReveal';

const RevealMapLazy = dynamic(() => import('./RevealMap').then((m) => m.RevealMap), {
  ssr: false,
  loading: () => (
    <div className="h-64 rounded-2xl bg-surface-2 animate-pulse" />
  ),
});

export function RevealView() {
  const snapshot = useGameStore((s) => s.snapshot);
  const reveal = useGameStore((s) => s.reveal);
  const hostValidations = useGameStore((s) => s.hostValidations);
  const setHostValidation = useGameStore((s) => s.setHostValidation);
  const myId = useGameStore((s) => s.playerId);
  const [revealedIdx, setRevealedIdx] = useState(0);

  const isHost = snapshot && myId && snapshot.hostId === myId;
  const question = reveal?.question;
  const mode = question?.mode;

  const answersInOrder = useMemo(() => {
    if (!reveal || !snapshot) return [];
    return snapshot.players
      .map((p) => ({
        player: p,
        answer: reveal.answers.find((a) => a.playerId === p.id),
        auto: reveal.autoValidations[p.id],
      }))
      .filter((x) => !!x.answer);
  }, [reveal, snapshot]);

  const officialPlayedRef = useRef(false);

  // Reset complet quand la question change.
  useEffect(() => {
    setRevealedIdx(0);
    officialPlayedRef.current = false;
  }, [answersInOrder]);

  const doAdvance = useCallback(() => {
    setRevealedIdx((i) => {
      if (i >= answersInOrder.length) return i;
      const row = answersInOrder[i];
      const correct =
        row?.auto === true ||
        (row?.answer?.success === true) ||
        (typeof row?.answer?.distanceKm === 'number' && row.answer.distanceKm < 50);
      if (correct) mvpSound.success();
      else mvpSound.fail();
      return i + 1;
    });
  }, [answersInOrder]);

  // Programmation du prochain reveal
  useEffect(() => {
    if (!answersInOrder.length) return;
    if (revealedIdx >= answersInOrder.length) return;

    const tick = mode === 'map' ? 4200 : 700;
    const id = setTimeout(doAdvance, tick);
    return () => clearTimeout(id);
  }, [revealedIdx, answersInOrder, mode, doAdvance]);

  useEffect(() => {
    if (
      revealedIdx >= answersInOrder.length &&
      answersInOrder.length > 0 &&
      !officialPlayedRef.current
    ) {
      officialPlayedRef.current = true;
      setTimeout(() => {
        mvpSound.bigReveal();
        mvpConfetti.burst({ count: 80, velocity: 20 });
      }, 400);
    }
  }, [revealedIdx, answersInOrder.length]);

  if (!snapshot || !reveal || !question) return null;

  if (mode === 'imposter') {
    return <ImposterReveal />;
  }
  if (mode === 'codenames') {
    return <CodenamesReveal />;
  }

  const isDateEstim = mode === 'estimation' && isDateEstimation(question);

  const toggle = (playerId: string, correct: boolean) => {
    if (!isHost) return;
    setHostValidation(playerId, correct);
    const sock = getSocket();
    const validations = Object.entries({ ...hostValidations, [playerId]: correct }).map(
      ([pid, c]) => ({ playerId: pid, correct: c }),
    );
    sock.emit('round:validate', { validations }, () => {});
    if (correct) mvpConfetti.burst({ count: 40, velocity: 18 });
  };

  const officialAnswer =
    mode === 'classic'
      ? (question as any).answer
      : mode === 'qcm'
        ? (question as any).answer
      : mode === 'speed-elim'
        ? (question as any).answer
        : mode === 'wikirace'
          ? (question as any).targetTitle
        : mode === 'estimation'
          ? `${(question as any).numericAnswer}${(question as any).unit ? ' ' + (question as any).unit : ''}`
          : mode === 'map'
            ? (question as any).targetLabel
            : mode === 'chronology'
              ? chronologyOfficial(question as any)
              : ((question as any).validItems as string[])?.slice(0, 12).join(', ');

  const showingOfficial = revealedIdx >= answersInOrder.length;

  const advance = () => {
    const sock = getSocket();
    sock.emit('round:advance', () => {});
  };

  return (
    <main className="min-h-dvh px-4 py-6 max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-3">
        <div className="chip-magenta mx-auto inline-flex">◉ RÉVÉLATION</div>
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl sm:text-3xl leading-snug"
        >
          {question.prompt}
        </motion.h2>
      </div>

      {isDateEstim && (
        <EstimationTimelineReveal
          answers={answersInOrder.map(({ player, answer }) => ({
            player,
            numeric: typeof answer?.numeric === 'number' ? answer.numeric : undefined,
          }))}
          officialValue={(question as any).numericAnswer}
          unit={(question as any).unit}
          revealedIdx={revealedIdx}
          showingOfficial={showingOfficial}
        />
      )}

      {mode === 'map' && (
        <RevealMapLazy
          resetKey={question.id}
          target={{
            lat: (question as any).targetLat,
            lng: (question as any).targetLng,
            label: (question as any).targetLabel,
          }}
          players={answersInOrder.map(({ player, answer }) => ({
            id: player.id,
            nickname: player.nickname,
            color: player.avatar.color,
            lat: answer?.lat,
            lng: answer?.lng,
            distanceKm: answer?.distanceKm,
          }))}
          revealedCount={revealedIdx}
        />
      )}

      <div className={`space-y-3 ${isDateEstim ? 'hidden' : ''}`}>
        <AnimatePresence>
          {answersInOrder.slice(0, revealedIdx).map(({ player, answer, auto }) => {
            const mark =
              mode === 'classic' ? (hostValidations[player.id] ?? auto ?? false) : undefined;
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="panel p-4 flex items-center gap-4"
              >
                <AvatarBadge avatar={player.avatar} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{player.nickname}</div>
                  <AnswerRenderer mode={mode ?? 'classic'} answer={answer} question={question} />
                </div>

                {mode === 'classic' && (
                  <div className="flex items-center gap-2">
                    {isHost ? (
                      <>
                        <button
                          onClick={() => toggle(player.id, true)}
                          className={`w-11 h-11 rounded-xl flex items-center justify-center transition ${
                            mark === true
                              ? 'bg-neon-lime text-black'
                              : 'bg-bg-elevated border border-border hover:border-neon-lime'
                          }`}
                          title="Valider"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => toggle(player.id, false)}
                          className={`w-11 h-11 rounded-xl flex items-center justify-center transition ${
                            mark === false
                              ? 'bg-neon-magenta text-white'
                              : 'bg-bg-elevated border border-border hover:border-neon-magenta'
                          }`}
                          title="Rejeter"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </>
                    ) : mark === true ? (
                      <div className="chip-lime">Validé</div>
                    ) : mark === false ? (
                      <div className="chip-magenta">Rejeté</div>
                    ) : (
                      <div className="chip">En attente</div>
                    )}
                  </div>
                )}

                {mode === 'qcm' && (
                  <div className="shrink-0">
                    {auto === true ? (
                      <div className="chip-lime">Correct</div>
                    ) : (
                      <div className="chip-magenta">Raté</div>
                    )}
                  </div>
                )}

                {mode === 'hot-potato' && answer && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Target className="w-4 h-4 text-text-muted" />
                    <span
                      className={`font-display text-lg ${
                        answer.success ? 'text-neon-lime' : 'text-neon-magenta'
                      }`}
                    >
                      {answer.listItems?.length ?? 0} / {answer.bid ?? '?'}
                    </span>
                  </div>
                )}

                {mode === 'speed-elim' && answer?.speedRank !== undefined && (
                  <div className="chip-lime shrink-0">
                    <Zap className="w-3 h-3" /> #{answer.speedRank}
                  </div>
                )}

                {mode === 'map' && answer?.distanceKm !== undefined && (
                  <div className="chip shrink-0">
                    {formatKm(answer.distanceKm)}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showingOfficial && !isDateEstim && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 16 }}
            className="panel p-8 text-center ring-lime relative overflow-hidden"
          >
            <div className="chip-lime mx-auto mb-3 inline-flex">
              <Sparkles className="w-3 h-3" />
              {mode === 'chronology' ? 'Ordre correct' : 'Bonne réponse'}
            </div>
            <motion.div
              className="font-display text-gradient chroma leading-tight"
              style={{ fontSize: 'clamp(28px, 5vw, 52px)' }}
              animate={{
                textShadow: [
                  '0 0 30px rgba(163,230,53,0.4)',
                  '0 0 60px rgba(163,230,53,0.7)',
                  '0 0 30px rgba(163,230,53,0.4)',
                ],
              }}
              transition={{ duration: 2.2, repeat: Infinity }}
            >
              {officialAnswer || '—'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isHost && showingOfficial && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => {
            mvpSound.whoosh();
            advance();
          }}
          className="btn-primary w-full text-lg py-4"
        >
          Calculer les scores
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      )}
      {!isHost && showingOfficial && (
        <div className="text-text-muted text-sm text-center py-2">
          En attente de l'hôte pour passer au score…
        </div>
      )}
    </main>
  );
}

function AnswerRenderer({
  mode,
  answer,
  question,
}: {
  mode: string;
  answer: any;
  question: any;
}) {
  if (!answer) return <span className="italic text-text-dim">— pas de réponse —</span>;
  if (mode === 'classic' || mode === 'speed-elim' || mode === 'qcm') {
    return <div className="text-text-muted truncate text-lg">{answer.text || '—'}</div>;
  }
  if (mode === 'estimation') {
    return (
      <div className="text-text-muted truncate text-lg">
        {typeof answer.numeric === 'number' ? formatNumeric(answer.numeric) : '—'}
        {question.unit ? ` ${question.unit}` : ''}
      </div>
    );
  }
  if (mode === 'list-turns' || mode === 'hot-potato') {
    const items: string[] = answer.listItems ?? [];
    if (items.length === 0) return <span className="italic text-text-dim">— rien —</span>;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {items.slice(0, 20).map((it, i) => (
          <span key={i} className="px-2 py-0.5 rounded-full bg-surface-2 text-xs">
            {it}
          </span>
        ))}
      </div>
    );
  }
  if (mode === 'wikirace') {
    const steps = answer.listItems ?? [];
    const hops = typeof answer.numeric === 'number' ? Math.max(0, Math.round(answer.numeric / 1000)) : undefined;
    return (
      <div className="text-text-muted text-sm">
        <div>
          {answer.success ? 'Arrivé' : 'Non terminé'} · {steps.length > 0 ? `${steps.length - 1} sauts` : '0 saut'}
        </div>
        {steps.length > 0 && (
          <div className="truncate text-xs mt-1">
            {steps[0]} {steps.length > 1 ? `→ ${steps[steps.length - 1]}` : ''}
          </div>
        )}
        {hops !== undefined && <div className="text-[11px] text-text-dim">{hops}s</div>}
      </div>
    );
  }
  if (mode === 'map') {
    if (typeof answer.lat !== 'number') return <span className="italic text-text-dim">— pas de réponse —</span>;
    return (
      <div className="text-text-muted text-sm">
        ({answer.lat.toFixed(2)}, {answer.lng.toFixed(2)})
      </div>
    );
  }
  if (mode === 'chronology') {
    const labels = new Map<string, string>();
    for (const e of question.events ?? []) labels.set(e.id, e.label);
    const correctOrder = [...(question.events ?? [])]
      .sort((a: any, b: any) => a.year - b.year)
      .map((e: any) => e.id);
    const posInCorrect = new Map<string, number>();
    correctOrder.forEach((id, i) => posInCorrect.set(id, i));
    const order: string[] = answer.order ?? [];
    if (order.length === 0) return <span className="italic text-text-dim">— pas de réponse —</span>;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {order.map((id, i) => {
          const correct = posInCorrect.get(id) === i;
          return (
            <span
              key={i}
              className={`px-2 py-0.5 rounded-full text-xs ${
                correct
                  ? 'bg-neon-lime/20 text-neon-lime'
                  : 'bg-neon-magenta/20 text-neon-magenta'
              }`}
            >
              {labels.get(id) ?? id}
            </span>
          );
        })}
      </div>
    );
  }
  return null;
}

function formatNumeric(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

function formatKm(km: number): string {
  if (km < 10) return `${km.toFixed(1)} km`;
  if (km < 1000) return `${Math.round(km)} km`;
  return `${(km / 1000).toFixed(1)}k km`;
}

function chronologyOfficial(q: any): string {
  const events = [...(q.events ?? [])].sort((a: any, b: any) => a.year - b.year);
  return events.map((e: any) => `${e.year} — ${e.label}`).join(' → ');
}

/**
 * Reconnaît une question d'estimation portant sur une date (année ou année
 * av. J.-C.) pour activer le reveal en frise chronologique. On se base sur
 * le prompt ("Année de…", "En quelle année…") et sur l'unité explicitement
 * marquée "av. J.-C.". Fallback : pas d'unité + nombre entier plausible
 * comme année (entre 1000 et 2100).
 */
function isDateEstimation(q: any): boolean {
  if (!q || q.mode !== 'estimation') return false;
  const prompt: string = (q.prompt ?? '').toLowerCase();
  if (/^\s*ann[eé]e\b/.test(prompt)) return true;
  if (/en quelle ann[eé]e/.test(prompt)) return true;
  const unit: string = (q.unit ?? '').toLowerCase();
  if (unit.includes('j.-c') || unit.includes('j-c') || unit.includes('av. j')) {
    return true;
  }
  const n = q.numericAnswer;
  if (!q.unit && Number.isInteger(n) && n >= 1000 && n <= 2100) return true;
  return false;
}
