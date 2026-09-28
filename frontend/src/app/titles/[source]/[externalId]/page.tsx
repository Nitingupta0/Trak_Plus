import type { Metadata } from "next";

import { AppLayout } from "@/components/layout/app-layout";
import { AddToLibrary } from "@/components/titles/add-to-library";
import { BackToSearch } from "@/components/titles/back-to-search";
import { NotesRail } from "@/components/titles/notes-rail";
import { PlaytimeInputWrapper } from "@/components/titles/playtime-input-wrapper";
import { ProgressTracker } from "@/components/titles/progress-tracker";
import { TitleDetailAnimations } from "@/components/titles/title-detail-animations";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchTitleServer } from "@/lib/server/api";
import { proxiedImageUrl } from "@/lib/client/api";
import { MEDIA_TYPE_LABELS, OFFER_LABELS } from "@/lib/types";

interface PageProps {
  params: Promise<{ source: string; externalId: string }>;
  searchParams: Promise<{ media_type?: string }>;
}


async function fetchTitle(source: string, externalId: string, mediaType?: string) {
  return fetchTitleServer(source, externalId, mediaType);
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { source, externalId } = await params;
  const { media_type } = await searchParams;
  const title = await fetchTitle(source, externalId, media_type);
  if (!title) return { title: "Title — TrakPlus" };
  return {
    title: `${title.title}${title.release_date ? ` (${title.release_date.slice(0, 4)})` : ""} — TrakPlus`,
    description: title.synopsis?.slice(0, 160) ?? undefined,
  };
}

