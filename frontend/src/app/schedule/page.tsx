"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

import { AppLayout } from "@/components/layout/app-layout";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { bff } from "@/lib/client/api";
import { WeekSection, SimpleSection } from "@/components/schedule/week-section";
import { ScheduleCard } from "@/components/schedule/schedule-card";
import type { ScheduleItem, ScheduleResponse } from "@/lib/types";

function groupByWeek(items: ScheduleItem[]): Map<string, ScheduleItem[]> {
  const groups = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const weekStart = getWeekStart(item.scheduled_date);
    const list = groups.get(weekStart) ?? [];
    list.push(item);
    groups.set(weekStart, list);
  }
  return groups;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(d)} – ${fmt(end)}`;
}

export default function SchedulePage() {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["schedule"],
    queryFn: () => bff<ScheduleResponse>("/schedule"),
    retry: false,
  });

  useEffect(() => {
    if (isError && error.message === "not authenticated") {
      router.replace("/login");
    }
  }, [isError, error, router]);

  // Animate cards on mount
  useEffect(() => {
    if (!contentRef.current || isPending) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) return;

    const cards = contentRef.current.querySelectorAll("[data-testid='schedule-card']");
    if (cards.length === 0) return;

    // Set initial state
    cards.forEach((el) => {
      (el as HTMLElement).style.opacity = "0";
    });

    animate(cards, {
      translateY: { from: 20, to: 0 },
      opacity: { from: 0, to: 1 },
      duration: 600,
      ease: "outExpo",
      delay: stagger(60),
    });
  }, [data, isPending]);

  const weeks = data?.upcoming ? groupByWeek(data.upcoming) : new Map();
  const total = (data?.upcoming.length ?? 0) + (data?.backlog.length ?? 0);

  return (
    <AppLayout>
      <main className="page-gutter flex flex-col gap-6 max-w-4xl" data-testid="schedule-page">
        {/* Header with animated counters */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-border/30">
          <h1 className="font-serif text-2xl font-bold tracking-tight">Schedule</h1>
          {data ? (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-sans text-[10px] uppercase tracking-wider">
                  Upcoming
                </span>
                <AnimatedCounter
                  value={data.upcoming.length}
                  className="font-serif text-lg font-bold text-foreground"
                />
              </div>
              <div className="w-px h-4 bg-border/40" />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-sans text-[10px] uppercase tracking-wider">
                  Backlog
                </span>
                <AnimatedCounter
                  value={data.backlog.length}
                  className="font-serif text-lg font-bold text-muted-foreground"
                />
              </div>
            </div>
          ) : null}
        </header>

        {isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-none" />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="py-16">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nothing scheduled</EmptyTitle>
                <EmptyDescription>
                  Add titles to your library — planned release dates and upcoming episode air dates
                  will appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div ref={contentRef} className="flex flex-col">
            {/* Backlog Section */}
            {data?.backlog && data.backlog.length > 0 && (
              <SimpleSection title="Backlog (past, not completed)">
                {data.backlog.map((item, idx) => (
                  <ScheduleCard key={item.event_id} item={item} index={idx} />
                ))}
              </SimpleSection>
            )}

            {/* Upcoming Weeks */}
            {[...weeks.entries()].map(([weekStart, items]) => (
              <WeekSection
                key={weekStart}
                title={formatWeek(weekStart)}
                items={items}
              />
            ))}
          </div>
        )}
      </main>
    </AppLayout>
  );
}