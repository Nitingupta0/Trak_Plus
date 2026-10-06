import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { animate } from "animejs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusSelector } from "@/components/library/status-selector";
import { toast } from "@/components/ui/toast";
import { bff, proxiedImageUrl } from "@/lib/client/api";
import {
  MEDIA_TYPE_LABELS,
  type LibraryEntry,
  type LibraryStatus,
} from "@/lib/types";

interface EntryCardProps {
  entry: LibraryEntry;
  allowedStatuses: LibraryStatus[];
}

export function EntryCard({ entry, allowedStatuses }: EntryCardProps) {
  const queryClient = useQueryClient();
  const posterRef = React.useRef<HTMLImageElement>(null);
  const bgRef = React.useRef<HTMLDivElement>(null);

  const update = useMutation({
    mutationFn: (nextStatus: LibraryStatus) =>
      bff<LibraryEntry>(`/library/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      }),
    onMutate: async (nextStatus) => {
      await queryClient.cancelQueries({ queryKey: ["library"] });
      const previous = queryClient.getQueryData<LibraryEntry[]>(["library"]);
      queryClient.setQueryData<LibraryEntry[]>(["library"], (current) =>
        current?.map((candidate) =>
          candidate.id === entry.id ? { ...candidate, status: nextStatus } : candidate,
        ),
      );
      return { previous };
    },
    onError: (error: Error, _status, context) => {
      queryClient.setQueryData(["library"], context?.previous);
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
      queryClient.setQueryData<LibraryEntry[]>(["library"], (current) =>
        current?.filter((candidate) => candidate.id !== entry.id),
      );
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      queryClient.setQueryData(["library"], context?.previous);
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

  const handleMouseEnter = () => {
    if (posterRef.current) {
      animate(posterRef.current, {
        scale: 1.07,
        duration: 800,
        ease: "outExpo",
      });
    }
    if (bgRef.current) {
      animate(bgRef.current, {
        opacity: 1,
        duration: 600,
        ease: "outSine",
      });
    }
  };

  const handleMouseLeave = () => {
    if (posterRef.current) {
      animate(posterRef.current, {
        scale: 1,
        duration: 600,
        ease: "outSine",
      });
    }
    if (bgRef.current) {
      animate(bgRef.current, {
        opacity: 0,
        duration: 400,
        ease: "outSine",
      });
    }
  };

  return (
    <div 
      className="group relative flex gap-6 p-4 hairline-b transition-colors"
      data-testid="library-entry"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Animated hover background */}
      <div ref={bgRef} className="absolute inset-0 bg-foreground/[0.02] opacity-0 pointer-events-none" />

      {/* Poster Column */}
      <div className="relative z-10 w-24 shrink-0 overflow-hidden aspect-[2/3] border border-foreground/10 bg-muted/30">
        {detailHref ? (
          <Link href={detailHref} className="block size-full relative">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={posterRef}
                src={poster}
                alt={entry.title.title}
                className="absolute inset-0 size-full object-cover transition-opacity duration-300"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xl text-muted-foreground font-serif">
                {entry.title.title.charAt(0)}
              </div>
            )}
            {/* Subtle inner shadow for depth */}
            <div className="absolute inset-0 shadow-[inset_0_0_0_1px_var(--color-foreground)] opacity-5 pointer-events-none" />
          </Link>
        ) : null}
      </div>

      {/* Details Column */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between py-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <Badge variant="outline">
              {MEDIA_TYPE_LABELS[entry.title.media_type]}
            </Badge>
            <div className="text-foreground/60 text-[11px] font-sans font-semibold tracking-[0.08em] uppercase leading-none">
              {entry.rating != null ? `★ ${entry.rating}/10` : "UNRATED"}
            </div>
          </div>
          
          {detailHref ? (
            <Link href={detailHref} className="block truncate text-2xl font-serif text-balance tracking-tight group-hover:underline decoration-1 underline-offset-4 decoration-foreground/30">
              {entry.title.title}
            </Link>
          ) : (
            <div className="truncate text-2xl font-serif text-balance tracking-tight">
              {entry.title.title}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto">
          <StatusSelector
            value={entry.status}
            options={allowedStatuses}
            onChange={(nextStatus) => update.mutate(nextStatus)}
            testId={`entry-status-${entry.id}`}
          />
          
          <Button
            variant="ghost"
            size="xs"
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            onClick={() => remove.mutate()}
            data-testid="remove-entry"
            aria-label={`Remove ${entry.title.title}`}
          >
            REMOVE
          </Button>
        </div>
      </div>
    </div>
  );
}
