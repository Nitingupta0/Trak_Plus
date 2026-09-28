"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { EntryCard } from "@/components/library/entry-card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { queries } from "@/lib/client/api";
import {
  MEDIA_TYPE_LABELS,
  STATUS_LABELS,
  type LibraryStatus,
  type MediaType,
} from "@/lib/types";

const ALL_MEDIA_TYPES: MediaType[] = ["movie", "tv", "game", "anime", "manga"];

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-none border px-2.5 py-1 font-mono text-xs uppercase tracking-widest transition-colors ${
        active
          ? "border-ring bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** Directory — every library entry on one page with category/status filters. */
export default function DirectoryPage() {
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

  const [mediaFilter, setMediaFilter] = useState<MediaType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<LibraryStatus | "all">("all");
  const [query, setQuery] = useState("");

  const entries = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (mediaFilter !== "all" && entry.title.media_type !== mediaFilter) return false;
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (q && !entry.title.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, mediaFilter, statusFilter, query]);

  /** Only statuses that actually exist among the entries (keeps the filter row compact). */
  const statusesPresent = useMemo(() => {
    const present = new Set<LibraryStatus>(entries.map((entry) => entry.status));
    return (Object.keys(STATUS_LABELS) as LibraryStatus[]).filter((s) => present.has(s));
  }, [entries]);

  return (
    <AppLayout>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-8 py-10" data-testid="directory-page">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-serif text-2xl font-bold tracking-tight">Directory</h1>
          <div className="text-muted-foreground text-sm">
            {filtered.length} of {entries.length} titles
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="search"
            aria-label="Filter by title"
            placeholder="Filter by title…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="border-input bg-background w-full rounded-none border px-3 py-2 text-sm outline-none focus-visible:border-ring"
            data-testid="directory-filter-title"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={mediaFilter === "all"} onClick={() => setMediaFilter("all")}>
              All types
            </FilterChip>
            {ALL_MEDIA_TYPES.map((type) => (
              <FilterChip
                key={type}
                active={mediaFilter === type}
                onClick={() => setMediaFilter(type)}
              >
                {MEDIA_TYPE_LABELS[type]}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
              All statuses
            </FilterChip>
            {statusesPresent.map((status) => (
              <FilterChip
                key={status}
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {STATUS_LABELS[status]}
              </FilterChip>
            ))}
          </div>
        </div>

        {isPending ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-none" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nothing to browse yet</EmptyTitle>
              <EmptyDescription>
                <Link href="/search" className="underline">
                  Search
                </Link>{" "}
                for a title and add it to your library first.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No matches</EmptyTitle>
              <EmptyDescription>Loosen the filters above.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                allowedStatuses={statusesFor(entry.title.media_type)}
              />
            ))}
          </div>
        )}
      </main>
    </AppLayout>
  );
}

/** Mirrors AddToLibrary: statuses relevant per media type. */
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
