'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Redo2, Trash2, Undo2 } from 'lucide-react';

const COLORS = [
  '#111111', '#ffffff', '#94a3b8',
  '#ef4444', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#06b6d4', '#3b82f6',
  '#6366f1', '#a855f7', '#d946ef',
  '#ec4899', '#8b5cf6', '#78350f',
];

const BRUSH_SIZES = [4, 10, 22];

interface Props {
  width?: number;
  height?: number;
  onExport: (dataUrl: string) => void;
  disabled?: boolean;
}

/**
 * Standalone drawing canvas for Gartic Phone — fully local (no socket streaming).
 * Provides a palette, brush sizes, undo/clear, and exports as PNG data URL.
 */
export function GarticCanvas({ width = 800, height = 500, onExport, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [color, setColor] = useState('#111111');
  const [brushIdx, setBrushIdx] = useState(1);
  const [isEraser, setIsEraser] = useState(false);

  // Undo stack: store snapshots of the canvas as ImageData
  const historyRef = useRef<ImageData[]>([]);
  const historyIdxRef = useRef(-1);
  const drawing = useRef(false);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Truncate any redo states
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(img);
    historyIdxRef.current = historyRef.current.length - 1;
    // Limit history
    if (historyRef.current.length > 40) {
      historyRef.current.shift();
      historyIdxRef.current = historyRef.current.length - 1;
    }
  }, []);

  // Init: white background + initial history
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    pushHistory();
  }, [width, height, pushHistory]);

  // Export on demand
  const doExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onExport(canvas.toDataURL('image/png'));
  }, [onExport]);

  // Undo
  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(historyRef.current[historyIdxRef.current]!, 0, 0);
  }, []);

  // Redo
  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(historyRef.current[historyIdxRef.current]!, 0, 0);
  }, []);

  // Clear
  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    pushHistory();
  }, [width, height, pushHistory]);

  // Drawing handlers
  const getPos = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY] as [number, number];
    },
    [width, height],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    const pos = getPos(e);
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.beginPath();
    ctx.moveTo(pos[0], pos[1]);
    ctx.strokeStyle = isEraser ? '#ffffff' : color;
    ctx.lineWidth = BRUSH_SIZES[brushIdx]!;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const pos = getPos(e);
    if (!pos) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(pos[0], pos[1]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos[0], pos[1]);
  };

  const endStroke = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.globalCompositeOperation = 'source-over';
    }
    pushHistory();
  }, [pushHistory]);

  const onPointerUp = (e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }
    endStroke();
  };

  return (
    <div className="space-y-3">
      {/* Canvas */}
      <div
        ref={wrapRef}
        className="relative mx-auto rounded-lg overflow-hidden border border-border"
        style={{ width, height, maxWidth: '100%', aspectRatio: `${width}/${height}` }}
      >
        <canvas
          ref={canvasRef}
          className="block touch-none"
          style={{ width: '100%', height: '100%', cursor: disabled ? 'not-allowed' : isEraser ? 'cell' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={(e) => {
            if (drawing.current && e.buttons === 0) endStroke();
          }}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* Color palette */}
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="gp-color-swatch"
              style={{
                background: c,
                boxShadow: color === c && !isEraser ? `0 0 0 2px var(--neon-cyan), 0 0 8px rgba(34,211,238,0.4)` : 'none',
                border: c === '#ffffff' ? '1px solid var(--border)' : 'none',
              }}
              onClick={() => {
                setColor(c);
                setIsEraser(false);
              }}
              disabled={disabled}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Brush sizes */}
        <div className="flex gap-1">
          {BRUSH_SIZES.map((sz, i) => (
            <button
              key={sz}
              type="button"
              className={`gp-tool-btn ${brushIdx === i ? 'active' : ''}`}
              onClick={() => setBrushIdx(i)}
              disabled={disabled}
              title={`Taille ${i + 1}`}
            >
              <span
                className="rounded-full bg-current"
                style={{ width: sz, height: sz, minWidth: sz }}
              />
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Eraser */}
        <button
          type="button"
          className={`gp-tool-btn ${isEraser ? 'active' : ''}`}
          onClick={() => setIsEraser(!isEraser)}
          disabled={disabled}
          title="Gomme"
        >
          <Eraser className="w-4 h-4" />
        </button>

        {/* Undo / Redo */}
        <button
          type="button"
          className="gp-tool-btn"
          onClick={undo}
          disabled={disabled}
          title="Annuler"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="gp-tool-btn"
          onClick={redo}
          disabled={disabled}
          title="Refaire"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Clear */}
        <button
          type="button"
          className="gp-tool-btn text-neon-rose"
          onClick={clear}
          disabled={disabled}
          title="Tout effacer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Export button (used from parent) */}
      <button
        type="button"
        className="btn-primary w-full"
        onClick={doExport}
        disabled={disabled}
      >
        ✅ Envoyer le dessin
      </button>
    </div>
  );
}
