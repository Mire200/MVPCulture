'use client';
import { useEffect, useRef } from 'react';

type AvatarDef = {
  src: string;
  ring: string;
  size: number;
  tag: string;
};

const AVATARS: AvatarDef[] = [
  { src: '/avatars/manatee.png',      ring: '#22D3EE', size: 104, tag: 'Lamantin' },
  { src: '/avatars/capdog.png',       ring: '#EC4899', size: 92,  tag: 'Captain' },
  { src: '/avatars/squirtle.png',     ring: '#A3E635', size: 88,  tag: 'Squirtle' },
  { src: '/avatars/stare.png',        ring: '#FBBF24', size: 118, tag: 'Stare' },
  { src: '/avatars/anime.gif',        ring: '#F43F5E', size: 84,  tag: 'Kurapika' },
  { src: '/avatars/turtle.png',       ring: '#A855F7', size: 100, tag: 'Mikey' },
  { src: '/avatars/duo.jpg',          ring: '#22D3EE', size: 110, tag: 'McFly & Carlito' },
  { src: '/avatars/duo2.jpg',         ring: '#EC4899', size: 96,  tag: 'Duo' },
];

type Sprite = {
  el: HTMLDivElement;
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  bobPhase: number;
  bobSpeed: number;
};

type Rect = { x: number; y: number; w: number; h: number } | null;

export function LandingAvatars() {
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const heroRect = (): Rect => {
      const el = document.querySelector('.landing-hero');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const pad = 40;
      return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
    };
    const tastyRect = (): Rect => {
      const el = document.querySelector('.tasty-logo');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const pad = 16;
      return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
    };

    const intersects = (x: number, y: number, s: number, r: Rect) => {
      if (!r) return false;
      return !(x + s < r.x || x > r.x + r.w || y + s < r.y || y > r.y + r.h);
    };

    const sprites: Sprite[] = [];
    const created: HTMLElement[] = [];
    AVATARS.forEach((a) => {
      const el = document.createElement('div');
      el.className = 'landing-avatar';
      el.style.width = a.size + 'px';
      el.style.height = a.size + 'px';
      el.style.setProperty('--ring', a.ring);
      el.innerHTML = `<img src="${a.src}" alt="" loading="lazy"/>`;
      stage.appendChild(el);
      created.push(el);

      let x = 0;
      let y = 0;
      let tries = 0;
      do {
        x = Math.random() * Math.max(0, W() - a.size);
        y = Math.random() * Math.max(0, H() - a.size);
        tries++;
      } while (
        tries < 40 &&
        (intersects(x, y, a.size, heroRect()) || intersects(x, y, a.size, tastyRect()))
      );

      const speed = 0.2 + Math.random() * 0.35;
      const angle = Math.random() * Math.PI * 2;
      const rotSpeed = (Math.random() - 0.5) * 0.25;

      sprites.push({
        el,
        size: a.size,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * 30 - 15,
        vrot: rotSpeed,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.02 + Math.random() * 0.02,
      });
    });

    let raf = 0;
    const softBounce = (s: Sprite, rect: Rect) => {
      if (!rect) return;
      const cx = s.x + s.size / 2;
      const cy = s.y + s.size / 2;
      if (cx > rect.x && cx < rect.x + rect.w && cy > rect.y && cy < rect.y + rect.h) {
        const dLeft = cx - rect.x;
        const dRight = rect.x + rect.w - cx;
        const dTop = cy - rect.y;
        const dBot = rect.y + rect.h - cy;
        const min = Math.min(dLeft, dRight, dTop, dBot);
        if (min === dLeft) {
          s.x = rect.x - s.size;
          s.vx = -Math.abs(s.vx);
        } else if (min === dRight) {
          s.x = rect.x + rect.w;
          s.vx = Math.abs(s.vx);
        } else if (min === dTop) {
          s.y = rect.y - s.size;
          s.vy = -Math.abs(s.vy);
        } else {
          s.y = rect.y + rect.h;
          s.vy = Math.abs(s.vy);
        }
      }
    };

    const tick = () => {
      const hr = heroRect();
      const tr = tastyRect();
      for (const s of sprites) {
        s.x += s.vx;
        s.y += s.vy;
        s.rot += s.vrot;
        s.bobPhase += s.bobSpeed;

        if (s.x <= 0) {
          s.x = 0;
          s.vx = Math.abs(s.vx);
        }
        if (s.x + s.size >= W()) {
          s.x = W() - s.size;
          s.vx = -Math.abs(s.vx);
        }
        if (s.y <= 0) {
          s.y = 0;
          s.vy = Math.abs(s.vy);
        }
        if (s.y + s.size >= H()) {
          s.y = H() - s.size;
          s.vy = -Math.abs(s.vy);
        }

        softBounce(s, hr);
        softBounce(s, tr);

        const bob = Math.sin(s.bobPhase) * 4;
        s.el.style.transform = `translate3d(${s.x}px, ${s.y + bob}px, 0) rotate(${s.rot * 0.15}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      for (const el of created) el.remove();
    };
  }, []);

  return <div className="landing-avatar-stage" ref={stageRef} aria-hidden="true" />;
}
