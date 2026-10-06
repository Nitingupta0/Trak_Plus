export type MediaType = "movie" | "tv" | "game" | "anime" | "manga";
export type LibraryStatus =
  | "watching"
  | "playing"
  | "reading"
  | "plan_to"
  | "completed"
  | "dropped"
  | "on_hold";
export type OfferType = "stream" | "rent" | "buy";

export const STATUS_LABELS: Record<LibraryStatus, string> = {
  watching: "Watching",
  playing: "Playing",
  reading: "Reading",
  plan_to: "Plan to",
  completed: "Completed",
  dropped: "Dropped",
  on_hold: "On Hold",
};

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  movie: "Movie",
  tv: "TV",
  game: "Game",
  anime: "Anime",
  manga: "Manga",
};

export const OFFER_LABELS: Record<OfferType, string> = {
  stream: "Stream",
  rent: "Rent",
  buy: "Buy",
};

export interface UserRead {
  id: string;
  email: string;
  created_at: string;
}

export interface SearchItem {
  source: string;
  source_id: string;
  media_type: MediaType;
  title: string;
  year: number | null;
  poster_url: string | null;
  overview: string | null;
}

export interface SearchResponse {
  query: string;
  count: number;
  results: SearchItem[];
}

export interface CastMember {
  name: string;
  character: string | null;
  profile_url: string | null;
}

export interface ProviderOffer {
  country: string;
  provider_name: string;
  offer_type: OfferType;
}

export interface TitleDetail {
  id: string | null;
  source: string;
  source_id: string;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  synopsis: string | null;
  release_date: string | null;
  genres: string[];
  poster_url: string | null;
  backdrop_url: string | null;
  runtime_minutes: number | null;
  episode_count: number | null;
  season_count: number | null;
  cast: CastMember[];
  providers: ProviderOffer[];
  external_ids: Record<string, string>;
}

export interface EpisodeRow {
  id: string;
  number: number;
  season: number;
  name: string | null;
  air_date: string | null;
  description: string | null;
  thumbnail_url: string | null;
}

export interface TitleBrief {
  id: string;
  title: string;
  media_type: MediaType;
  release_date: string | null;
  poster_url: string | null;
  /** Primary external reference (e.g. "tmdb") for building detail URLs. */
  source: string | null;
  source_id: string | null;
}

export interface LibraryEntry {
  id: string;
  status: LibraryStatus;
  rating: number | null;
  notes: string | null;
  playtime_minutes: number | null;
  added_at: string;
  updated_at: string | null;
  title: TitleBrief;
}

export interface ProgressSummary {
  library_entry_id: string;
  watched_count: number;
  total_episodes: number | null;
  watched_episode_ids: string[];
}

export type ScheduleItem =
  | {
      kind: "title";
      event_id: string;
      entry_id: string;
      title_id: string;
      title: string;
      media_type: MediaType;
      poster_url: string | null;
      source: string | null;
      source_id: string | null;
      status: LibraryStatus;
      scheduled_date: string;
      air_date: string | null;
      episode_id: null;
      episode_number: null;
      season: null;
      episode_name: null;
    }
  | {
      kind: "episode";
      event_id: string;
      entry_id: string;
      title_id: string;
      title: string;
      media_type: MediaType;
      poster_url: string | null;
      source: string | null;
      source_id: string | null;
      status: LibraryStatus;
      scheduled_date: string;
      air_date: string;
      episode_id: string;
      episode_number: number;
      season: number;
      episode_name: string | null;
    };

export interface ScheduleResponse {
  upcoming: ScheduleItem[];
  backlog: ScheduleItem[];
}

export interface SyncResult {
  created: number;
  total: number;
  message?: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row?: unknown; reason: string }[];
}
