"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { animate } from "animejs";
import { useRef, type ReactNode } from "react";
import { ScheduleCard } from "./schedule-card";
import type { ScheduleItem } from "@/lib/types";

interface WeekSectionProps {
  title: string;
  items: ScheduleItem[];
  defaultOpen?: boolean;
}

/**
 * Collapsible week section with animated expand/collapse.
 * Features staggered card entrance and smooth height transitions.
 */
export function WeekSection({
  title,
  items,
  defaultOpen = true,
}: WeekSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);

  const toggle = () => {
    if (contentRef.current) {
      if (isOpen) {
        // Collapse
        animate(contentRef.current, {
          height: { to: 0 },
          opacity: { to: 0 },
          duration: 300,
          ease: "outQuad",
        });
        if (chevronRef.current) {
          animate(chevronRef.current, {
            rotate: { to: 0 },
            duration: 300,
            ease: "outQuad",
          });
        }
      } else {
        // Expand
        const content = contentRef.current;
        content.style.height = "auto";
        const targetHeight = content.offsetHeight;
        content.style.height = "0px";

        animate(content, {
          height: { to: targetHeight },
          opacity: { to: 1 },
          duration: 400,
          ease: "outExpo",
          onComplete: () => {
            content.style.height = "auto";
          },
        });
        if (chevronRef.current) {
          animate(chevronRef.current, {
            rotate: { to: 180 },
            duration: 300,
            ease: "outQuad",
          });
        }
      }
    }
    setIsOpen(!isOpen);
  };

  return (
    <section className="flex flex-col">
      {/* Section Header */}
      <button
        onClick={toggle}
        className="flex items-center justify-between py-3 px-1 border-b border-border/30 hover:bg-muted/20 transition-colors group"
        data-testid="week-section-header"
      >
        <div className="flex items-center gap-3">
          <ChevronDown
            ref={chevronRef}
            className="w-4 h-4 text-muted-foreground transition-transform"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          />
          <h2 className="font-sans text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
            {title}
          </h2>
        </div>
        <span className="text-xs text-muted-foreground/60 font-mono">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </button>

      {/* Section Content */}
      <div
        ref={contentRef}
        className={`overflow-hidden ${isOpen ? "opacity-100" : "opacity-0 h-0"}`}
      >
        <div className="flex flex-col gap-2 py-3">
          {items.map((item, idx) => (
            <ScheduleCard key={item.event_id} item={item} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Simple non-collapsible section for backlog.
 */
export function SimpleSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-3 py-3 px-1 border-b border-border/30">
        <h2 className="font-sans text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-2 py-3">{children}</div>
    </section>
  );
}
