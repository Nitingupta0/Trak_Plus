"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense, useRef, useCallback, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { animate } from "animejs";

import { AppLayout } from "@/components/layout/app-layout";
import { SearchBar } from "@/components/search/search-bar";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/ui/page-transition";
import { queries, proxiedImageUrl } from "@/lib/client/api";
import { MEDIA_TYPE_LABELS, type MediaType, type SearchItem } from "@/lib/types";

/* ─── Result Card ─── */
function ResultCard({ item, index = 0 }: { item: SearchItem; index?: number }) {
  const href = `/titles/${item.source}/${encodeURIComponent(item.source_id)}?media_type=${item.media_type}`;
  const poster = proxiedImageUrl(item.poster_url);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // Staggered entrance
  useEffect(() => {
    if (mounted.current || !cardRef.current) return;
    mounted.current = true;
    animate(cardRef.current, {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 480,
      delay: index * 38 + 40,
      ease: "outExpo",
    });
  }, [index]);

  const handleMouseEnter = () => {
    if (posterRef.current) {
      animate(posterRef.current, { scale: 1.06, duration: 700, ease: "outExpo" });
    }
    if (cardRef.current) {
      animate(cardRef.current, { translateY: -4, duration: 250, ease: "outSine" });
    }
    if (overlayRef.current) {
      animate(overlayRef.current, { opacity: 1, duration: 200, ease: "outSine" });
    }
  };

  const handleMouseLeave = () => {
    if (posterRef.current) {
      animate(posterRef.current, { scale: 1, duration: 500, ease: "outSine" });
    }
    if (cardRef.current) {
      animate(cardRef.current, { translateY: 0, duration: 350, ease: "outExpo" });
    }
    if (overlayRef.current) {
      animate(overlayRef.current, { opacity: 0, duration: 300, ease: "outSine" });
    }
  };

  return (
    <Link
      ref={cardRef}
      href={href}
      className="group flex flex-col gap-2.5"
      data-testid="search-result"
      style={{ opacity: 0 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden border border-border/50 bg-muted/30">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={posterRef}
            src={poster}
            alt={item.title}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl font-serif text-muted-foreground/40">
            {item.title.charAt(0)}
          </div>
        )}
        {/* Hover overlay tint */}
        <div
          ref={overlayRef}
          className="absolute inset-0 bg-foreground/[0.06] pointer-events-none"
          style={{ opacity: 0 }}
        />
        {/* Inner hairline */}
        <div className="absolute inset-0 border border-foreground/[0.06] pointer-events-none" />
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-0.5">
        <div className="font-sans text-[9px] font-bold tracking-[0.14em] uppercase text-muted-foreground/60">
          {MEDIA_TYPE_LABELS[item.media_type]}
        </div>
        <div className="line-clamp-2 font-serif text-sm font-bold leading-snug tracking-tight group-hover:underline decoration-1 underline-offset-2 decoration-foreground/25">
          {item.title}
        </div>
        <div className="font-sans text-[10px] font-semibold text-muted-foreground/50 tracking-wider">
          {item.year ?? "—"} · {item.source}
        </div>
      </div>
    </Link>
  );
}

/* ─── Recent search chip ─── */
function RecentChip({ label, onClick }: { label: string; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      className="border border-border/60 px-3 py-1.5 font-serif text-sm text-foreground/70 hover:text-foreground hover:border-foreground/40 transition-colors duration-150"
      onClick={onClick}
      onMouseEnter={() => {
        if (ref.current) animate(ref.current, { translateY: -1, duration: 150, ease: "outSine" });
      }}
      onMouseLeave={() => {
        if (ref.current) animate(ref.current, { translateY: 0, duration: 200, ease: "outElastic(1,0.4)" });
      }}
    >
      {label}
    </button>
  );
}

/* ─── Grid section ─── */
function ResultSection({
  mediaType,
  items,
  offset = 0,
}: {
  mediaType: MediaType;
  items: SearchItem[];
  offset: number;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current || !headingRef.current) return;
    mounted.current = true;
    animate(headingRef.current, {
      opacity: [0, 1],
      translateX: [-6, 0],
      duration: 400,
      delay: offset * 38,
      ease: "outExpo",
    });
  }, [offset]);

  return (
    <section className="flex flex-col gap-4">
      <h2
        ref={headingRef}
        className="font-sans text-[10px] font-bold tracking-[0.16em] uppercase text-muted-foreground/60"
        style={{ opacity: 0 }}
      >
        {MEDIA_TYPE_LABELS[mediaType]} · {items.length}
      </h2>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((item, i) => (
          <ResultCard
            key={`${item.source}-${item.source_id}`}
            item={item}
            index={offset + i}
          />
        ))}
      </div>
    </section>
  );
}

