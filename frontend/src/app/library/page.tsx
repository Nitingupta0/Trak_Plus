"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, useMemo } from "react";
import { animate, stagger } from "animejs";
import { ArrowUpDown } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { LibraryCard, STATUS_THEME } from "@/components/library/library-card";
import { ImportExportToolbar } from "@/components/library/import-export-toolbar";
import { NewEntryDialog } from "@/components/library/new-entry-dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { PageTransition } from "@/components/ui/page-transition";
import { queries } from "@/lib/client/api";
import {
  STATUS_LABELS,
  MEDIA_TYPE_LABELS,
  type LibraryEntry,
  type LibraryStatus,
  type MediaType,
} from "@/lib/types";

/* ── Status ordering ── */
const STATUS_ORDER: LibraryStatus[] = [
  "watching",
  "playing",
  "reading",
  "plan_to",
  "completed",
  "on_hold",
  "dropped",
];

const MEDIA_TYPES: Array<MediaType | "all"> = [
  "all",
  "movie",
  "tv",
  "game",
  "anime",
  "manga",
];

type SortMode = "recent" | "rating-desc" | "title-asc";

function statusesFor(mediaType: MediaType): LibraryStatus[] {
  switch (mediaType) {
    case "movie":
    case "tv":
    case "anime":
      return ["watching", "plan_to", "completed", "dropped", "on_hold"];
    case "game":
      return ["playing", "plan_to", "completed", "dropped", "on_hold"];
    case "manga":
      return ["reading", "plan_to", "completed", "dropped", "on_hold"];
  }
}

/* ── Animated numerical count ── */
function AnimatedCount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current || !ref.current || value === 0) return;
    mounted.current = true;
    const el = ref.current;
    animate(
      { v: 0 },
      {
        v: value,
        duration: 700,
        ease: "outQuad",
        onUpdate(anim) {
          el.textContent = String(Math.round((anim.targets[0] as { v: number }).v));
        },
      },
    );
  }, [value]);

  return <span ref={ref}>{value}</span>;
}

