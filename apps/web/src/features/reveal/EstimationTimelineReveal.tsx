'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarBadge } from '@/components/AvatarPicker';
import type { Player } from '@mvpc/shared';
import { Sparkles, Target } from 'lucide-react';

export interface TimelineAnswer {
  player: Player;
  numeric?: number;
}

export interface EstimationTimelineRevealProps {
  /** Toutes les réponses participants (ordre d'apparition). */
  answers: TimelineAnswer[];
  /** Bonne réponse officielle. */
  officialValue: number;
  /** Libellé de l'unité ou suffixe (ex: "av. J.-C.", ou vide pour les années). */
  unit?: string;
  /** Index de la prochaine réponse à révéler (contrôlé par le parent). */
  revealedIdx: number;
  /** Vrai quand on passe à la révélation de la réponse officielle. */
  showingOfficial: boolean;
}

/**
 * Reveal pour estimations de date/année : on affiche une frise horizontale
 * que l'on déroule au rythme des réponses des joueurs. Le zoom initial est
 * calé sur l'écart des réponses des participants ; quand la bonne réponse
 * tombe, la frise dézoome en douceur pour l'inclure et on "plante" le drapeau
 * officiel à sa position.
 */
export function EstimationTimelineReveal({
  answers,
  officialValue,
  unit,
  revealedIdx,
  showingOfficial,
}: EstimationTimelineRevealProps) {
  const numerics = useMemo(() => {
    return answers
      .map((a) => a.numeric)
      .filter((n): n is number => typeof n === 'number');
  }, [answers]);

  // Deux bornes de zoom : participants seuls vs. participants + officiel.
  const rangeParticipants = useMemo(
    () => computeRange(numerics, officialValue, false),
    [numerics, officialValue],
  );
  const rangeFull = useMemo(
    () => computeRange(numerics, officialValue, true),
    [numerics, officialValue],
  );

  const [range, setRange] = useState(rangeParticipants);

  // Quand la bonne réponse est révélée, on dézoome en douceur pour l'inclure.
  useEffect(() => {
    setRange(showingOfficial ? rangeFull : rangeParticipants);
  }, [showingOfficial, rangeFull, rangeParticipants]);

  const { min, max } = range;
  const span = Math.max(1, max - min);

  const toPct = (v: number) => ((v - min) / span) * 100;

  // Graduations intelligentes selon l'échelle.
  const ticks = useMemo(() => buildTicks(min, max), [min, max]);

  // Pour disposer les markers en évitant qu'ils se chevauchent verticalement,
  // on les place alternativement au-dessus / en-dessous de la frise selon
  // l'ordre de révélation (déterministe).
  const sideForIndex = (i: number) => (i % 2 === 0 ? 'top' : 'bottom');

  return (
    <div className="panel p-6 sm:p-8 relative overflow-hidden">
      <div className="chip-cyan mx-auto mb-6 inline-flex">
        <Target className="w-3.5 h-3.5" />
        Frise chronologique
      </div>

      <div className="timeline-wrap">
        {/* Zone en haut (markers dessinés au-dessus de la ligne). */}
        <div className="timeline-lane timeline-lane-top">
          <AnimatePresence>
            {answers.slice(0, revealedIdx).map((a, i) => {
              if (sideForIndex(i) !== 'top') return null;
              if (typeof a.numeric !== 'number') return null;
              return (
                <MarkerAbove
                  key={a.player.id}
                  player={a.player}
                  value={a.numeric}
                  unit={unit}
                  left={toPct(a.numeric)}
                />
              );
            })}
          </AnimatePresence>
        </div>

        {/* Ligne centrale + ticks + marker officiel */}
        <div className="timeline-rail">
          <motion.div
            className="timeline-line"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />

          {ticks.map((t) => (
            <div
              key={t}
              className="timeline-tick"
              style={{ left: `${toPct(t)}%` }}
            >
              <span className="timeline-tick-label">{formatTick(t, unit)}</span>
            </div>
          ))}

          {/* Marker officiel : apparaît pendant que la frise dézoome. */}
          <AnimatePresence>
            {showingOfficial && (
              <motion.div
                className="timeline-marker timeline-marker-official"
                initial={{
                  opacity: 0,
                  scale: 0.4,
                  y: -50,
                  left: `${toPct(officialValue)}%`,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  left: `${toPct(officialValue)}%`,
                }}
                exit={{ opacity: 0, scale: 0.7, y: -30 }}
                transition={{
                  type: 'spring',
                  stiffness: 220,
                  damping: 16,
                  delay: 0.35,
                }}
              >
                <div className="timeline-official-halo" />
                <div className="timeline-official-pin">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="timeline-official-label">
                  {formatValue(officialValue, unit)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Zone en bas */}
        <div className="timeline-lane timeline-lane-bottom">
          <AnimatePresence>
            {answers.slice(0, revealedIdx).map((a, i) => {
              if (sideForIndex(i) !== 'bottom') return null;
              if (typeof a.numeric !== 'number') return null;
              return (
                <MarkerBelow
                  key={a.player.id}
                  player={a.player}
                  value={a.numeric}
                  unit={unit}
                  left={toPct(a.numeric)}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Récap des joueurs sans réponse (discret, à la fin seulement) */}
      {showingOfficial &&
        answers.some((a) => typeof a.numeric !== 'number') && (
          <div className="mt-4 text-xs text-text-dim text-center">
            Sans réponse :{' '}
            {answers
              .filter((a) => typeof a.numeric !== 'number')
              .map((a) => a.player.nickname)
              .join(', ')}
          </div>
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sous-composants markers                                             */
/* ------------------------------------------------------------------ */

function MarkerAbove({
  player,
  value,
  unit,
  left,
}: {
  player: Player;
  value: number;
  unit?: string;
  left: number;
}) {
  return (
    <motion.div
      className="timeline-marker timeline-marker-top"
      initial={{ opacity: 0, y: -24, scale: 0.4, left: `${left}%` }}
      animate={{ opacity: 1, y: 0, scale: 1, left: `${left}%` }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <div className="timeline-marker-value">{formatValue(value, unit)}</div>
      <div className="timeline-marker-nick">{player.nickname}</div>
      <AvatarBadge avatar={player.avatar} size="md" />
      <div className="timeline-marker-stem timeline-marker-stem-top" />
    </motion.div>
  );
}

function MarkerBelow({
  player,
  value,
  unit,
  left,
}: {
  player: Player;
  value: number;
  unit?: string;
  left: number;
}) {
  return (
    <motion.div
      className="timeline-marker timeline-marker-bottom"
      initial={{ opacity: 0, y: 24, scale: 0.4, left: `${left}%` }}
      animate={{ opacity: 1, y: 0, scale: 1, left: `${left}%` }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <div className="timeline-marker-stem timeline-marker-stem-bottom" />
      <AvatarBadge avatar={player.avatar} size="md" />
      <div className="timeline-marker-nick">{player.nickname}</div>
      <div className="timeline-marker-value">{formatValue(value, unit)}</div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface Range {
  min: number;
  max: number;
}

/**
 * Calcule les bornes de la frise : au minimum l'écart des réponses joueurs,
 * avec une marge pour respirer. `includeOfficial` étend la plage pour inclure
 * la bonne réponse si elle tombe hors écart.
 */
function computeRange(
  values: number[],
  official: number,
  includeOfficial: boolean,
): Range {
  const base = values.length > 0 ? values.slice() : [official];
  let min = Math.min(...base);
  let max = Math.max(...base);
  if (includeOfficial) {
    min = Math.min(min, official);
    max = Math.max(max, official);
  }
  if (min === max) {
    // Écart nul → on ouvre un peu autour.
    min -= 5;
    max += 5;
  }
  const span = max - min;
  // Marge proportionnelle pour que les extrêmes ne collent pas au bord.
  const pad = Math.max(1, span * 0.1);
  return { min: min - pad, max: max + pad };
}

function buildTicks(min: number, max: number): number[] {
  const span = max - min;
  // Choisit un pas qui donne 4–8 graduations visibles.
  const candidates = [
    1, 2, 5,
    10, 20, 25, 50,
    100, 200, 250, 500,
    1000, 2000, 2500, 5000,
  ];
  let step = candidates[candidates.length - 1]!;
  for (const c of candidates) {
    if (span / c <= 8) {
      step = c;
      break;
    }
  }
  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max; v += step) {
    ticks.push(v);
  }
  return ticks;
}

function formatValue(v: number, unit?: string): string {
  if (!Number.isFinite(v)) return '—';
  const rounded = Number.isInteger(v)
    ? v.toString()
    : v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  if (!unit) return rounded;
  return `${rounded} ${unit}`;
}

function formatTick(v: number, unit?: string): string {
  // Sur les ticks on garde un affichage compact pour ne pas saturer la frise.
  if (unit && unit.toLowerCase().includes('j.-c')) {
    return `${Math.abs(v)}`;
  }
  return Number.isInteger(v)
    ? v.toString()
    : v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}
