import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { animate } from "animejs";

import { StatusSelector } from "@/components/library/status-selector";
import { toast } from "@/components/ui/toast";
import { bff, proxiedImageUrl } from "@/lib/client/api";
import {
  MEDIA_TYPE_LABELS,
  type LibraryEntry,
  type LibraryStatus,
} from "@/lib/types";

interface EntryRowProps {
  entry: LibraryEntry;
  allowedStatuses: LibraryStatus[];
  rowIndex?: number;
}

const COL = { gridTemplateColumns: "3rem 1fr 5rem 6rem 5rem" };

/** Archive-style table row with full animation suite */
export function EntryRow({ entry, allowedStatuses, rowIndex = 0 }: EntryRowProps) {
  const queryClient = useQueryClient();
  const [hovered, setHovered] = React.useState(false);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const scoreRef = React.useRef<HTMLSpanElement>(null);
  const barRef = React.useRef<HTMLDivElement>(null);
  const posterRef = React.useRef<HTMLImageElement>(null);
  const controlsRef = React.useRef<HTMLDivElement>(null);
  const typeRef = React.useRef<HTMLSpanElement>(null);
  const mounted = React.useRef(false);

  /* ── Stagger entrance on mount ── */
  React.useEffect(() => {
    if (mounted.current || !rowRef.current) return;
    mounted.current = true;

    animate(rowRef.current, {
      opacity: [0, 1],
      translateX: [-8, 0],
      duration: 420,
      delay: rowIndex * 45 + 60,
      ease: "outExpo",
    });

    // Score count-up
    if (entry.rating != null && scoreRef.current) {
      const target = entry.rating;
      const scoreEl = scoreRef.current;
      animate(
        { value: 0 },
        {
          value: target,
          duration: 700,
          delay: rowIndex * 45 + 200,
          ease: "outQuad",
          onUpdate(anim) {
            const v = parseFloat((anim.targets[0] as { value: number }).value.toFixed(1));
            scoreEl.textContent = v.toFixed(1);
          },
        },
      );
    }

    // Rating bar grow
    if (barRef.current && entry.rating != null) {
      animate(barRef.current, {
        scaleX: [0, entry.rating / 10],
        duration: 900,
        delay: rowIndex * 45 + 300,
        ease: "outExpo",
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Hover: poster tilt ── */
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!posterRef.current) return;
    const rect = posterRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = ((e.clientX - cx) / rect.width) * 6;
    const dy = ((e.clientY - cy) / rect.height) * -6;
    posterRef.current.style.transform = `perspective(200px) rotateY(${dx}deg) rotateX(${dy}deg) scale(1.04)`;
  };

  const handleMouseEnter = () => {
    setHovered(true);
    // Slide controls in from right
    if (controlsRef.current) {
      animate(controlsRef.current, {
        opacity: [0, 1],
        translateX: [8, 0],
        duration: 200,
        ease: "outSine",
      });
    }
    // Fade type label out
    if (typeRef.current) {
      animate(typeRef.current, {
        opacity: [1, 0],
        duration: 120,
        ease: "linear",
      });
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (posterRef.current) {
      posterRef.current.style.transform = "";
    }
    if (typeRef.current) {
      animate(typeRef.current, {
        opacity: [0, 1],
        duration: 200,
        ease: "linear",
      });
    }
  };

  /* ── Mutations ── */
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
    onSettled: () => {
      // Animate row out before removing
      if (rowRef.current) {
        animate(rowRef.current, {
          opacity: [1, 0],
          translateX: [0, -12],
          height: [rowRef.current.offsetHeight, 0],
          duration: 300,
          ease: "inExpo",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });

  const detailHref =
    entry.title.source && entry.title.source_id
      ? `/titles/${entry.title.source}/${encodeURIComponent(entry.title.source_id)}?media_type=${entry.title.media_type}`
      : null;
  const poster = proxiedImageUrl(entry.title.poster_url);
  const ratingPct = entry.rating != null ? entry.rating / 10 : null;

  return (
    <div
      ref={rowRef}
      className="group relative grid items-center gap-0 border-b border-border/40 transition-colors duration-150 last:border-b-0"
      style={{ ...COL, opacity: 0 }}
      data-testid="library-entry"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* Hover tint */}
      <div
        className="pointer-events-none absolute inset-0 bg-foreground/[0.022] transition-opacity duration-150"
        style={{ opacity: hovered ? 1 : 0 }}
      />

      {/* ── Poster ── */}
      <div className="relative z-10 py-2.5 pl-0">
        {detailHref ? (
          <Link href={detailHref} className="block">
            <div className="relative aspect-[2/3] w-9 overflow-hidden border border-foreground/10 bg-muted/30">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  ref={posterRef}
                  src={poster}
                  alt={entry.title.title}
                  className="absolute inset-0 size-full object-cover transition-[transform] duration-300 ease-out"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center font-serif text-sm text-muted-foreground">
                  {entry.title.title.charAt(0)}
                </div>
              )}
            </div>
          </Link>
        ) : (
          <div className="relative aspect-[2/3] w-9 overflow-hidden border border-foreground/10 bg-muted/30">
            <div className="absolute inset-0 flex items-center justify-center font-serif text-sm text-muted-foreground">
              {entry.title.title.charAt(0)}
            </div>
          </div>
        )}
      </div>

      {/* ── Title + year ── */}
      <div className="relative z-10 min-w-0 py-2.5 pr-4">
        {detailHref ? (
          <Link
            href={detailHref}
            className="block truncate font-serif text-[15px] font-bold leading-snug tracking-tight hover:underline decoration-1 underline-offset-2 decoration-foreground/30 transition-colors"
          >
            {entry.title.title}
          </Link>
        ) : (
          <div className="truncate font-serif text-[15px] font-bold leading-snug tracking-tight">
            {entry.title.title}
          </div>
        )}
        {entry.title.release_date ? (
          <div className="mt-0.5 font-sans text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
            {entry.title.release_date.slice(0, 4)} · {entry.title.media_type}
          </div>
        ) : null}
      </div>

      {/* ── Score ── */}
      <div className="relative z-10 py-2.5 text-right pr-2">
        {entry.rating != null ? (
          <span className="font-serif text-[20px] font-bold tabular-nums leading-none tracking-tight">
            <span ref={scoreRef}>{entry.rating.toFixed(1)}</span>
            <span className="text-muted-foreground/60 font-sans text-[9px] font-semibold ml-0.5 align-top mt-1 inline-block">/10</span>
          </span>
        ) : (
          <span className="font-serif text-lg text-muted-foreground/30 leading-none">—</span>
        )}
      </div>

      {/* ── Rating bar ── */}
      <div className="relative z-10 py-2.5 px-3">
        <div className="h-px w-full bg-foreground/10 overflow-hidden">
          <div
            ref={barRef}
            className="h-full bg-foreground/55"
            style={{
              transformOrigin: "left center",
              transform: `scaleX(${ratingPct ?? 0})`,
            }}
          />
        </div>
      </div>

      {/* ── Type / Controls ── */}
      <div className="relative z-10 py-2.5 pr-0 flex items-center justify-end">
        {/* Always-visible type label */}
        <span
          ref={typeRef}
          className="font-sans text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground absolute right-0 transition-none"
          style={{ opacity: hovered ? 0 : 1 }}
        >
          {MEDIA_TYPE_LABELS[entry.title.media_type]}
        </span>

        {/* Hover controls */}
        {hovered && (
          <div
            ref={controlsRef}
            className="flex items-center gap-2"
            style={{ opacity: 0 }}
          >
            <StatusSelector
              value={entry.status}
              options={allowedStatuses}
              onChange={(next) => update.mutate(next)}
              testId={`entry-status-${entry.id}`}
            />
            <button
              className="font-sans text-[11px] font-bold leading-none text-muted-foreground/50 hover:text-destructive transition-colors duration-150 w-4 h-4 flex items-center justify-center"
              onClick={() => remove.mutate()}
              data-testid="remove-entry"
              aria-label={`Remove ${entry.title.title}`}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
