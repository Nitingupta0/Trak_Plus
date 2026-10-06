import type {
  EpisodeRow,
  LibraryEntry,
  ProgressSummary,
  SearchResponse,
  SyncResult,
  TitleDetail,
  UserRead,
} from "@/lib/types";

/** Same-origin BFF call for authenticated endpoints (library, progress). */
export async function bff<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/bff/${path.replace(/^\//, "")}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (response.status === 401) {
    // Intentional full reload: the session cookie is gone and every query in
    // the tree is stale, so a fresh page load is the correct reset.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new Error("not authenticated");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

/** Direct call to the FastAPI backend for public (unauthenticated) endpoints. */
export async function publicApi<T>(
  path: string,
  params?: Record<string, string>,
  method: "GET" | "POST" = "GET",
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const url = base.startsWith("http")
    ? new URL(`${base}${path}`)
    : new URL(`${base}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), { method });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function authPost(path: string, body?: unknown): Promise<Response> {
  return fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Route external cover/poster images through the backend's /img proxy.
 * MangaDex's CDN challenges browser image requests from some ISPs and some
 * networks block RAWG outright — the backend (uncensored AWS network) fetches
 * them instead. Returns null for missing/invalid URLs (caller shows fallback).
 */
export function proxiedImageUrl(
  url: string | null | undefined,
  apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
): string | null {
  if (!url || !url.startsWith("http")) return null;
  const base = apiBase.replace(/\/$/, "");
  return `${base}/img?url=${encodeURIComponent(url)}`;
}

export const queries = {
  me: () => fetch("/api/auth/me").then((r) => (r.ok ? (r.json() as Promise<UserRead>) : null)),
  search: (q: string) =>
    publicApi<SearchResponse>("/search", { q, type: "all" }),
  title: (source: string, externalId: string, mediaType?: string) =>
    publicApi<TitleDetail>(`/titles/${source}/${externalId}`, { media_type: mediaType ?? "" }),
  episodes: (source: string, externalId: string) =>
    publicApi<EpisodeRow[]>(`/titles/${source}/${externalId}/episodes`),
  library: () => bff<LibraryEntry[]>("/library"),
  progress: (entryId: string) => bff<ProgressSummary>(`/library/${entryId}/progress`),
  syncEpisodes: (source: string, externalId: string, mediaType?: string) =>
    publicApi<SyncResult>(
      `/titles/${source}/${externalId}/episodes/sync`,
      { media_type: mediaType ?? "" },
      "POST",
    ),
};