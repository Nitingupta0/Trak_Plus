"use client";

import * as React from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  baseOpacity: number;
  colorLight: string;
  colorDark: string;
}

export function AmbientBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const mouseRef = React.useRef<{ x: number; y: number; active: boolean }>({
    x: -1000,
    y: -1000,
    active: false,
  });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);

    // High contrast particles tuned for light mode vs dark mode
    const palette = [
      { light: "rgba(180, 83, 9, 0.85)",   dark: "rgba(245, 158, 11, 0.85)" },  // amber
      { light: "rgba(194, 65, 12, 0.80)",  dark: "rgba(251, 146, 60, 0.80)" },  // terracotta
      { light: "rgba(146, 64, 14, 0.80)",  dark: "rgba(252, 211, 77, 0.85)" },  // gold
      { light: "rgba(71, 85, 105, 0.75)",  dark: "rgba(192, 132, 252, 0.75)" }, // slate / iris
    ];

    const particleCount = Math.min(Math.floor(width / 26), 65);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const pColor = palette[Math.floor(Math.random() * palette.length)];
      const baseOpacity = Math.random() * 0.45 + 0.35;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.2 + 1.2,
        speedX: (Math.random() - 0.5) * 0.45,
        speedY: -(Math.random() * 0.55 + 0.2), // rises gently
        opacity: baseOpacity,
        baseOpacity,
        colorLight: pColor.light,
        colorDark: pColor.dark,
      });
    }

    let time = 0;

    const render = () => {
      time += 0.012;
      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains("dark");
      const mouse = mouseRef.current;

      // 1. Constellation links
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            const alpha = (1 - dist / 130) * (isDark ? 0.16 : 0.22);
            ctx.strokeStyle = isDark
              ? `rgba(230, 180, 100, ${alpha})`
              : `rgba(160, 95, 30, ${alpha})`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // 2. Render and update particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Smooth wave drift
        p.x += p.speedX + Math.sin(time + i * 0.8) * 0.3;
        p.y += p.speedY;

        // Mouse gravity & brightness
        if (mouse.active) {
          const mdx = mouse.x - p.x;
          const mdy = mouse.y - p.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < 160) {
            const force = (1 - mdist / 160) * 1.0;
            p.x += (mdx / mdist) * force;
            p.y += (mdy / mdist) * force;
            p.opacity = Math.min(p.baseOpacity + 0.4, 0.95);
          } else {
            p.opacity = p.baseOpacity;
          }
        }

        // Loop boundaries
        if (p.y < -15) p.y = height + 15;
        if (p.x < -15) p.x = width + 15;
        if (p.x > width + 15) p.x = -15;

        // Draw particle
        ctx.fillStyle = isDark ? p.colorDark : p.colorLight;
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* ── 1. Warm breathing atmospheric aurora spheres (Visible in both Light & Dark modes) ── */}
      <div
        className="absolute -top-24 right-[-8%] h-[720px] w-[720px] rounded-full opacity-65 dark:opacity-40 blur-[130px] transition-all duration-1000"
        style={{
          background:
            "radial-gradient(circle, oklch(0.82 0.12 70 / 0.50) 0%, transparent 70%)",
          animation: "ambient-float-1 26s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute -bottom-24 left-[2%] h-[680px] w-[680px] rounded-full opacity-55 dark:opacity-35 blur-[120px] transition-all duration-1000"
        style={{
          background:
            "radial-gradient(circle, oklch(0.84 0.11 48 / 0.45) 0%, transparent 70%)",
          animation: "ambient-float-2 32s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute top-1/3 left-1/3 h-[520px] w-[520px] rounded-full opacity-45 dark:opacity-30 blur-[140px] transition-all duration-1000"
        style={{
          background:
            "radial-gradient(circle, oklch(0.85 0.10 145 / 0.35) 0%, transparent 70%)",
          animation: "ambient-float-3 38s ease-in-out infinite alternate",
        }}
      />

      {/* ── 2. Interactive HTML5 Canvas: floating embers & constellation lines ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full transition-opacity duration-300"
      />

      {/* ── 3. Archive blueprint grid with fine + registration crosshairs ── */}
      <svg
        className="absolute inset-0 size-full opacity-[0.06] dark:opacity-[0.08]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="archive-grid-pattern"
            width="72"
            height="72"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 72 0 L 0 0 0 72"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            <path
              d="M -4 0 L 4 0 M 0 -4 L 0 4"
              stroke="currentColor"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#archive-grid-pattern)" />
      </svg>
    </div>
  );
}