/* ─── Constants ─── */
const RECENT_SEARCHES_KEY = "trakplus:recent-searches";
const MAX_RECENT_SEARCHES = 8;

/* ─── Page content ─── */
function SearchPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get("q")?.trim() ?? "";
  const [query, setQuery] = useState(queryFromUrl);
  const [inputValue, setInputValue] = useState(queryFromUrl);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
      if (Array.isArray(stored)) {
        return stored.filter((item): item is string => typeof item === "string");
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Sync URL query param to state (only on initial mount or when URL changes externally)
  const prevQueryFromUrlRef = useRef(queryFromUrl);
  useEffect(() => {
    if (prevQueryFromUrlRef.current !== queryFromUrl) {
      prevQueryFromUrlRef.current = queryFromUrl;
      setQuery(queryFromUrl);
      setInputValue(queryFromUrl);
    }
  }, [queryFromUrl]);

  const runSearch = useCallback(
    (nextQuery: string) => {
      const normalized = nextQuery.trim();
      setQuery(normalized);
      const params = new URLSearchParams(searchParams.toString());
      if (normalized) params.set("q", normalized);
      else params.delete("q");
      router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`);
      if (normalized.length > 1) {
        const nextRecent = [
          normalized,
          ...recentSearches.filter((item) => item !== normalized),
        ].slice(0, MAX_RECENT_SEARCHES);
        setRecentSearches(nextRecent);
        window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextRecent));
      }
    },
    [searchParams, pathname, router, recentSearches],
  );

  function clearRecentSearches() {
    setRecentSearches([]);
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
  }

  const { data, isPending, isFetching } = useQuery({
    queryKey: ["search", query],
    queryFn: () => queries.search(query),
    enabled: query.length > 1,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const grouped = useMemo(() => {
    const byType = new Map<MediaType, SearchItem[]>();
    for (const item of data?.results ?? []) {
      const list = byType.get(item.media_type) ?? [];
      list.push(item);
      byType.set(item.media_type, list);
    }
    return byType;
  }, [data]);

  // Running card index offset across sections
  let cardOffset = 0;

  return (
    <AppLayout>
      <PageTransition>
        <main className="page-gutter flex flex-col gap-8">
          {/* Search bar — full-width, no surrounding header box */}
          <div className="border-b border-border/50 pb-6">
            <SearchBar
              value={inputValue}
              onValueChange={setInputValue}
              onQueryChange={runSearch}
            />
            {/* Stale indicator */}
            {isFetching && (
              <div className="mt-2 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 animate-pulse">
                Searching…
              </div>
            )}
          </div>

          {query.length <= 1 ? (
            recentSearches.length > 0 ? (
              <section aria-label="Recent searches" className="flex flex-col gap-4 animate-slide-up">
                <div className="flex items-center justify-between">
                  <h2 className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground/60">
                    Recent searches
                  </h2>
                  <button
                    type="button"
                    className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    onClick={clearRecentSearches}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((recent) => (
                    <RecentChip
                      key={recent}
                      label={recent}
                      onClick={() => {
                        setInputValue(recent);
                        runSearch(recent);
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <div className="animate-slide-up mt-12 text-center">
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Search across every source</EmptyTitle>
                    <EmptyDescription>
                      TMDB (movies/TV), RAWG (games), AniList (anime), MangaDex (manga) — one query.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            )
          ) : isPending ? (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/3] w-full" />
              ))}
            </div>
          ) : data && data.count === 0 ? (
            <div className="animate-slide-up mt-12 text-center">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No results for &ldquo;{query}&rdquo;</EmptyTitle>
                  <EmptyDescription>Try a different spelling, or check back later.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {[...grouped.entries()].map(([mediaType, items]) => {
                const section = (
                  <ResultSection
                    key={mediaType}
                    mediaType={mediaType}
                    items={items}
                    offset={cardOffset}
                  />
                );
                cardOffset += items.length;
                return section;
              })}
            </div>
          )}
        </main>
      </PageTransition>
    </AppLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="page-gutter">
            <Skeleton className="h-10 w-full" />
          </div>
        </AppLayout>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
