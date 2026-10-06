"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

/**
 * SVG donut chart with animated segments.
 * Segments grow with staggered animation on mount.
 */
export function DonutChart({
  data,
  size = 180,
  strokeWidth = 24,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (!svgRef.current || total === 0) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const segments = svgRef.current.querySelectorAll(".donut-segment");

    if (prefersReducedMotion) {
      // Set final state immediately
      let offset = 0;
      segments.forEach((seg, idx) => {
        const el = seg as SVGCircleElement;
        const value = data[idx]?.value ?? 0;
        const percent = value / total;
        el.style.strokeDasharray = `${percent * circumference} ${circumference}`;
        el.style.strokeDashoffset = `${-offset * circumference}`;
        offset += percent;
      });
      return;
    }

    // Animate segments with stagger
    let offset = 0;
    segments.forEach((seg, idx) => {
      const el = seg as SVGCircleElement;
      const value = data[idx]?.value ?? 0;
      const percent = value / total;

      // Set initial state
      el.style.strokeDasharray = `${percent * circumference} ${circumference}`;
      el.style.strokeDashoffset = `${-offset * circumference}`;
      el.style.opacity = "0";

      offset += percent;
    });

    animate(segments, {
      opacity: { from: 0, to: 1 },
      duration: 600,
      delay: stagger(100),
      ease: "outExpo",
    });
  }, [data, total, circumference]);

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center border-2 border-dashed border-border/30"
        style={{ width: size, height: size, borderRadius: "50%" }}
      >
        <span className="text-muted-foreground text-xs">No data</span>
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(0.86 0.012 88.7 / 0.2)"
          strokeWidth={strokeWidth}
        />

        {/* Segments */}
        {data.map((segment, index) => {
          const percent = segment.value / total;
          // Calculate offset from previous segments
          const currentOffset = data.slice(0, index).reduce((sum, s) => sum + s.value / total, 0);

          return (
            <circle
              key={segment.label}
              className="donut-segment transition-all duration-300"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              style={{
                strokeDasharray: `${percent * circumference} ${circumference}`,
                strokeDashoffset: `${-currentOffset * circumference}`,
                transform: "rotate(0deg)",
                transformOrigin: "50% 50%",
              }}
            />
          );
        })}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerValue !== undefined && (
          <span className="font-serif text-2xl font-bold tabular-nums">
            {centerValue}
          </span>
        )}
        {centerLabel && (
          <span className="text-muted-foreground font-sans text-[9px] uppercase tracking-wider">
            {centerLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Legend for donut chart.
 */
export function DonutLegend({ data }: { data: DonutSegment[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col gap-2">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className="w-3 h-3 shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="flex-1 text-[11px] font-sans font-semibold tracking-wider uppercase text-muted-foreground">
            {item.label}
          </span>
          <span className="font-serif text-sm font-bold tabular-nums">
            {item.value}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-mono w-10 text-right">
            {total > 0 ? Math.round((item.value / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}
