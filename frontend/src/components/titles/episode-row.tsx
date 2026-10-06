"use client";

import { proxiedImageUrl } from "@/lib/client/api";

interface EpisodeRowProps {
  number: number;
  season: number;
  name: string | null;
  airDate: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  watched: boolean;
  onToggle: (watched: boolean) => void;
}

/** One episode/chapter row in the progress tracker. */
export function EpisodeRowItem({
  number,
  season,
  name,
  airDate,
  description,
  thumbnailUrl,
  watched,
  onToggle,
}: EpisodeRowProps) {
  const thumbnail = proxiedImageUrl(thumbnailUrl);
  const label = name ?? `Episode ${number}`;

  return (
    <li className="flex items-start gap-3 px-3 py-2 hover:bg-muted/20 transition-colors">
      <input
        type="checkbox"
        className="accent-primary mt-1 size-4 shrink-0"
        checked={watched}
        aria-label={`Mark ${label} as watched`}
        data-testid={`episode-checkbox-${number}`}
        onChange={(event) => onToggle(event.target.checked)}
      />
      {thumbnail ? (
        // Images are already fetched through our allowlisted proxy; intrinsic
        // dimensions vary by provider, so Next Image is not used here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail}
          alt=""
          aria-hidden="true"
          className="hidden aspect-video w-24 shrink-0 object-cover sm:block"
        />
      ) : null}
      <span className="text-muted-foreground mt-0.5 w-14 shrink-0 text-sm tabular-nums">
        {season > 0 ? `S${season}·` : ""}E{number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{label}</span>
        {description ? (
          <span className="text-muted-foreground mt-1 block line-clamp-2 text-xs leading-relaxed">
            {description}
          </span>
        ) : null}
      </span>
      {airDate ? (
        <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">{airDate}</span>
      ) : null}
    </li>
  );
}
