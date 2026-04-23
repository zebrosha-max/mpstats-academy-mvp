'use client';

import { useEffect, useRef, useState } from 'react';

const S = 'bWFkZSBieQpaZWJyb3NoYQ==';

const F: Record<string, string[]> = {
  m: ['00000', '10001', '11011', '10101', '10001', '10001', '10001'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  d: ['00001', '00001', '01111', '10001', '10001', '10001', '01111'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01111'],
  b: ['10000', '10000', '11110', '10001', '10001', '10001', '11110'],
  y: ['00000', '00000', '10001', '10001', '01111', '00001', '11110'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  o: ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  h: ['10000', '10000', '11110', '10001', '10001', '10001', '10001'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

interface Pixel {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  delay: number;
  size: number;
  state: 'flying' | 'landed' | 'dissolving';
}

const ASSEMBLE = 800;
const HOLD = 2000;
const DISSOLVE = 700;
const TOTAL = ASSEMBLE + HOLD + DISSOLVE;

const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
const ARM_WINDOW_MS = 3000;

function buildPixels(text: string, cx: number, cy: number, p: number): Pixel[] {
  const lines = text.split('\n');
  const charW = 5;
  const charH = 7;
  const gap = 1;
  const lineGap = 2;
  const lineWidths = lines.map((l) => l.length * (charW + gap) - gap);
  const totalH = lines.length * charH + (lines.length - 1) * lineGap;
  const startY = cy - (totalH * p) / 2;
  const pixels: Pixel[] = [];

  lines.forEach((line, li) => {
    const lw = lineWidths[li];
    const startX = cx - (lw * p) / 2;
    const lineY = startY + li * (charH + lineGap) * p;
    [...line].forEach((ch, ci) => {
      const bm = F[ch];
      if (!bm) return;
      const cxPos = startX + ci * (charW + gap) * p;
      bm.forEach((row, ry) => {
        [...row].forEach((bit, rx) => {
          if (bit === '1') {
            pixels.push({
              tx: cxPos + rx * p,
              ty: lineY + ry * p,
              sx: 0,
              sy: 0,
              x: 0,
              y: 0,
              vx: 0,
              vy: 0,
              delay: Math.random() * 500,
              size: p,
              state: 'flying',
            });
          }
        });
      });
    });
  });

  return pixels;
}

function initFly(pixels: Pixel[], w: number, h: number) {
  pixels.forEach((p) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(w, h) * 1.1;
    p.sx = w / 2 + Math.cos(angle) * dist;
    p.sy = h / 2 + Math.sin(angle) * dist;
    p.x = p.sx;
    p.y = p.sy;
  });
}

function drawBg(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.94)';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.07;
  const sw = 90;
  const off = (t / 40) % (sw * 2);
  ctx.fillStyle = '#ffffff';
  for (let x = -sw * 2 + off; x < w + sw * 2; x += sw * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + sw, 0);
    ctx.lineTo(x + sw + h * 0.4, h);
    ctx.lineTo(x + h * 0.4, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPx(ctx: CanvasRenderingContext2D, p: Pixel, t: number) {
  const s = p.size;
  const pulse = p.state === 'landed' ? 10 + Math.sin(t / 200) * 3 : 4;
  ctx.shadowColor = '#00F0FF';
  ctx.shadowBlur = pulse;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(p.x, p.y, s - 1, s - 1);
  ctx.shadowBlur = 0;
}

function runAnimation(canvas: HTMLCanvasElement, onDone: () => void): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    onDone();
    return () => undefined;
  }
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  const text = atob(S);
  const lines = text.split('\n');
  const maxLineChars = Math.max(...lines.map((l) => l.length));
  const maxW = maxLineChars * 6 - 1;
  const totalH = lines.length * 7 + (lines.length - 1) * 2;
  const pSize = Math.max(4, Math.min(Math.floor((w * 0.85) / maxW), Math.floor((h * 0.6) / totalH), 22));

  const pixels = buildPixels(text, w / 2, h / 2, pSize);
  initFly(pixels, w, h);

  const start = performance.now();
  let rafId = 0;
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled) return;
    const t = now - start;
    drawBg(ctx, t, w, h);

    pixels.forEach((p) => {
      if (t < ASSEMBLE) {
        const pt = Math.max(0, Math.min(1, (t - p.delay) / 550));
        const ease = 1 - Math.pow(1 - pt, 3);
        p.x = p.sx + (p.tx - p.sx) * ease;
        p.y = p.sy + (p.ty - p.sy) * ease;
        if (pt >= 1) p.state = 'landed';
      } else if (t < ASSEMBLE + HOLD) {
        p.state = 'landed';
        p.x = p.tx;
        p.y = p.ty;
      } else {
        if (p.state !== 'dissolving') {
          p.state = 'dissolving';
          const angle = Math.random() * Math.PI * 2;
          const speed = 3 + Math.random() * 5;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed - 2;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
      }
      drawPx(ctx, p, t);
    });

    if (t < TOTAL) {
      rafId = requestAnimationFrame(tick);
    } else {
      onDone();
    }
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}

export function KbdOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    let idx = 0;
    let armed = false;
    let armTimer: ReturnType<typeof setTimeout> | null = null;

    const resetArm = () => {
      armed = false;
      if (armTimer) {
        clearTimeout(armTimer);
        armTimer = null;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (activeRef.current) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (armed && e.code === 'KeyZ') {
        resetArm();
        idx = 0;
        setActive(true);
        return;
      }

      if (e.key === SEQ[idx]) {
        idx++;
        if (idx === SEQ.length) {
          idx = 0;
          armed = true;
          if (armTimer) clearTimeout(armTimer);
          armTimer = setTimeout(() => {
            armed = false;
            armTimer = null;
          }, ARM_WINDOW_MS);
        }
      } else {
        idx = e.key === SEQ[0] ? 1 : 0;
        resetArm();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (armTimer) clearTimeout(armTimer);
    };
  }, []);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const cleanup = runAnimation(canvasRef.current, () => setActive(false));
    return cleanup;
  }, [active]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        pointerEvents: 'auto',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}
