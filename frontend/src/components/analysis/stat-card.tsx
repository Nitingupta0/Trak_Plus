"use client";

import { AnimatedCounter } from "@/components/ui/animated-counter";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  suffix?: string;
  prefix?: string;
  highlight?: boolean;
  testId?: string;
}

/**
 * Animated stat card for the analysis dashboard.
 * Features a counting animation and subtle hover lift effect.
 */
export function StatCard({
  label,
  value,
  icon,
  suffix = "",
  prefix = "",
  highlight = false,
  testId,
}: StatCardProps) {
  const isNumeric = typeof value === "number";

  return (
    <div
      className={`group relative flex flex-col gap-2 p-4 border transition-all duration-300 ease-out hover:shadow-lg hover:-translate-y-1 ${
        highlight
          ? "border-foreground/30 bg-foreground/5"
          : "border-border/40 bg-card/50"
      }`}
      data-testid={testId}
    >
      {/* Icon */}
      {icon && (
        <div className="text-muted-foreground/60 group-hover:text-foreground transition-colors">
          {icon}
        </div>
      )}

      {/* Label */}
      <span className="text-muted-foreground font-sans text-[10px] font-semibold tracking-[0.1em] uppercase">
        {label}
      </span>

      {/* Value */}
      <span
        className={`font-serif text-3xl font-bold tabular-nums ${
          highlight ? "text-foreground" : "text-foreground/90"
        }`}
        data-testid="stat-value"
      >
        {isNumeric ? (
          <AnimatedCounter
            value={value}
            prefix={prefix}
            suffix={suffix}
            duration={1000}
          />
        ) : (
          <>
            {prefix}
            {value}
            {suffix}
          </>
        )}
      </span>

      {/* Decorative corner */}
      <div className="absolute top-0 right-0 w-8 h-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full border-t border-r border-foreground/10 group-hover:border-foreground/30 transition-colors" />
      </div>
    </div>
  );
}
