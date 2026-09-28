"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  ease?: string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Animates a number from 0 to the target value on mount.
 * Uses Anime.js for smooth counting animation.
 */
export function AnimatedCounter({
  value,
  duration = 800,
  ease = "outExpo",
  className = "",
  prefix = "",
  suffix = "",
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Respect reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      ref.current.textContent = `${prefix}${value}${suffix}`;
      return;
    }

    const obj = { v: 0 };
    animationRef.current = animate(obj, {
      v: value,
      duration,
      ease,
      onUpdate() {
        if (ref.current) {
          ref.current.textContent = `${prefix}${Math.round(obj.v)}${suffix}`;
        }
      },
    });

    return () => {
      animationRef.current?.pause();
    };
  }, [value, duration, ease, prefix, suffix]);

  return <span ref={ref} className={className}>{prefix}0{suffix}</span>;
}
