'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio as RadioIcon,
  Volume2,
  VolumeX,
  SkipForward,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { RadioStatePayload } from '@mvpc/shared';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/cn';

const STORAGE_VOLUME = 'mvpc.radio.volume';
const STORAGE_MUTED = 'mvpc.radio.muted';
const STORAGE_COLLAPSED = 'mvpc.radio.collapsed';
const STORAGE_UNLOCKED = 'mvpc.radio.unlocked';

/**
 * Radio globale synchronisée : tous les clients écoutent la même piste,
 * positionnée à partir du temps serveur. Le toggle mute/volume est purement
 * local. La première interaction déverrouille l'autoplay (contrainte navigateurs).
 */
export function RadioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<RadioStatePayload | null>(null);
  const [clockOffset, setClockOffset] = useState(0); // serverTime - clientTime
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_MUTED) === '1';
  });
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.5;
    const raw = localStorage.getItem(STORAGE_VOLUME);
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_COLLAPSED) === '1';
  });
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_UNLOCKED) === '1';
  });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_VOLUME, String(volume));
  }, [volume]);
  useEffect(() => {
    localStorage.setItem(STORAGE_MUTED, muted ? '1' : '0');
  }, [muted]);
  useEffect(() => {
    localStorage.setItem(STORAGE_COLLAPSED, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    const sock = getSocket();
    const onState = (s: RadioStatePayload) => {
      setState(s);
      setClockOffset(s.serverTime - Date.now());
    };
    sock.on('radio:state', onState);
    // Si on est déjà connecté, sync immédiat.
    if (sock.connected) {
      sock.emit('radio:sync', (res) => {
        if (res.ok) onState(res.data);
      });
    } else {
      sock.once('connect', () => {
        sock.emit('radio:sync', (res) => {
          if (res.ok) onState(res.data);
        });
      });
    }
    return () => {
      sock.off('radio:state', onState);
    };
  }, []);

  // Applique le volume/mute à l'élément audio.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted || !unlocked;
  }, [volume, muted, unlocked]);

  // À chaque changement de piste : charger la nouvelle src et se positionner.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !state) return;

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
        if (Math.abs(el.currentTime - target) > 0.75) {
          el.currentTime = target;
        }
      }
      if (unlocked && !muted) {
        el.play().catch(() => {
          // Autoplay bloqué : on attend une interaction utilisateur.
        });
      } else {
        el.pause();
      }
    };

    // Si les metadonnées sont déjà là, on peut seek tout de suite.
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
  }, [state, clockOffset, unlocked, muted]);

  // Re-sync périodique pour corriger la dérive.
  useEffect(() => {
    if (!state || !unlocked || muted) return;
    const id = setInterval(() => {
      const el = audioRef.current;
      if (!el || !state) return;
      const elapsed = (Date.now() + clockOffset - state.startedAt) / 1000;
      if (elapsed < 0 || elapsed >= state.duration) return;
      const drift = Math.abs(el.currentTime - elapsed);
      if (drift > 1.2) {
        el.currentTime = elapsed;
      }
    }, 5000);
    return () => clearInterval(id);
  }, [state, clockOffset, unlocked, muted]);

  // Tick local pour la barre de progression.
  useEffect(() => {
    if (!state) return;
    let raf = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el && el.readyState > 0) {
        setProgress(el.currentTime / state.duration);
      } else {
        const elapsed = (Date.now() + clockOffset - state.startedAt) / 1000;
        setProgress(Math.max(0, Math.min(1, elapsed / state.duration)));
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [state, clockOffset]);

  const unlock = useCallback(() => {
    setUnlocked(true);
    localStorage.setItem(STORAGE_UNLOCKED, '1');
    setMuted(false);
    const el = audioRef.current;
    if (el) {
      el.muted = false;
      el.play().catch(() => {
        /* ignore */
      });
    }
  }, []);

  const toggleMute = () => {
    if (!unlocked) {
      unlock();
      return;
    }
    setMuted((m) => !m);
  };

  const skip = () => {
    const sock = getSocket();
    sock.emit('radio:skip', (res) => {
      if (res.ok) {
        setState(res.data);
        setClockOffset(res.data.serverTime - Date.now());
      }
    });
  };

  if (!state) return null;

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="auto" />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="radio-widget"
      >
        <AnimatePresence mode="wait" initial={false}>
          {collapsed ? (
            <motion.button
              key="collapsed"
              type="button"
              onClick={() => setCollapsed(false)}
              className="radio-collapsed"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              title={`📻 ${state.title}`}
            >
              <div className="radio-collapsed-ring">
                <RadioIcon
                  className={cn(
                    'w-4 h-4',
                    !muted && unlocked && 'radio-ring-live',
                  )}
                />
              </div>
              <ChevronUp className="w-3.5 h-3.5 text-text-dim" />
            </motion.button>
          ) : (
            <motion.div
              key="expanded"
              className="radio-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <div className="radio-header">
                <div className="radio-label">
                  <RadioIcon
                    className={cn(
                      'w-3.5 h-3.5',
                      !muted && unlocked && 'radio-ring-live',
                    )}
                  />
                  <span>Radio</span>
                  {!muted && unlocked && <span className="radio-dot" />}
                </div>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="radio-icon-btn"
                  title="Réduire"
                  aria-label="Réduire"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="radio-title" title={state.title}>
                {state.title}
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
                    !muted && unlocked && 'radio-icon-btn-on',
                  )}
                  title={
                    !unlocked
                      ? 'Activer le son'
                      : muted
                        ? 'Réactiver le son'
                        : 'Couper le son'
                  }
                  aria-label="Mute"
                >
                  {muted || !unlocked ? (
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
                    if (!unlocked) unlock();
                  }}
                  className="radio-slider"
                  aria-label="Volume"
                />
                <button
                  type="button"
                  onClick={skip}
                  className="radio-icon-btn"
                  title="Passer au titre suivant (pour tout le monde)"
                  aria-label="Skip"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
