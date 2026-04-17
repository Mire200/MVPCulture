'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { mvpSound } from '@/lib/sound';

/**
 * Timer visuel piloté par `endsAt` (ms epoch).
 * - rafraîchi à ~60fps pour une barre fluide
 * - tick sonore sur chaque changement de seconde (urgent sous `urgentAt`)
 * - shake + rose en mode urgent
 */
export function Timer({
  endsAt,
  className,
  urgentAt = 5,
  bar = true,
  sound = true,
}: {
  endsAt: number;
  className?: string;
  urgentAt?: number;
  bar?: boolean;
  sound?: boolean;
}) {
  const startRef = useRef(Date.now());
  const durationRef = useRef(Math.max(1, (endsAt - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(durationRef.current);
  const lastTickRef = useRef<number>(Math.ceil(durationRef.current));

  useEffect(() => {
    startRef.current = Date.now();
    durationRef.current = Math.max(1, (endsAt - Date.now()) / 1000);
    setRemaining(durationRef.current);
    lastTickRef.current = Math.ceil(durationRef.current);
    let raf = 0;
    const loop = () => {
      const r = Math.max(0, (endsAt - Date.now()) / 1000);
      const rCeil = Math.ceil(r);
      if (rCeil !== lastTickRef.current) {
        lastTickRef.current = rCeil;
        if (sound && rCeil > 0) {
          if (rCeil <= urgentAt) mvpSound.tickUrgent();
          else mvpSound.tick();
        }
      }
      setRemaining(r);
      if (r <= 0) return;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [endsAt, urgentAt, sound]);

  const urgent = remaining > 0 && remaining <= urgentAt;
  const pct = Math.max(0, Math.min(100, (remaining / durationRef.current) * 100));

  return (
    <div className={cn('timer-shell', urgent && 'urgent', className)}>
      {bar && (
        <div className="timer-bar">
          <div className="timer-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      <span className="chroma" style={{ minWidth: 38, textAlign: 'right' }}>
        {Math.ceil(remaining)}s
      </span>
    </div>
  );
}