/* ── Skeleton Loading Grid ── */
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mt-8">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2.5 animate-pulse">
          <div className="aspect-[2/3] w-full bg-muted/40" />
          <div className="h-3.5 w-3/4 bg-muted/35" />
          <div className="h-2.5 w-1/2 bg-muted/25" />
        </div>
      ))}
    </div>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["library"],
    queryFn: queries.library,
    retry: false,
  });

  const [activeStatus, setActiveStatus] = useState<LibraryStatus | "all">("all");
  const [activeMedia, setActiveMedia] = useState<MediaType | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isError && error.message === "not authenticated") {
      router.replace("/login");
    }
  }, [isError, error, router]);

  const rawEntries = data ?? [];

  /* ── Filtered and sorted entries ── */
  const filteredEntries = useMemo(() => {
    let result = [...rawEntries];

    // Filter by media type
    if (activeMedia !== "all") {
      result = result.filter((e) => e.title.media_type === activeMedia);
    }

    // Filter by status
    if (activeStatus !== "all") {
      result = result.filter((e) => e.status === activeStatus);
    }

    // Sort
    if (sortMode === "rating-desc") {
      result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sortMode === "title-asc") {
      result.sort((a, b) => a.title.title.localeCompare(b.title.title));
    }

    return result;
  }, [rawEntries, activeMedia, activeStatus, sortMode]);

  /* Counts per status (under current media filter) */
  const statusCounts = useMemo(() => {
    const counts = new Map<LibraryStatus, number>();
    for (const s of STATUS_ORDER) counts.set(s, 0);
    for (const e of rawEntries) {
      if (activeMedia === "all" || e.title.media_type === activeMedia) {
        counts.set(e.status, (counts.get(e.status) ?? 0) + 1);
      }
    }
    return counts;
  }, [rawEntries, activeMedia]);

  /* Media type counts */
  const mediaCounts = useMemo(() => {
    const counts = new Map<MediaType, number>();
    for (const e of rawEntries) {
      counts.set(e.title.media_type, (counts.get(e.title.media_type) ?? 0) + 1);
    }
    return counts;
  }, [rawEntries]);

  /* Animate filter pills on mount */
  useEffect(() => {
    if (!headerRef.current) return;
    const chips = headerRef.current.querySelectorAll("[data-chip]");
    if (!chips.length) return;
    animate(chips, {
      opacity: [0, 1],
      translateY: [6, 0],
      duration: 300,
      delay: stagger(25, { start: 150 }),
      ease: "outExpo",
    });
  }, [rawEntries.length]);

  return (
    <AppLayout>
      <PageTransition>
        <main
          className="page-gutter flex flex-col gap-6 py-8"
          data-testid="library-page"
        >
          {/* ── Page Header ── */}
          <header
            ref={headerRef}
            className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-border/40"
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-3">
                <h1 className="font-serif text-3xl font-bold tracking-tight leading-none text-foreground">
                  Library
                </h1>
                <span className="font-mono text-xs text-muted-foreground/80 tracking-wide">
                  <AnimatedCount value={rawEntries.length} /> TOTAL ITEMS
                </span>
              </div>
              <p className="font-sans text-xs text-muted-foreground/90">
                Your personal media archive ·{" "}
                <Link
                  href="/search"
                  className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid transition-colors"
                >
                  + Add new title
                </Link>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <ImportExportToolbar />
              <NewEntryDialog />
            </div>
          </header>

          {isPending ? (
            <SkeletonGrid />
          ) : rawEntries.length === 0 ? (
            /* ── Empty State ── */
            <div className="mt-20 animate-slide-up">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Your library is empty</EmptyTitle>
                  <EmptyDescription>
                    Search for a movie, show, game, or manga and add it to start tracking.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <>
              {/* ── Filter Controls Row ── */}
              <div className="flex flex-col gap-4 pb-4 border-b border-border/30">
                {/* Format Filter Bar (Like Amazon/Steam Categories) */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {MEDIA_TYPES.map((type) => {
                      const count =
                        type === "all"
                          ? rawEntries.length
                          : mediaCounts.get(type) ?? 0;
                      if (type !== "all" && count === 0) return null;
                      const active = activeMedia === type;
                      return (
                        <button
                          key={type}
                          onClick={() => setActiveMedia(type)}
                          className={`px-3 py-1 text-[11px] font-sans font-semibold tracking-wider uppercase transition-all duration-200 border ${
                            active
                              ? "bg-foreground text-background border-foreground shadow-sm"
                              : "bg-transparent text-muted-foreground border-border/50 hover:border-foreground/40 hover:text-foreground"
                          }`}
                        >
                          {type === "all" ? "All Formats" : MEDIA_TYPE_LABELS[type]}
                          <span className="ml-1.5 opacity-60 font-mono text-[10px]">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sort Selector */}
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="size-3.5 text-foreground/70" />
                    <select
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as SortMode)}
                      className="bg-popover border border-border/80 px-2.5 py-1 text-[11px] font-sans font-bold uppercase tracking-wider text-foreground outline-none cursor-pointer hover:border-foreground/60 transition-colors shadow-sm"
                      style={{ colorScheme: "dark light" }}
                    >
                      <option value="recent" className="bg-popover text-popover-foreground py-1.5 font-sans">
                        Recently Added
                      </option>
                      <option value="rating-desc" className="bg-popover text-popover-foreground py-1.5 font-sans">
                        Rating: High to Low
                      </option>
                      <option value="title-asc" className="bg-popover text-popover-foreground py-1.5 font-sans">
                        Title: A to Z
                      </option>
                    </select>
                  </div>
                </div>

                {/* Status Filter Chips with Dedicated Colors */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => setActiveStatus("all")}
                    className={`px-3 py-1 text-[10px] font-sans font-bold uppercase tracking-[0.14em] transition-all border ${
                      activeStatus === "all"
                        ? "bg-foreground/10 border-foreground text-foreground"
                        : "border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    }`}
                  >
                    All Statuses
                    <span className="ml-1.5 font-mono text-[10px] opacity-70">
                      {
                        rawEntries.filter(
                          (e) =>
                            activeMedia === "all" ||
                            e.title.media_type === activeMedia,
                        ).length
                      }
                    </span>
                  </button>

                  {STATUS_ORDER.map((status) => {
                    const count = statusCounts.get(status) ?? 0;
                    if (count === 0 && activeStatus !== status) return null;
                    const theme = STATUS_THEME[status];
                    const active = activeStatus === status;

                    return (
                      <button
                        key={status}
                        onClick={() =>
                          setActiveStatus(active ? "all" : status)
                        }
                        className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-sans font-bold uppercase tracking-[0.12em] transition-all border"
                        style={{
                          borderColor: active ? theme.color : "oklch(0.74 0.012 88.7 / 0.25)",
                          backgroundColor: active ? theme.bg : "transparent",
                          color: active ? theme.color : "oklch(0.48 0.012 85)",
                        }}
                        data-testid={`filter-${status}`}
                      >
                        <span
                          className="size-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: theme.dot }}
                        />
                        {STATUS_LABELS[status]}
                        <span className="font-mono text-[10px] opacity-75 ml-0.5">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Active Filters Summary / Heading ── */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span className="font-sans font-semibold tracking-wider uppercase text-[10px] text-muted-foreground/80">
                  Showing {filteredEntries.length} title
                  {filteredEntries.length === 1 ? "" : "s"}
                  {activeMedia !== "all"
                    ? ` in ${MEDIA_TYPE_LABELS[activeMedia]}`
                    : ""}
                  {activeStatus !== "all"
                    ? ` · ${STATUS_LABELS[activeStatus]}`
                    : ""}
                </span>
              </div>

              {/* ── Poster Grid (Amazon / Letterboxd style) ── */}
              {filteredEntries.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  No titles match the selected filters.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-7">
                  {filteredEntries.map((entry, idx) => (
                    <LibraryCard
                      key={`${entry.id}-${activeStatus}-${activeMedia}`}
                      entry={entry}
                      allowedStatuses={statusesFor(entry.title.media_type)}
                      cardIndex={idx}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </PageTransition>
    </AppLayout>
  );
}
