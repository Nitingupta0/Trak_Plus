"use client";

import * as React from "react";
import { animate, stagger } from "animejs";

/**
 * Client-side animation orchestrator for the title detail page.
 * Wraps the poster and main content columns with entrance animations.
 */
export function TitleDetailAnimations({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ref.current) return;

    // Poster (first aside) — slide up from below
    const poster = ref.current.querySelector('[data-animate="poster"]');
    if (poster) {
      animate(poster, {
        opacity: [0, 1],
        translateY: [20, 0],
        scale: [0.98, 1],
        duration: 550,
        ease: "outExpo",
      });
    }

    // Title + meta block — fade from right
    const titleBlock = ref.current.querySelector('[data-animate="title"]');
    if (titleBlock) {
      animate(titleBlock, {
        opacity: [0, 1],
        translateX: [10, 0],
        duration: 500,
        delay: 80,
        ease: "outExpo",
      });
    }

    // Genre badges — stagger
    const genres = ref.current.querySelectorAll('[data-animate="genre"]');
    if (genres.length) {
      animate(genres, {
        opacity: [0, 1],
        translateY: [6, 0],
        duration: 300,
        delay: stagger(40, { start: 180 }),
        ease: "outSine",
      });
    }

    // Synopsis
    const synopsis = ref.current.querySelector('[data-animate="synopsis"]');
    if (synopsis) {
      animate(synopsis, {
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 450,
        delay: 250,
        ease: "outExpo",
      });
    }

    // Streaming badges
    const badges = ref.current.querySelectorAll('[data-animate="badge"]');
    if (badges.length) {
      animate(badges, {
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: 260,
        delay: stagger(30, { start: 350 }),
        ease: "outBack(2)",
      });
    }

    // Cast portraits — stagger
    const castCards = ref.current.querySelectorAll('[data-animate="cast-card"]');
    if (castCards.length) {
      animate(castCards, {
        opacity: [0, 1],
        translateY: [12, 0],
        duration: 350,
        delay: stagger(45, { start: 420 }),
        ease: "outExpo",
      });
    }

    // Notes rail
    const notes = ref.current.querySelector('[data-animate="notes"]');
    if (notes) {
      animate(notes, {
        opacity: [0, 1],
        translateX: [12, 0],
        duration: 450,
        delay: 200,
        ease: "outExpo",
      });
    }
  }, []);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
