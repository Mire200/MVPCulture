'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

export type BowlingKind = 'strike' | 'close' | 'gutter';

const STRIKE_SRCS = [
  '/videos/bowling/strike.mp4',
  '/videos/bowling/strike2.mp4',
  '/videos/bowling/strike3.mp4',
];

/**
 * Décide si la distance d'un joueur mérite une vidéo bowling, et de quel type.
 * - strike  : très proche (< 60 km)
 * - close   : proche (< 350 km)
 * - gutter  : très loin (> 7 000 km)
 */
export function pickBowlingKind(km: number): BowlingKind | null {
  if (!Number.isFinite(km)) return null;
  if (km < 60) return 'strike';
  if (km < 350) return 'close';
  if (km > 7000) return 'gutter';
  return null;
}

export function pickBowlingSrc(kind: BowlingKind): string {
  if (kind === 'strike') {
    return STRIKE_SRCS[Math.floor(Math.random() * STRIKE_SRCS.length)];
  }
  if (kind === 'close') return '/videos/bowling/close.mp4';
  return '/videos/bowling/gutterball.mp4';
}

const LABELS: Record<BowlingKind, { text: string; color: string }> = {
  strike: { text: 'STRIKE !', color: '#a3e635' },
  close: { text: 'PRESQUE !', color: '#22d3ee' },
  gutter: { text: 'DANS LE CANIVEAU', color: '#f97316' },
};

/** Durée de l'animation d'ouverture du CRT, en ms. Doit matcher
 *  `transition.duration` de la motion.div ci-dessous. */
const CRT_OPEN_MS = 650;

export interface BowlingShown {
  id: string;
  kind: BowlingKind;
  src: string;
}

interface Props {
  shown: BowlingShown | null;
  onDone: (id: string) => void;
  /** Déclenché dès que l'overlay s'ouvre (avant la lecture). */
  onOpen?: (id: string) => void;
  /** Sécurité : si la vidéo ne se charge pas, on coupe au bout de X ms. */
  safetyTimeoutMs?: number;
}

export function BowlingVideoOverlay({
  shown,
  onDone,
  onOpen,
  safetyTimeoutMs = 28000,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // On stocke les callbacks dans des refs pour que l'effet ne se re-déclenche
  // qu'à chaque nouvelle vidéo (via shown.id), et pas à chaque render parent.
  const onDoneRef = useRef(onDone);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onDoneRef.current = onDone;
    onOpenRef.current = onOpen;
  });

  const shownId = shown?.id ?? null;

  useEffect(() => {
    if (!shown || !shownId) return;
    onOpenRef.current?.(shown.id);
    const v = videoRef.current;
    let playTimer: ReturnType<typeof setTimeout> | null = null;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
        v.volume = 0.9;
        v.muted = false;
      } catch {
      }
      const tryPlay = () => {
        try {
          v.currentTime = 0;
        } catch {
        }
        const p = v.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            try {
              v.muted = true;
              v.play().catch(() => {});
            } catch {
            }
          });
        }
      };
      // On attend la fin de l'animation d'ouverture du CRT avant de lancer
      // la lecture, sinon les premières frames passent pendant que l'écran
      // n'est qu'une fine ligne.
      playTimer = setTimeout(tryPlay, CRT_OPEN_MS);
    }
    const safety = setTimeout(() => {
      onDoneRef.current?.(shown.id);
    }, safetyTimeoutMs);
    return () => {
      if (playTimer) clearTimeout(playTimer);
      clearTimeout(safety);
    };
    // On veut UNIQUEMENT re-déclencher quand une nouvelle vidéo apparaît.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownId, safetyTimeoutMs]);

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown.id}
          className="mvpc-bowling-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="mvpc-bowling-crt"
            initial={{ scaleY: 0.02, scaleX: 0.55, opacity: 0 }}
            animate={{
              scaleY: [0.02, 0.02, 1, 1],
              scaleX: [0.55, 1, 1, 1],
              opacity: [0, 1, 1, 1],
            }}
            exit={{ scaleY: 0.02, scaleX: 0.3, opacity: 0 }}
            transition={{
              duration: 0.6,
              times: [0, 0.25, 0.5, 1],
              ease: 'easeOut',
            }}
            style={{ ['--crt-color' as string]: LABELS[shown.kind].color }}
          >
            <video
              ref={videoRef}
              src={shown.src}
              playsInline
              preload="auto"
              className="mvpc-bowling-video"
              onEnded={() => onDone(shown.id)}
            />
            <div className="mvpc-bowling-scanlines" aria-hidden />
            <div className="mvpc-bowling-vignette" aria-hidden />
            <motion.div
              className="mvpc-bowling-flash"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ duration: 0.45, times: [0, 0.3, 1] }}
            />
            <div className="mvpc-bowling-label">{LABELS[shown.kind].text}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
