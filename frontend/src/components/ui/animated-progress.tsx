"use client";

import { useEffect, useRef } from "react";
import { animate, createSpring } from "animejs";

interface AnimatedProgressProps {
  value: number;
  max: number;
  color?: string;
  backgroundColor?: string;
  height?: number;
  duration?: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
}

/**
 * Animated progress bar that grows from 0 to target width.
 * Uses spring physics for natural motion.
 */
export function AnimatedProgress({
  value,
  max,
  color = "var(--foreground)",
  backgroundColor = "oklch(0.86 0.012 88.7 / 0.3)",
  height = 8,
  duration = 1000,
  className = "",
  showLabel = false,
  label,
}: AnimatedProgressProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const spring = createSpring({ stiffness: 150, damping: 18 });

  const percentage = max > 0 ? (value / max) * 100 : 0;

  useEffect(() => {
    if (!barRef.current) return;

    // Respect reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      barRef.current.style.width = `${percentage}%`;
      return;
    }

    animate(barRef.current, {
      width: { from: "0%", to: `${percentage}%` },
      duration,
      ease: spring,
    });
  }, [percentage, duration, spring]);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showLabel && label && (
        <span className="text-muted-foreground shrink-0 font-sans text-[11px] font-semibold tracking-[0.08em] uppercase w-24 truncate">
          {label}
        </span>
      )}
      <div
        className="flex-1 overflow-hidden"
        style={{ height, backgroundColor }}
      >
        <div
          ref={barRef}
          className="h-full"
          style={{
            width: "0%",
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>
      <span className="w-10 text-right font-serif text-lg font-bold tabular-nums">
        {value}
      </span>
    </div>
  );
}
