"use client";

import Link from "next/link";
import { Calendar, Film, Tv } from "lucide-react";
import { proxiedImageUrl } from "@/lib/client/api";
import { MEDIA_TYPE_LABELS, type ScheduleItem } from "@/lib/types";

interface ScheduleCardProps {
  item: ScheduleItem;
  index: number;
}

/**
 * Visual card for schedule items with poster, date badge, and metadata.
 * Features spring-based hover effects and staggered entrance animation.
 */
export function ScheduleCard({ item, index }: ScheduleCardProps) {
  const detailHref =
    item.source && item.source_id
      ? `/titles/${item.source}/${item.source_id}?media_type=${item.media_type}`
      : null;

  const poster = proxiedImageUrl(item.poster_url);
  const isToday = item.scheduled_date === new Date().toISOString().slice(0, 10);
  const isEpisode = item.kind === "episode";

  // Format date for display
  const dateObj = new Date(item.scheduled_date + "T00:00:00");
  const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
  const dayNum = dateObj.getDate();
  const monthName = dateObj.toLocaleDateString("en-US", { month: "short" });

  return (
    <div
      className="group relative flex gap-4 p-3 border border-border/30 bg-card/50 hover:bg-card transition-all duration-300 ease-out hover:border-border/60 hover:shadow-lg"
      style={{
        animationDelay: `${index * 60}ms`,
      }}
      data-testid="schedule-card"
    >
      {/* Date Badge - matches poster height */}
      <div
        className={`shrink-0 w-14 h-24 flex flex-col items-center justify-center border ${
          isToday
            ? "bg-amber-500/10 border-amber-500/40 text-amber-600"
            : "bg-muted/30 border-border/40 text-muted-foreground"
        }`}
      >
        <span className="text-[9px] font-sans font-bold uppercase tracking-wider">
          {dayName}
        </span>
        <span className="text-2xl font-serif font-bold leading-none">
          {dayNum}
        </span>
        <span className="text-[9px] font-sans font-semibold">{monthName}</span>
      </div>

      {/* Poster Thumbnail - 2:3 aspect ratio for movie posters */}
      <div className="shrink-0 w-16 h-24 overflow-hidden bg-muted/40 border border-border/20">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            {isEpisode ? <Tv className="w-6 h-6" /> : <Film className="w-6 h-6" />}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {detailHref ? (
          <Link
            href={detailHref}
            className="truncate font-serif text-sm font-bold tracking-tight text-foreground hover:underline decoration-1 underline-offset-2"
          >
            {item.title}
          </Link>
        ) : (
          <span className="truncate font-serif text-sm font-bold tracking-tight text-foreground">
            {item.title}
          </span>
        )}

        <div className="flex items-center gap-2 mt-1">
          {/* Type Badge */}
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider border ${
              isEpisode
                ? "border-blue-500/30 text-blue-500 bg-blue-500/10"
                : "border-purple-500/30 text-purple-500 bg-purple-500/10"
            }`}
          >
            {isEpisode ? (
              <>
                <Tv className="w-2.5 h-2.5" />
                S{item.season}·E{item.episode_number}
              </>
            ) : (
              <>
                <Film className="w-2.5 h-2.5" />
                {MEDIA_TYPE_LABELS[item.media_type]}
              </>
            )}
          </span>

          {/* Episode Name */}
          {isEpisode && item.episode_name && (
            <span className="truncate text-xs text-muted-foreground/80">
              {item.episode_name}
            </span>
          )}
        </div>
      </div>

      {/* Today Indicator */}
      {isToday && (
        <div className="absolute -top-1 -right-1">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
        </div>
      )}

      {/* Calendar Icon (subtle) */}
      <div className="absolute bottom-2 right-2 text-muted-foreground/20">
        <Calendar className="w-4 h-4" />
      </div>
    </div>
  );
}
