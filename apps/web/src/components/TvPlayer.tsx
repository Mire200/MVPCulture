'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tv as TvIcon, VolumeX, Volume2, SkipForward, X } from 'lucide-react';
import type { TvStatePayload } from '@mvpc/shared';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/cn';
import { setTvAudioOn } from '@/lib/mediaBus';

const STORAGE_VOLUME = 'mvpc.tv.volume';
const STORAGE_MUTED = 'mvpc.tv.muted';

/**
 * Télé du lobby : clips vidéo courts, synchronisés via le serveur (tous les
 * clients voient le même clip au même moment). La télé tourne en continu côté
 * serveur ; côté client, on ne charge / lance réellement la vidéo que lorsque
 * l'utilisateur "allume" la télé — ouvrir la télé coupe la radio via le
 * mediaBus.
 *
 * On garde volontairement la logique de synchronisation en miroir de
 * RadioPlayer : calcul d'offset serveur, seek basé sur `startedAt`, re-sync
 * périodique pour corriger la dérive.
 */
export function TvPlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<TvStatePayload | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_MUTED) === '1';
  });
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.7;
    const raw = localStorage.getItem(STORAGE_VOLUME);
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.7;
  });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_VOLUME, String(volume));
  }, [volume]);
  useEffect(() => {
    localStorage.setItem(STORAGE_MUTED, muted ? '1' : '0');
  }, [muted]);

  // Signale au mediaBus que la télé prend (ou rend) l'audio. Ouverte et non
  // muette => on coupe la radio. Fermée ou muette => la radio reprend.
  useEffect(() => {
    setTvAudioOn(open && !muted);
    return () => setTvAudioOn(false);
  }, [open, muted]);

  // Flux d'état du serveur : on écoute toujours (même télé fermée) pour pouvoir
  // ouvrir directement sur le clip en cours, mais on ne charge pas la vidéo.
  useEffect(() => {
    const sock = getSocket();
    const onState = (s: TvStatePayload) => {
      setState(s);
      setClockOffset(s.serverTime - Date.now());
    };
    sock.on('tv:state', onState);
    if (sock.connected) {
      sock.emit('tv:sync', (res) => {
        if (res.ok) onState(res.data);
      });
    } else {
      sock.once('connect', () => {
        sock.emit('tv:sync', (res) => {
          if (res.ok) onState(res.data);
        });
      });
    }
    return () => {
      sock.off('tv:state', onState);
    };
  }, []);

  // Volume / mute sur l'élément vidéo.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted || !open;
  }, [volume, muted, open]);

  // Gestion de la source + seek quand on a un état et qu'on est ouvert.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !state || !open) {
      if (el) el.pause();
      return;
    }

    const currentSrc = el.src.endsWith(state.src) ? el.src : null;
    if (!currentSrc) {
      el.src = state.src;
      el.load();
    }

    const sync = () => {
      if (!state) return;
      const elapsed = (Date.now() + clockOffset - state.startedAt) / 1000;
      const target = Math.max(0, Math.min(state.duration - 0.1, elapsed));
      if (Number.isFinite(target)) {
        if (Math.abs(el.currentTime - target) > 0.6) {
          el.currentTime = target;
        }
      }
      el.play().catch(() => {
        // Autoplay bloqué avec son : on retombera en muet si besoin. Comme
        // l'utilisateur a explicitement ouvert la télé, on considère qu'on a
        // une interaction utilisateur récente, donc ça devrait passer.
      });
    };

    if (el.readyState >= 1) {
      sync();
    } else {
      const onMeta = () => {
        sync();
        el.removeEventListener('loadedmetadata', onMeta);
      };
      el.addEventListener('loadedmetadata', onMeta);
      return () => el.removeEventListener('loadedmetadata', onMeta);
    }
  }, [state, clockOffset, open]);

  // Re-sync périodique quand la télé est ouverte, pour coller au serveur.
  useEffect(() => {
    if (!state || !open) return;
    const id = setInterval(() => {
      const el = videoRef.current;
      if (!el || !state) return;
      const elapsed = (Date.now() + clockOffset - state.startedAt) / 1000;
      if (elapsed < 0 || elapsed >= state.duration) return;
      const drift = Math.abs(el.currentTime - elapsed);
      if (drift > 0.8) {
        el.currentTime = elapsed;
      }
    }, 4000);
    return () => clearInterval(id);
  }, [state, clockOffset, open]);

  // Barre de progression.
  useEffect(() => {
    if (!state) return;
    let raf = 0;
    const tick = () => {
      if (open && videoRef.current && videoRef.current.readyState > 0) {
        setProgress(videoRef.current.currentTime / state.duration);
      } else {
        const elapsed = (Date.now() + clockOffset - state.startedAt) / 1000;
        setProgress(Math.max(0, Math.min(1, elapsed / state.duration)));
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [state, clockOffset, open]);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const skip = () => {
    const sock = getSocket();
    sock.emit('tv:skip', (res) => {
      if (res.ok) {
        setState(res.data);
        setClockOffset(res.data.serverTime - Date.now());
      }
    });
  };

  if (!state) return null;

  return (
    <div className="tv-widget">
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="tv-open"
            className="tv-card"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <div className="tv-frame">
              <video
                ref={videoRef}
                playsInline
                preload="auto"
                className="tv-video"
              />
              <div className="tv-scanlines" aria-hidden="true" />
              <div className="tv-glow" aria-hidden="true" />
            </div>

            <div className="tv-header">
              <div className="tv-label">
                <TvIcon className="w-3.5 h-3.5" />
                <span>Télé du lobby</span>
                <span className="tv-live-dot" />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="radio-icon-btn"
                title="Éteindre la télé"
                aria-label="Éteindre la télé"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="radio-progress">
              <div
                className="radio-progress-fill"
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>

            <div className="radio-controls">
              <button
                type="button"
                onClick={toggleMute}
                className={cn(
                  'radio-icon-btn',
                  !muted && 'radio-icon-btn-on',
                )}
                title={muted ? 'Réactiver le son' : 'Couper le son'}
                aria-label="Mute"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (v > 0 && muted) setMuted(false);
                }}
                className="radio-slider"
                aria-label="Volume"
              />
              <button
                type="button"
                onClick={skip}
                className="radio-icon-btn"
                title="Passer au clip suivant (pour tout le monde)"
                aria-label="Skip"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="tv-closed"
            type="button"
            onClick={() => setOpen(true)}
            className="tv-collapsed"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            title="Allumer la télé"
          >
            <TvIcon className="w-4 h-4" />
            <span>TV</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
