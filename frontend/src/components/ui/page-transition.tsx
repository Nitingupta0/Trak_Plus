"use client";

import * as React from "react";
import { animate } from "animejs";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps page content with a smooth entrance animation.
 * Uses Anime.js for the initial mount animation rather than CSS-only
 * so we get precise easing control and can compose with other animations.
 */
export function PageTransition({ children, className = "" }: PageTransitionProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    animate(ref.current, {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 450,
      ease: "outExpo",
    });
  }, []);

  return (
    <div
      ref={ref}
      className={`will-change-transform ${className}`}
      style={{ opacity: 0 }}
    >
      {children}
    </div>
  );
}
