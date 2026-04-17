'use client';
// Petit moteur de confettis sur canvas — reprise du confetti.js de MVPCultureUpdate.

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  color: string;
  shape: 'rect' | 'circle';
  life: number;
};

type BurstOpts = {
  x?: number;
  y?: number;
  count?: number;
  spread?: number;
  velocity?: number;
  colors?: string[];
};

const COLORS = ['#22D3EE', '#EC4899', '#A855F7', '#A3E635', '#FBBF24', '#F472B6', '#ffffff'];

let particles: Particle[] = [];
let rafId: number | null = null;

function ensureCanvas() {
  let c = document.getElementById('fx-canvas') as HTMLCanvasElement | null;
  if (!c) {
    c = document.createElement('canvas');
    c.id = 'fx-canvas';
    c.className = 'fx-canvas';
    document.body.appendChild(c);
  }
  const dpr = window.devicePixelRatio || 1;
  c.width = window.innerWidth * dpr;
  c.height = window.innerHeight * dpr;
  c.style.width = window.innerWidth + 'px';
  c.style.height = window.innerHeight + 'px';
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas: c, ctx };
}

function loop() {
  const { canvas, ctx } = ensureCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.vy += 0.22;
    p.vx *= 0.995;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vrot;
    p.life -= 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 60));
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (particles.length) rafId = requestAnimationFrame(loop);
  else {
    rafId = null;
    const c = document.getElementById('fx-canvas') as HTMLCanvasElement | null;
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  }
}

function startIfIdle() {
  if (rafId == null) rafId = requestAnimationFrame(loop);
}

export function burst(opts: BurstOpts = {}) {
  if (typeof window === 'undefined') return;
  const {
    x = window.innerWidth / 2,
    y = window.innerHeight * 0.4,
    count = 60,
    spread = Math.PI / 2,
    velocity = 16,
    colors = COLORS,
  } = opts;
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
    const v = velocity * (0.6 + Math.random() * 0.7);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      shape: Math.random() < 0.5 ? 'rect' : 'circle',
      life: 120 + Math.random() * 40,
    });
  }
  startIfIdle();
}

export function cannon() {
  if (typeof window === 'undefined') return;
  burst({ x: window.innerWidth * 0.15, y: window.innerHeight * 0.8, count: 50, spread: Math.PI / 3, velocity: 22 });
  burst({ x: window.innerWidth * 0.85, y: window.innerHeight * 0.8, count: 50, spread: Math.PI / 3, velocity: 22 });
}

export function shower() {
  if (typeof window === 'undefined') return;
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: -20,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 2,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.2,
      size: 5 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      shape: Math.random() < 0.5 ? 'rect' : 'circle',
      life: 200,
    });
  }
  startIfIdle();
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => ensureCanvas());
}

export const mvpConfetti = { burst, cannon, shower };
