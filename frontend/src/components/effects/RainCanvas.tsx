import React, { useEffect, useRef } from "react";

/**
 * Animated rain streaks. `intensity` 0..1 sets how many drops fall and how fast.
 * Pointer-events are off, so it can sit over maps or behind the whole app.
 * Honours prefers-reduced-motion (draws nothing).
 */
export const RainCanvas: React.FC<{ intensity: number; className?: string; color?: string; maxDrops?: number }> = ({
  intensity, className = "", color = "125, 211, 252", maxDrops = 260,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const level = useRef(intensity);
  level.current = Math.max(0, Math.min(1, intensity));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const drops = Array.from({ length: maxDrops }, () => ({
      x: Math.random(), y: Math.random(), len: 8 + Math.random() * 14, speed: 0.6 + Math.random() * 0.8, a: 0.2 + Math.random() * 0.5,
    }));
    const splashes: { x: number; y: number; r: number; a: number }[] = [];
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(50, t - last) / 16.7; last = t;
      const L = level.current;
      ctx.clearRect(0, 0, w, h);
      const n = Math.floor(maxDrops * L);
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        const vy = (6 + 10 * L) * d.speed * dt;
        d.y += vy / h; d.x += (vy * 0.18) / w;
        if (d.y > 1) {
          if (Math.random() < 0.25 * L) splashes.push({ x: d.x * w, y: h - 2 - Math.random() * 6, r: 1, a: 0.6 });
          d.y = -0.05; d.x = Math.random();
        }
        if (d.x > 1) d.x -= 1;
        const x = d.x * w, y = d.y * h;
        ctx.strokeStyle = `rgba(${color}, ${d.a * (0.35 + 0.65 * L)})`;
        ctx.lineWidth = 1 + L * 0.6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - d.len * 0.18, y - d.len); ctx.stroke();
      }
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.r += 0.7 * dt; s.a -= 0.035 * dt;
        if (s.a <= 0) { splashes.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(${color}, ${s.a})`;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 2, s.r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [color, maxDrops]);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none ${className}`} />;
};
