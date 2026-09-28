"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { toast } from "@/components/ui/toast";
import { bff, proxiedImageUrl, queries } from "@/lib/client/api";
import {
  MEDIA_TYPE_LABELS,
  STATUS_LABELS,
  type LibraryEntry,
  type LibraryStatus,
  type MediaType,
} from "@/lib/types";

/** Check if media type is episode-based (has seasons/episodes) */
function isEpisodeMedia(mediaType: MediaType): boolean {
  return mediaType === "tv" || mediaType === "anime";
}

/** Format minutes into readable format (e.g., "24h 30m", "45m") */
function formatPlaytime(minutes: number | null): string {
  if (minutes == null || minutes === 0) return "Not tracked";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

interface LibraryCardProps {
  entry: LibraryEntry;
  allowedStatuses: LibraryStatus[];
  cardIndex?: number;
}

/* ── Status Theme Configuration: Color, Border & Glow ── */
export const STATUS_THEME: Record<
  LibraryStatus,
  {
    name: string;
    color: string;
    bg: string;
    border: string;
    dot: string;
  }
> = {
  watching: {
    name: "Watching",
    color: "oklch(0.74 0.15 65)",
    bg: "oklch(0.74 0.15 65 / 0.12)",
    border: "oklch(0.74 0.15 65 / 0.35)",
    dot: "#f59e0b",
  },
  playing: {
    name: "Playing",
    color: "oklch(0.74 0.15 65)",
    bg: "oklch(0.74 0.15 65 / 0.12)",
    border: "oklch(0.74 0.15 65 / 0.35)",
    dot: "#f59e0b",
  },
  reading: {
    name: "Reading",
    color: "oklch(0.74 0.15 65)",
    bg: "oklch(0.74 0.15 65 / 0.12)",
    border: "oklch(0.74 0.15 65 / 0.35)",
    dot: "#f59e0b",
  },
  plan_to: {
    name: "Plan to",
    color: "oklch(0.68 0.13 250)",
    bg: "oklch(0.68 0.13 250 / 0.12)",
    border: "oklch(0.68 0.13 250 / 0.35)",
    dot: "#3b82f6",
  },
  completed: {
    name: "Completed",
    color: "oklch(0.68 0.14 155)",
    bg: "oklch(0.68 0.14 155 / 0.12)",
    border: "oklch(0.68 0.14 155 / 0.35)",
    dot: "#10b981",
  },
  on_hold: {
    name: "On Hold",
    color: "oklch(0.70 0.11 300)",
    bg: "oklch(0.70 0.11 300 / 0.12)",
    border: "oklch(0.70 0.11 300 / 0.35)",
    dot: "#a855f7",
  },
  dropped: {
    name: "Dropped",
    color: "oklch(0.66 0.15 25)",
    bg: "oklch(0.66 0.15 25 / 0.12)",
    border: "oklch(0.66 0.15 25 / 0.35)",
    dot: "#ef4444",
  },
};

export function LibraryCard({ entry, allowedStatuses, cardIndex = 0 }: LibraryCardProps) {
  const queryClient = useQueryClient();
  const theme = STATUS_THEME[entry.status] || STATUS_THEME.watching;

  /* ── Status mutations ── */
  const update = useMutation({
    mutationFn: (nextStatus: LibraryStatus) =>
      bff<LibraryEntry>(`/library/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      }),
    onMutate: async (nextStatus) => {
      await queryClient.cancelQueries({ queryKey: ["library"] });
      const previous = queryClient.getQueryData<LibraryEntry[]>(["library"]);
      queryClient.setQueryData<LibraryEntry[]>(["library"], (c) =>
        c?.map((x) => (x.id === entry.id ? { ...x, status: nextStatus } : x)),
      );
      return { previous };
    },
    onError: (error: Error, _s, ctx) => {
      queryClient.setQueryData(["library"], ctx?.previous);
      if (error.message === "not authenticated") return;
      toast.add({ title: "Update failed", description: error.message, type: "error" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });

  const remove = useMutation({
    mutationFn: () => bff<void>(`/library/${entry.id}`, { method: "DELETE" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["library"] });
      const previous = queryClient.getQueryData<LibraryEntry[]>(["library"]);
      queryClient.setQueryData<LibraryEntry[]>(["library"], (c) =>
        c?.filter((x) => x.id !== entry.id),
      );
      return { previous };
    },
    onError: (error: Error, _v, ctx) => {
      queryClient.setQueryData(["library"], ctx?.previous);
      if (error.message === "not authenticated") return;
      toast.add({ title: "Remove failed", description: error.message, type: "error" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });

  const detailHref =
    entry.title.source && entry.title.source_id
      ? `/titles/${entry.title.source}/${encodeURIComponent(entry.title.source_id)}?media_type=${entry.title.media_type}`
      : null;
  const poster = proxiedImageUrl(entry.title.poster_url);

  // Fetch progress for episode-based media
  const { data: progress } = useQuery({
    queryKey: ["progress", entry.id],
    queryFn: () => queries.progress(entry.id),
    enabled: isEpisodeMedia(entry.title.media_type),
    staleTime: 30_000,
  });

  return (
    <div
      className="group relative flex flex-col transition-all duration-300 ease-out animate-slide-up"
      style={{ animationDelay: `${Math.min(cardIndex * 35, 400)}ms` }}
      data-testid="library-entry"
    >
      {/* ── Poster Card with Smooth Amazon-style Lift & Sheen ── */}
      <div
        className="relative w-full aspect-[2/3] overflow-hidden border border-foreground/10 bg-muted/40 transition-all duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-xl group-hover:border-foreground/25"
        style={{
          boxShadow: "0 2px 8px -2px rgba(0,0,0,0.08)",
        }}
      >
        {/* Poster Image or Placeholder */}
        {poster ? (
          detailHref ? (
            <Link href={detailHref} className="absolute inset-0 block size-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={poster}
                alt={entry.title.title}
                className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                loading="lazy"
              />
            </Link>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={entry.title.title}
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              loading="lazy"
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center font-serif text-3xl text-muted-foreground/30">
            {entry.title.title.charAt(0)}
          </div>
        )}

        {/* Diagonal Sheen Effect on Hover */}
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden">
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12" />
        </div>

        {/* Top Badges Bar: Rating (Left) + Status (Right) */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none z-20">
          {/* Single Unified Rating Pill */}
          {entry.rating != null ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-black/70 backdrop-blur-md border border-white/15 text-[11px] font-serif font-bold text-amber-300 shadow-sm">
              <span>★</span>
              <span>{entry.rating}</span>
            </div>
          ) : (
            <div />
          )}

          {/* Color-Coded Status Pill */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 backdrop-blur-md text-[9px] font-sans font-bold uppercase tracking-[0.12em] shadow-sm"
            style={{
              backgroundColor: "rgba(18, 17, 16, 0.8)",
              borderColor: theme.border,
              borderWidth: "1px",
              color: theme.color,
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: theme.dot }}
            />
            {theme.name}
          </div>
        </div>

        {/* Floating Quick Action Glass Bar on Hover */}
        <div className="absolute inset-x-0 bottom-0 p-2 z-20 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 ease-out pointer-events-auto bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <div className="flex items-center justify-between gap-1.5 bg-black/80 backdrop-blur-md border border-white/20 px-2 py-1.5 shadow-lg">
            {/* Sleek Compact Status Dropdown */}
            <div className="relative flex-1 min-w-0 flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: theme.dot }}
              />
              <select
                value={entry.status}
                onChange={(e) => update.mutate(e.target.value as LibraryStatus)}
                data-testid={`entry-status-${entry.id}`}
                className="w-full bg-transparent text-white text-[10px] font-sans font-bold uppercase tracking-wider outline-none cursor-pointer py-0.5 appearance-none pr-4"
                style={{ color: theme.color, colorScheme: "dark" }}
              >
                {allowedStatuses.map((opt) => (
                  <option
                    key={opt}
                    value={opt}
                    className="bg-[#1a1918] text-white py-1.5 text-xs font-sans"
                  >
                    {STATUS_LABELS[opt]}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-0 text-[10px] text-white/50">
                ▾
              </span>
            </div>

            <div className="h-3 w-px bg-white/20" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                remove.mutate();
              }}
              className="flex items-center justify-center size-6 text-white/40 hover:text-red-400 transition-colors"
              title="Remove from library"
              data-testid="remove-entry"
              aria-label={`Remove ${entry.title.title}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Metadata below poster ── */}
      <div className="mt-2.5 flex flex-col gap-1 px-0.5">
        {detailHref ? (
          <Link
            href={detailHref}
            className="truncate font-serif text-[14px] font-bold tracking-tight text-foreground transition-colors group-hover:text-primary hover:underline decoration-1 underline-offset-2"
          >
            {entry.title.title}
          </Link>
        ) : (
          <span className="truncate font-serif text-[14px] font-bold tracking-tight text-foreground">
            {entry.title.title}
          </span>
        )}

        <div className="flex items-center justify-between text-[10px] font-sans font-semibold text-foreground/70">
          <span className="uppercase tracking-wider">
            {MEDIA_TYPE_LABELS[entry.title.media_type]}
            {entry.title.release_date
              ? ` · ${entry.title.release_date.slice(0, 4)}`
              : ""}
          </span>

          <span
            className="font-semibold uppercase tracking-wider"
            style={{ color: theme.color }}
          >
            {STATUS_LABELS[entry.status]}
          </span>
        </div>

        {/* Progress bar for episode-based media */}
        {isEpisodeMedia(entry.title.media_type) && progress && progress.total_episodes != null && (
          <div className="mt-1.5 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
              <span>Progress</span>
              <span>
                {progress.watched_count}/{progress.total_episodes}
              </span>
            </div>
            <div className="h-1 bg-muted/40 overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{
                  width: `${progress.total_episodes > 0 ? (progress.watched_count / progress.total_episodes) * 100 : 0}%`,
                  backgroundColor: theme.dot,
                }}
              />
            </div>
          </div>
        )}

        {/* Playtime display for games */}
        {entry.title.media_type === "game" && entry.playtime_minutes != null && entry.playtime_minutes > 0 && (
          <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
            <span>Playtime</span>
            <span className="font-bold" style={{ color: theme.color }}>
              {formatPlaytime(entry.playtime_minutes)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
