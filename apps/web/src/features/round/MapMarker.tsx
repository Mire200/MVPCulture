'use client';
import { motion } from 'framer-motion';
import { MapPin, Target } from 'lucide-react';

type Variant = 'player' | 'target' | 'ghost';

interface Props {
  variant: Variant;
  color?: string;
  label?: string;
  size?: number;
  /** Ajoute un faisceau lumineux vertical (utilis\u00e9 pour la reveal). */
  beam?: boolean;
  /** Multiplicateur de la hauteur du faisceau (1 = valeur par d\u00e9faut). */
  beamScale?: number;
}

/**
 * Marker stylisé posé par-dessus la carte MapLibre via <Marker>.
 * Variant "player"  → pastille couleur joueur, drop + pulse.
 * Variant "target"  → halo vert + cible, ripple infini.
 * Variant "ghost"   → placeholder pendant un drag / survol.
 */
export function MapMarker({ variant, color, label, size = 28, beam, beamScale = 1 }: Props) {
  if (variant === 'target') {
    return (
      <div
        className="mvpc-map-marker mvpc-map-marker--target"
        style={{ ['--mm-color' as string]: '#22ff88' }}
      >
        {beam && (
          <span
            className="mvpc-map-marker__beam mvpc-map-marker__beam--target"
            style={{ ['--mm-beam-scale' as string]: String(beamScale) }}
          />
        )}
        <span className="mvpc-map-marker__ripple" />
        <span className="mvpc-map-marker__ripple mvpc-map-marker__ripple--delay" />
        <motion.span
          className="mvpc-map-marker__core"
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        >
          <Target className="w-4 h-4" strokeWidth={2.4} />
        </motion.span>
      </div>
    );
  }

  if (variant === 'ghost') {
    return (
      <div
        className="mvpc-map-marker mvpc-map-marker--ghost"
        style={{ ['--mm-color' as string]: color ?? '#22d3ee' }}
      >
        <span className="mvpc-map-marker__ring" />
      </div>
    );
  }

  const mmColor = color ?? '#22d3ee';
  return (
    <div
      className="mvpc-map-marker mvpc-map-marker--player"
      style={{ ['--mm-color' as string]: mmColor, width: size, height: size }}
    >
      {beam && (
        <span
          className="mvpc-map-marker__beam"
          style={{ ['--mm-beam-scale' as string]: String(beamScale) }}
        />
      )}
      <span className="mvpc-map-marker__pulse" />
      <motion.span
        className="mvpc-map-marker__core"
        initial={{ y: -24, opacity: 0, scale: 0.6 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.7 }}
      >
        {label ? (
          <span className="mvpc-map-marker__label">{label}</span>
        ) : (
          <MapPin className="w-3.5 h-3.5" strokeWidth={2.6} />
        )}
      </motion.span>
      <span className="mvpc-map-marker__stem" />
    </div>
  );
}
