'use client';
import { useCallback, useEffect, useRef } from 'react';
import type { LobbyDrawStroke } from '@mvpc/shared';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/cn';

const WIDTH_STORAGE = 'mvpc.lobby.penWidthNorm';
export const DEFAULT_PEN_WIDTH_NORM = 0.022;

/** Distance normalisée min entre deux segments émis (lissage + charge réseau). */
const MIN_SEGMENT_NORM = 0.0018;
/** Intervalle min entre deux émissions (ms) — ~90/s, aligné avec le rate limit serveur. */
const MIN_EMIT_INTERVAL_MS = 11;

export function readStoredPenWidthNorm(): number {
  if (typeof window === 'undefined') return DEFAULT_PEN_WIDTH_NORM;
  const raw = localStorage.getItem(WIDTH_STORAGE);
  const n = raw ? parseFloat(raw) : NaN;
  if (!Number.isFinite(n) || n < 0.004 || n > 0.12) return DEFAULT_PEN_WIDTH_NORM;
  return n;
}

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strokes: LobbyDrawStroke[],
) {
  ctx.clearRect(0, 0, w, h);
  const m = Math.max(1, Math.min(w, h));
  for (const s of strokes) {
    const pts = s.points;
    if (pts.length < 2) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.widthNorm * m);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(pts[0]![0] * w, pts[0]![1] * h);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i]![0] * w, pts[i]![1] * h);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Trait « en cours » du curseur vers la dernière position déjà envoyée (réduit la latence visuelle). */
function drawLiveTail(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  widthNorm: number,
  from: [number, number],
  to: [number, number],
) {
  const m = Math.max(1, Math.min(w, h));
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (dx * dx + dy * dy < 1e-12) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, widthNorm * m);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(from[0] * w, from[1] * h);
  ctx.lineTo(to[0] * w, to[1] * h);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Canevas de fond du panneau Joueurs : traits synchronisés segment par segment pendant le mouvement.
 */
export function LobbyDrawingCanvas({
  widthNorm,
  penColor,
  className,
}: {
  widthNorm: number;
  penColor: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const strokes = useGameStore((s) => s.lobbyDrawing);
  const widthNormRef = useRef(widthNorm);
  const penColorRef = useRef(penColor);
  useEffect(() => {
    widthNormRef.current = widthNorm;
  }, [widthNorm]);
  useEffect(() => {
    penColorRef.current = penColor;
  }, [penColor]);

  const drawing = useRef(false);
  /** Dernière extrémité déjà envoyée au serveur pour ce geste. */
  const lastEmittedRef = useRef<[number, number] | null>(null);
  /** Position actuelle du pointeur (normalisée). */
  const cursorRef = useRef<[number, number] | null>(null);
  const lastEmitWallRef = useRef(0);
  const rafRef = useRef(0);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const all = useGameStore.getState().lobbyDrawing;
    drawStrokes(ctx, w, h, all);

    if (
      drawing.current &&
      lastEmittedRef.current &&
      cursorRef.current
    ) {
      const a = lastEmittedRef.current;
      const b = cursorRef.current;
      drawLiveTail(ctx, w, h, penColorRef.current, widthNormRef.current, a, b);
    }
  }, []);

  const scheduleRender = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      renderFrame();
    });
  }, [renderFrame]);

  useEffect(() => {
    renderFrame();
  }, [strokes, renderFrame]);

  useEffect(() => {
    const sock = getSocket();
    sock.emit('lobby:drawing:request', (res) => {
      if (!res.ok) return;
      const phase = useGameStore.getState().snapshot?.phase;
      if (phase === 'lobby') {
        useGameStore.getState().setLobbyDrawing(res.data.strokes);
      }
    });
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => scheduleRender());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [scheduleRender]);

  const normPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return [
      Math.min(1, Math.max(0, x)),
      Math.min(1, Math.max(0, y)),
    ] as [number, number];
  }, []);

  const emitSegment = useCallback((from: [number, number], to: [number, number], force: boolean) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    if (dx * dx + dy * dy < MIN_SEGMENT_NORM * MIN_SEGMENT_NORM && !force) return;
    const now = Date.now();
    if (!force && now - lastEmitWallRef.current < MIN_EMIT_INTERVAL_MS) return;
    lastEmitWallRef.current = now;
    const sock = getSocket();
    sock.emit(
      'lobby:draw:stroke',
      { widthNorm: widthNormRef.current, points: [from, to] },
      (res) => {
        if (!res.ok && res.code !== 'RATE_LIMITED') {
          /* silencieux */
        }
      },
    );
    lastEmittedRef.current = to;
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const p = normPoint(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastEmittedRef.current = p;
    cursorRef.current = p;
    lastEmitWallRef.current = 0;
    scheduleRender();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = normPoint(e);
    if (!p) return;
    cursorRef.current = p;
    const from = lastEmittedRef.current;
    if (from) {
      emitSegment(from, p, false);
    }
    scheduleRender();
  };

  const endStroke = useCallback(() => {
    if (!drawing.current) return;
    const from = lastEmittedRef.current;
    const to = cursorRef.current;
    drawing.current = false;
    if (from && to) {
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      if (dx * dx + dy * dy > 1e-10) {
        emitSegment(from, to, true);
      }
    }
    lastEmittedRef.current = null;
    cursorRef.current = null;
    scheduleRender();
  }, [emitSegment, scheduleRender]);

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = normPoint(e);
    if (p) cursorRef.current = p;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    endStroke();
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    endStroke();
  };

  const onPointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current && e.buttons === 0) {
      endStroke();
    }
  };

  return (
    <div ref={wrapRef} className={cn('absolute inset-0 z-0 overflow-hidden rounded-[inherit]', className)}>
      <canvas
        ref={canvasRef}
        className="block touch-none cursor-crosshair"
        aria-hidden
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
      />
    </div>
  );
}
