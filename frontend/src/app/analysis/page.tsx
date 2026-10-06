"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Star, Trophy, BarChart3, Film, Tv, Gamepad2, BookOpen, Clapperboard } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { queries } from "@/lib/client/api";
import {
  MEDIA_TYPE_LABELS,
  STATUS_LABELS,
  type LibraryStatus,
  type MediaType,
} from "@/lib/types";
import { StatCard } from "@/components/analysis/stat-card";
import { BarChart } from "@/components/analysis/animated-bar";
import { DonutChart, DonutLegend } from "@/components/analysis/donut-chart";

const ALL_MEDIA_TYPES: MediaType[] = ["movie", "tv", "game", "anime", "manga"];
const STATUS_ORDER: LibraryStatus[] = [
  "watching",
  "playing",
  "reading",
  "plan_to",
  "completed",
  "dropped",
  "on_hold",
];

// Color palette matching library status themes
const STATUS_COLORS: Record<LibraryStatus, string> = {
  watching: "oklch(0.74 0.15 65)",
  playing: "oklch(0.74 0.15 65)",
  reading: "oklch(0.74 0.15 65)",
  plan_to: "oklch(0.68 0.13 250)",
  completed: "oklch(0.68 0.14 155)",
  on_hold: "oklch(0.70 0.11 300)",
  dropped: "oklch(0.66 0.15 25)",
};

const MEDIA_COLORS: Record<MediaType, string> = {
  movie: "oklch(0.70 0.15 30)",
  tv: "oklch(0.68 0.13 250)",
  game: "oklch(0.68 0.14 155)",
  anime: "oklch(0.72 0.14 330)",
  manga: "oklch(0.65 0.12 180)",
};

const MEDIA_ICONS: Record<MediaType, typeof Film> = {
  movie: Clapperboard,
  tv: Tv,
  game: Gamepad2,
  anime: Film,
  manga: BookOpen,
};

interface CountRow {
  key: string;
  label: string;
  count: number;
}

/** Analysis — status breakdown, media-type mix, and rating stats from the library. */
export default function AnalysisPage() {
  const router = useRouter();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["library"],
    queryFn: queries.library,
    retry: false,
  });

  useEffect(() => {
    if (isError && error.message === "not authenticated") {
      router.replace("/login");
    }
  }, [isError, error, router]);

  const entries = useMemo(() => data ?? [], [data]);

  const byStatus = useMemo<CountRow[]>(() => {
    const counts = new Map<LibraryStatus, number>();
    for (const entry of entries) counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
    return STATUS_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => ({
      key: s,
      label: STATUS_LABELS[s],
      count: counts.get(s) ?? 0,
    }));
  }, [entries]);

  const byMediaType = useMemo<CountRow[]>(() => {
    const counts = new Map<MediaType, number>();
    for (const entry of entries)
      counts.set(entry.title.media_type, (counts.get(entry.title.media_type) ?? 0) + 1);
    return ALL_MEDIA_TYPES.filter((m) => (counts.get(m) ?? 0) > 0).map((m) => ({
      key: m,
      label: MEDIA_TYPE_LABELS[m],
      count: counts.get(m) ?? 0,
    }));
  }, [entries]);

  const ratings = useMemo(
    () => entries.filter((e) => e.rating != null).map((e) => e.rating as number),
    [entries],
  );
  const avgRating = ratings.length
    ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
    : "—";
  const bestRated = useMemo(() => {
    const max = Math.max(...ratings, 0);
    if (!max) return null;
    return entries.filter((e) => e.rating === max).map((e) => e.title.title);
  }, [ratings, entries]);

  // Donut chart data for media types
  const donutData = byMediaType.map((item) => ({
    label: item.label,
    value: item.count,
    color: MEDIA_COLORS[item.key as MediaType] || "oklch(0.7 0.05 80)",
  }));

  return (
    <AppLayout>
      <main className="page-gutter flex flex-col gap-8 max-w-5xl" data-testid="analysis-page">
        <header className="pb-6 border-b border-border/30">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-muted-foreground" />
            <h1 className="font-serif text-2xl font-bold tracking-tight">Analysis</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Insights and statistics from your library
          </p>
        </header>

        {isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-none" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nothing to analyse yet</EmptyTitle>
                <EmptyDescription>
                  Add titles to your library and stats will build themselves here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Headline Stats Grid */}
            <section aria-label="Headline stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Titles tracked"
                value={entries.length}
                icon={<BarChart3 className="w-4 h-4" />}
                testId="stat-titles"
              />
              <StatCard
                label="Avg rating"
                value={avgRating}
                icon={<Star className="w-4 h-4" />}
                suffix="/10"
                highlight
                testId="stat-avg-rating"
              />
              <StatCard
                label="Rated"
                value={ratings.length}
                prefix=""
                suffix={`/${entries.length}`}
                icon={<Star className="w-4 h-4" />}
                testId="stat-rated"
              />
              <StatCard
                label="Completed"
                value={entries.filter((e) => e.status === "completed").length}
                icon={<Trophy className="w-4 h-4" />}
                testId="stat-completed"
              />
            </section>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Status Breakdown */}
              <section
                aria-label="By status"
                className="flex flex-col gap-4 p-5 border border-border/30 bg-card/30"
              >
                <h2 className="text-muted-foreground font-sans text-[11px] font-semibold tracking-[0.1em] uppercase">
                  By status
                </h2>
                <BarChart
                  data={byStatus.map((item) => ({
                    label: item.label,
                    value: item.count,
                  }))}
                  color="var(--foreground)"
                />
              </section>

              {/* Media Type Donut */}
              <section
                aria-label="By media type"
                className="flex flex-col gap-4 p-5 border border-border/30 bg-card/30"
              >
                <h2 className="text-muted-foreground font-sans text-[11px] font-semibold tracking-[0.1em] uppercase">
                  By media type
                </h2>
                <div className="flex items-center justify-center gap-6 py-2">
                  <DonutChart
                    data={donutData}
                    size={140}
                    strokeWidth={20}
                    centerValue={entries.length}
                    centerLabel="Total"
                  />
                  <DonutLegend data={donutData} />
                </div>
              </section>
            </div>

            {/* Highest Rated */}
            {bestRated && bestRated.length > 0 && (
              <section
                aria-label="Highest rated"
                className="flex flex-col gap-4 p-5 border border-amber-500/30 bg-amber-500/5"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h2 className="text-muted-foreground font-sans text-[11px] font-semibold tracking-[0.1em] uppercase">
                    Highest rated
                  </h2>
                  {ratings.length && (
                    <span className="text-amber-500 font-serif text-sm font-bold">
                      {Math.max(...ratings)}/10
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {bestRated.map((title) => (
                    <span
                      key={title}
                      className="font-serif border border-amber-500/40 px-3 py-1.5 text-sm font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    >
                      ★ {title}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </AppLayout>
  );
}
