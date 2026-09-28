import { API_URL } from "@/lib/server/auth";
import type { TitleDetail } from "@/lib/types";

/**
 * Server-side title fetch for server components. Uses the runtime API_URL env
 * (compose: http://backend:8000) — NOT the build-time-inlined
 * NEXT_PUBLIC_API_URL, which is only valid in the browser.
 */
export async function fetchTitleServer(
  source: string,
  externalId: string,
  mediaType?: string,
): Promise<TitleDetail | null> {
  const url = new URL(`${API_URL}/titles/${source}/${encodeURIComponent(externalId)}`);
  if (mediaType) url.searchParams.set("media_type", mediaType);
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as TitleDetail;
  } catch {
    return null;
  }
}
