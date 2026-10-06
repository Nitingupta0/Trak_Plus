"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { CheckSquare, Square, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EpisodeRowItem } from "@/components/titles/episode-row";
import { toast } from "@/components/ui/toast";
import { bff, publicApi, queries } from "@/lib/client/api";
import type { EpisodeRow, LibraryStatus } from "@/lib/types";

interface ProgressTrackerProps {
  source: string;
  externalId: string;
  internalTitleId: string | null;
  isEpisodeMedia: boolean;
  /** Needed by the sync endpoint for TMDB (movie vs tv season fetches). */
  mediaType?: string;
}

function useEpisodes(source: string, externalId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["episodes", source, externalId],
    queryFn: () => publicApi<EpisodeRow[]>(`/titles/${source}/${externalId}/episodes`),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function ProgressTracker({
  source,
  externalId,
  internalTitleId,
  isEpisodeMedia,
  mediaType,
}: ProgressTrackerProps) {
  const queryClient = useQueryClient();
  const [synced, setSynced] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  const episodes = useEpisodes(source, externalId, isEpisodeMedia);

  // Group episodes by season
  const seasons = useMemo(() => {
    const grouped = new Map<number, EpisodeRow[]>();
    for (const ep of episodes.data ?? []) {
      const list = grouped.get(ep.season) ?? [];
      list.push(ep);
      grouped.set(ep.season, list);
    }
    // Sort seasons ascending and episodes within each season
    const sorted = new Map<number, EpisodeRow[]>();
    for (const [season, eps] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
      sorted.set(season, eps.sort((a, b) => a.number - b.number));
    }
    return sorted;
  }, [episodes.data]);

  // Update selected season when data loads (only on initial load or when seasons change)
  const initializedSeasonRef = useRef(false);
  useEffect(() => {
    if (seasons.size > 0 && !initializedSeasonRef.current) {
      setSelectedSeason([...seasons.keys()][0]);
      initializedSeasonRef.current = true;
    }
  }, [seasons]);

  const sync = useMutation({
    mutationFn: () => queries.syncEpisodes(source, externalId, mediaType),
    onSuccess: (result) => {
      setSynced(true);
      queryClient.invalidateQueries({ queryKey: ["episodes", source, externalId] });
      toast.add({
        title: "Episodes loaded",
        description:
          result.message ?? `${result.total} episode${result.total === 1 ? "" : "s"} available.`,
        type: "success",
      });
    },
    onError: (error: Error) => {
      toast.add({ title: "Sync failed", description: error.message, type: "error" });
    },
  });

  // Find the user's library entry for this title to load progress.
  const { data: library } = useQuery({ queryKey: ["library"], queryFn: queries.library, retry: false });
  const entry = library?.find((candidate) => candidate.title.id === internalTitleId);

  const { data: progress } = useQuery({
    queryKey: ["progress", entry?.id],
    queryFn: () => queries.progress(entry!.id),
    enabled: Boolean(entry) && isEpisodeMedia,
  });

  // Auto-complete all episodes when status changes to "completed"
  const prevStatusRef = useRef<LibraryStatus | null>(null);
  useEffect(() => {
    if (!entry || !isEpisodeMedia || !episodes.data?.length) return;

    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = entry.status;

    // Only trigger when status CHANGES to completed (not on initial load)
    if (entry.status === "completed" && prevStatus && prevStatus !== "completed") {
      // Check if not all episodes are already watched
      const watchedSet = new Set(progress?.watched_episode_ids ?? []);
      const unwatchedEpisodes = episodes.data.filter((ep) => !watchedSet.has(ep.id));

      if (unwatchedEpisodes.length > 0) {
        // Mark all episodes as watched
        Promise.all(
          unwatchedEpisodes.map((ep) =>
            bff(`library/${entry.id}/progress/${ep.id}`, { method: "POST" }),
          ),
        ).then(() => {
          queryClient.invalidateQueries({ queryKey: ["progress", entry.id] });
          queryClient.invalidateQueries({ queryKey: ["library"] });
          toast.add({
            title: "All episodes marked as watched",
            description: `Status changed to completed — ${unwatchedEpisodes.length} episode(s) updated.`,
            type: "success",
          });
        });
      }
    }
  }, [entry?.status, entry, isEpisodeMedia, episodes.data, progress, queryClient]);

  const toggle = useMutation({
    mutationFn: async ({ episodeId, watched }: { episodeId: string; watched: boolean }) => {
      if (!entry) throw new Error("add this title to your library first");
      const path = `library/${entry.id}/progress/${episodeId}`;
      return bff(path, { method: watched ? "POST" : "DELETE" });
    },
    onSuccess: (summary) => {
      queryClient.setQueryData(["progress", entry?.id], summary);
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (error: Error) => {
      if (error.message === "not authenticated") return;
      toast.add({ title: "Progress update failed", description: error.message, type: "error" });
    },
  });

  // Batch toggle all episodes in a season
  const toggleSeason = useMutation({
    mutationFn: async ({ season, watched }: { season: number; watched: boolean }) => {
      if (!entry) throw new Error("add this title to your library first");
      const seasonEpisodes = seasons.get(season) ?? [];
      await Promise.all(
        seasonEpisodes.map((ep) =>
          bff(`library/${entry.id}/progress/${ep.id}`, { method: watched ? "POST" : "DELETE" }),
        ),
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["progress", entry?.id] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
      toast.add({
        title: variables.watched ? "Season marked as watched" : "Season marked as unwatched",
        type: "success",
      });
    },
    onError: (error: Error) => {
      if (error.message === "not authenticated") return;
      toast.add({ title: "Update failed", description: error.message, type: "error" });
    },
  });

  if (!isEpisodeMedia) return null;

  const loading = sync.isPending || episodes.isPending;
  const notFound = episodes.isError && !synced;
  const watchedSet = new Set(progress?.watched_episode_ids ?? []);
  const total = episodes.data?.length ?? progress?.total_episodes ?? 0;
  const watched = watchedSet.size;

  // Get episodes for selected season
  const seasonEpisodes = seasons.get(selectedSeason) ?? [];
  const seasonWatchedCount = seasonEpisodes.filter((ep) => watchedSet.has(ep.id)).length;
  const allSeasonWatched = seasonEpisodes.length > 0 && seasonWatchedCount === seasonEpisodes.length;
  const someSeasonWatched = seasonWatchedCount > 0 && !allSeasonWatched;

  return (
    <section aria-label="Progress tracker" className="flex flex-col gap-3" data-testid="progress-tracker">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h2 className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Progress</h2>
        {total > 0 ? (
          <span className="text-foreground font-mono text-[10px] font-medium tracking-widest uppercase" data-testid="progress-count">
            {watched} / {total}
          </span>
        ) : null}
      </div>
      <Progress value={total > 0 ? (watched / total) * 100 : 0} />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-none" />
          ))}
        </div>
      ) : notFound || (episodes.data ?? []).length === 0 ? (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            data-testid="sync-episodes"
          >
            {sync.isPending ? "Loading…" : "Load episode list"}
          </Button>
          <span className="text-muted-foreground text-xs" data-testid="sync-hint">
            {synced && (episodes.data ?? []).length === 0
              ? "No chapter/episode data available for this title at its source."
              : sync.isError
                ? `${sync.error.message} — try again.`
                : "Fetches episodes/chapters from the source, then track them here."}
          </span>
        </div>
      ) : !entry ? (
        <p className="text-muted-foreground text-sm">
          Add this title to your library to track progress.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Season Selector */}
          {seasons.size > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground font-sans text-[10px] uppercase tracking-wider">
                Season
              </span>
              <div className="relative">
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                  className="appearance-none bg-popover border border-border/60 px-3 py-1.5 pr-8 text-[11px] font-sans font-bold uppercase tracking-wider text-foreground outline-none cursor-pointer hover:border-foreground/60 transition-colors"
                >
                  {[...seasons.keys()].map((season) => (
                    <option key={season} value={season}>
                      Season {season}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* Watch All Checkbox */}
          {seasonEpisodes.length > 0 && (
            <button
              onClick={() => toggleSeason.mutate({ season: selectedSeason, watched: !allSeasonWatched })}
              disabled={toggleSeason.isPending}
              className={`flex items-center gap-2 px-3 py-2 border transition-all ${
                allSeasonWatched
                  ? "border-green-500/40 bg-green-500/10 text-green-600"
                  : "border-border/40 text-muted-foreground hover:border-border/60 hover:text-foreground"
              }`}
            >
              {allSeasonWatched ? (
                <CheckSquare className="w-4 h-4" />
              ) : someSeasonWatched ? (
                <CheckSquare className="w-4 h-4 opacity-50" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider">
                {allSeasonWatched ? "Watched" : "Watch all in this season"}
              </span>
              <span className="ml-auto text-[10px] font-mono">
                {seasonWatchedCount}/{seasonEpisodes.length}
              </span>
            </button>
          )}

          {/* Episode List */}
          <ol className="divide-y divide-border border-y border-border">
            {seasonEpisodes.map((episode) => (
              <EpisodeRowItem
                key={episode.id}
                number={episode.number}
                season={episode.season}
                name={episode.name}
                airDate={episode.air_date}
                description={episode.description}
                thumbnailUrl={episode.thumbnail_url}
                watched={watchedSet.has(episode.id)}
                onToggle={(nextWatched) =>
                  toggle.mutate({ episodeId: episode.id, watched: nextWatched })
                }
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
