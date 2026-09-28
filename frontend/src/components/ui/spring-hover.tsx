"use client";

import { useRef, type ReactNode } from "react";
import { animate, createSpring } from "animejs";

interface SpringHoverProps {
  children: ReactNode;
  className?: string;
  scale?: number;
  springConfig?: {
    stiffness?: number;
    damping?: number;
  };
}

/**
 * Wrapper component that adds spring-based hover interactions.
 * Scales up on hover with natural physics-based motion.
 */
export function SpringHover({
  children,
  className = "",
  scale = 1.03,
  springConfig = { stiffness: 300, damping: 20 },
}: SpringHoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  const spring = createSpring(springConfig);

  const handleMouseEnter = () => {
    if (ref.current) {
      animate(ref.current, {
        scale: { to: scale },
        duration: 400,
        ease: spring,
      });
    }
  };

  const handleMouseLeave = () => {
    if (ref.current) {
      animate(ref.current, {
        scale: { to: 1 },
        duration: 350,
        ease: spring,
      });
    }
  };

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={`will-change-transform ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ transform: "scale(1)" }}
    >
      {children}
    </div>
  );
}
