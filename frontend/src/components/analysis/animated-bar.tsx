"use client";

import { useEffect, useRef } from "react";
import { animate, createSpring } from "animejs";

interface AnimatedBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
  delay?: number;
}

/**
 * Animated horizontal bar for charts.
 * Grows from 0 to target width with spring physics.
 */
export function AnimatedBar({
  label,
  value,
  max,
  color = "var(--foreground)",
  delay = 0,
}: AnimatedBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const spring = createSpring({ stiffness: 150, damping: 18 });

  const percentage = max > 0 ? (value / max) * 100 : 0;

  useEffect(() => {
    if (!barRef.current) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      barRef.current.style.width = `${percentage}%`;
      return;
    }

    animate(barRef.current, {
      width: { from: "0%", to: `${percentage}%` },
      duration: 800,
      delay,
      ease: spring,
    });
  }, [percentage, delay, spring]);

  return (
    <div className="flex items-center gap-3 group">
      <span className="text-muted-foreground w-24 shrink-0 truncate font-sans text-[11px] font-semibold tracking-[0.08em] uppercase group-hover:text-foreground transition-colors">
        {label}
      </span>
      <div className="flex-1 h-6 bg-muted/30 relative overflow-hidden">
        <div
          ref={barRef}
          className="h-full relative"
          style={{
            width: "0%",
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        </div>
      </div>
      <span className="w-10 text-right font-serif text-lg font-bold tabular-nums">
        {value}
      </span>
    </div>
  );
}

/**
 * Bar chart container with staggered animations.
 */
export function BarChart({
  data,
  color = "var(--foreground)",
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex flex-col gap-3" data-testid="stats-bars">
      {data.map((item, idx) => (
        <AnimatedBar
          key={item.label}
          label={item.label}
          value={item.value}
          max={max}
          color={color}
          delay={idx * 80}
        />
      ))}
    </div>
  );
}
