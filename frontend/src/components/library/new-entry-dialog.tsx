"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusSelector } from "@/components/library/status-selector";
import { queries, proxiedImageUrl } from "@/lib/client/api";
import { MEDIA_TYPE_LABELS, type MediaType, type SearchItem } from "@/lib/types";

/** Per-media-type statuses (mirrors AddToLibrary / library page). */
function statusesFor(mediaType: MediaType) {
  switch (mediaType) {
    case "movie":
    case "tv":
    case "anime":
      return ["watching", "plan_to", "completed", "dropped", "on_hold"] as const;
    case "game":
      return ["playing", "plan_to", "completed", "dropped", "on_hold"] as const;
    case "manga":
      return ["reading", "plan_to", "completed", "dropped", "on_hold"] as const;
  }
}

/**
 * "New entry" dialog: search across sources, pick a title + status, jump to
 * the detail page to confirm. The detail page owns the actual library POST —
 * this modal is the discovery shortcut.
 */
export function NewEntryDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchItem | null>(null);
  const [status, setStatus] = useState<string>("watching");

  const { data, isPending } = useQuery({
    queryKey: ["search", query],
    queryFn: () => queries.search(query),
    enabled: open && query.length > 1,
    staleTime: 60_000,
  });

  function reset() {
    setQuery("");
    setSelected(null);
    setStatus("watching");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" data-testid="new-entry-button">
            + New entry
          </Button>
        }
      />
      <DialogContent className="max-w-lg rounded-none" data-testid="new-entry-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-bold">New entry</DialogTitle>
          <DialogDescription>
            Search any source, pick a status, then confirm on the title page.
          </DialogDescription>
        </DialogHeader>

        <Input
          aria-label="Search titles"
          placeholder="Search movies, TV, games, anime, manga…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          data-testid="new-entry-search"
          autoFocus
        />

        <div className="flex max-h-80 flex-col divide-y overflow-y-auto border-y">
          {isPending ? (
            <p className="text-muted-foreground py-4 text-center text-sm">Searching…</p>
          ) : query.length <= 1 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Type at least two characters.
            </p>
          ) : (data?.results ?? []).length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">No results.</p>
          ) : (
            (data?.results ?? []).map((item) => {
              const poster = proxiedImageUrl(item.poster_url);
              const isSelected = selected?.source === item.source && selected?.source_id === item.source_id;
              return (
                <button
                  key={`${item.source}-${item.source_id}`}
                  type="button"
                  onClick={() => {
                    setSelected(item);
                    setStatus(statusesFor(item.media_type)[0]);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted ${
                    isSelected ? "bg-muted" : ""
                  }`}
                  data-testid={`new-entry-option-${item.source}-${item.source_id}`}
                >
                  <div className="bg-muted relative h-14 w-10 shrink-0 overflow-hidden rounded-none border">
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={poster}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-muted-foreground absolute inset-0 flex items-center justify-center">
                        🎬
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium font-serif">{item.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {item.year ?? "—"} · {MEDIA_TYPE_LABELS[item.media_type]}
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase">
                    {item.source}
                  </Badge>
                </button>
              );
            })
          )}
        </div>

        {selected ? (
          <div className="flex flex-col gap-3">
            <StatusSelector
              value={status as LibraryStatusLike}
              options={[...statusesFor(selected.media_type)]}
              onChange={(next) => setStatus(next)}
              testId="new-entry-status"
            />
            <Button
              onClick={() => {
                setOpen(false);
                router.push(
                  `/titles/${selected.source}/${encodeURIComponent(selected.source_id)}?media_type=${selected.media_type}`,
                );
              }}
              data-testid="new-entry-continue"
            >
              Continue to “{selected.title.slice(0, 30)}
              {selected.title.length > 30 ? "…" : ""}”
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type LibraryStatusLike = Parameters<typeof StatusSelector>[0]["value"];