export default async function TitlePage({ params, searchParams }: PageProps) {
  const { source, externalId } = await params;
  const { media_type } = await searchParams;
  const title = await fetchTitle(source, externalId, media_type);

  if (!title) {
    return (
      <AppLayout>
        <main className="page-gutter py-16 text-center">
          <h1 className="text-2xl font-semibold">Could not load this title</h1>
          <p className="text-muted-foreground mt-2">Try again from search.</p>
        </main>
      </AppLayout>
    );
  }

  const byOffer = (offerType: string) =>
    title.providers.filter((p) => p.offer_type === offerType).map((p) => p.provider_name);
  const unique = (names: string[]) => [...new Set(names)];
  const poster = proxiedImageUrl(title.poster_url);

  return (
    <AppLayout>
      <main className="page-gutter">
        <TitleDetailAnimations>
          {/* Magazine 3-col layout */}
          <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,1.5fr)_20rem] items-start">

            {/* Left — Poster */}
            <aside
              data-animate="poster"
              aria-label="Title info"
              className="flex flex-col gap-6 self-start lg:sticky lg:top-12"
              style={{ opacity: 0 }}
            >
              {poster ? (
                <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden border border-foreground/10 bg-muted/30 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={poster}
                    alt={`${title.title} poster`}
                    className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                  {/* Inner hairline */}
                  <div className="absolute inset-0 border border-foreground/[0.07] pointer-events-none" />
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-1.5 font-sans text-[10px] font-semibold tracking-[0.12em] uppercase text-foreground/50">
                <Badge variant="outline" className="rounded-none" data-animate="badge">
                  {MEDIA_TYPE_LABELS[title.media_type]}
                </Badge>
                {title.release_date ? (
                  <Badge variant="outline" className="rounded-none" data-animate="badge">
                    {title.release_date.slice(0, 4)}
                  </Badge>
                ) : null}
                {title.runtime_minutes ? (
                  <Badge variant="outline" className="rounded-none" data-animate="badge">
                    {title.runtime_minutes >= 60
                      ? `${Math.floor(title.runtime_minutes / 60)}h ${title.runtime_minutes % 60 > 0 ? `${title.runtime_minutes % 60}m` : ""}`
                      : `${title.runtime_minutes}m`}
                  </Badge>
                ) : null}
                {title.season_count ? (
                  <Badge variant="outline" className="rounded-none" data-animate="badge">
                    {title.season_count} seasons
                  </Badge>
                ) : null}
                {title.episode_count ? (
                  <Badge variant="outline" className="rounded-none" data-animate="badge">
                    {title.episode_count} eps
                  </Badge>
                ) : null}
                <Badge variant="outline" className="rounded-none" data-animate="badge">
                  {title.source}
                </Badge>
              </div>

              <AddToLibrary
                internalTitleId={title.id}
                mediaType={title.media_type}
                fallbackLabel={title.title}
              />

              {/* Playtime input for games */}
              {title.media_type === "game" && title.id && (
                <PlaytimeInputWrapper internalTitleId={title.id} />
              )}
            </aside>

            {/* Center — Typography + Info */}
            <div className="flex min-w-0 flex-col py-2">

              {/* Headline block */}
              <div data-animate="title" className="flex flex-col gap-3" style={{ opacity: 0 }}>
                {title.original_title && title.original_title !== title.title ? (
                  <p className="text-muted-foreground font-sans text-[10px] font-semibold tracking-[0.14em] uppercase leading-none">
                    ORIGINAL: {title.original_title}
                  </p>
                ) : null}
                <h1 className="font-serif text-5xl lg:text-[4.5rem] leading-[0.88] font-bold tracking-tighter text-balance">
                  {title.title}
                </h1>
                {title.genres.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {title.genres.map((genre) => (
                      <Badge
                        key={genre}
                        variant="outline"
                        className="border-foreground/20"
                        data-animate="genre"
                        style={{ opacity: 0 }}
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              {title.synopsis ? (
                <p
                  data-animate="synopsis"
                  className="mt-10 max-w-2xl text-[1.05rem] leading-relaxed text-pretty font-medium text-foreground/75"
                  style={{ opacity: 0 }}
                >
                  {title.synopsis}
                </p>
              ) : null}

              {title.providers.length > 0 ? (
                <>
                  <Separator className="my-8 opacity-40" />
                  <section aria-label="Where to stream in India" className="flex flex-col gap-4">
                    <h2 className="text-[10px] font-sans font-bold tracking-[0.14em] uppercase text-muted-foreground/60">
                      Where to stream · India
                    </h2>
                    <div className="flex flex-col gap-4">
                      {(["stream", "rent", "buy"] as const).map((offer) => {
                        const providers = unique(byOffer(offer));
                        if (providers.length === 0) return null;
                        return (
                          <div key={offer} className="flex flex-col gap-2">
                            <div className="text-foreground/70 font-sans text-[10px] font-bold tracking-[0.14em] uppercase">
                              {OFFER_LABELS[offer]}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {providers.map((name) => (
                                <Badge
                                  key={name}
                                  variant="secondary"
                                  className="rounded-none text-xs"
                                  data-animate="badge"
                                  style={{ opacity: 0 }}
                                >
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </>
              ) : null}

              {title.cast.length > 0 ? (
                <>
                  <Separator className="my-8 opacity-40" />
                  <section aria-label="Cast" className="flex flex-col gap-4">
                    <h2 className="text-[10px] font-sans font-bold tracking-[0.14em] uppercase text-muted-foreground/60">
                      Top cast
                    </h2>
                    <div className="flex flex-wrap gap-5">
                      {title.cast.slice(0, 10).map((member) => {
                        const profile = proxiedImageUrl(member.profile_url);
                        return (
                          <div
                            key={`${member.name}-${member.character ?? ""}`}
                            className="flex w-20 flex-col items-start gap-2 group/cast"
                            data-animate="cast-card"
                            style={{ opacity: 0 }}
                          >
                            {profile ? (
                              <div className="relative aspect-[2/3] w-20 overflow-hidden border border-border/50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={profile}
                                  alt={member.name}
                                  className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover/cast:scale-[1.04]"
                                />
                              </div>
                            ) : (
                              <div className="relative aspect-[2/3] w-20 border border-border bg-muted/20" />
                            )}
                            <div className="w-full">
                              <div className="text-[13px] font-serif font-bold leading-tight line-clamp-1">
                                {member.name}
                              </div>
                              {member.character ? (
                                <div className="text-muted-foreground text-[11px] line-clamp-1 mt-0.5">
                                  {member.character}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </>
              ) : null}

              <Separator className="my-8 opacity-40" />
              <ProgressTracker
                source={title.source}
                externalId={title.source_id}
                internalTitleId={title.id}
                isEpisodeMedia={["tv", "anime", "manga"].includes(title.media_type)}
                mediaType={title.media_type}
              />
            </div>

            {/* Right — Notes rail */}
            <aside
              data-animate="notes"
              className="flex flex-col self-start gap-4 lg:hairline-l lg:pl-8 lg:sticky lg:top-12"
              style={{ opacity: 0 }}
            >
              <NotesRail internalTitleId={title.id} />
            </aside>
          </div>

          <div className="mt-8">
            <BackToSearch />
          </div>
        </TitleDetailAnimations>
      </main>
    </AppLayout>
  );
}
