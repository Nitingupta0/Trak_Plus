"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

interface FadeInStaggerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function FadeInStagger({ children, className = "", delay = 100 }: FadeInStaggerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Set initial state
      const elements = Array.from(containerRef.current.children) as HTMLElement[];
      elements.forEach(el => {
        el.style.opacity = "0";
      });

      animate(elements, {
        translateY: [20, 0],
        opacity: [0, 1],
        easing: "easeOutQuint",
        duration: 800,
        delay: stagger(100, { start: delay }),
      });
    }
  }, [delay]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
