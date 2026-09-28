import { NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  API_URL,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/server/auth";

const BODY_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Authenticated proxy to the FastAPI backend (BFF pattern, design.md §5).
 * Injects the access token from the httpOnly cookie; silently refreshes once
 * on 401 and retries. The browser never sees raw JWTs.
 */
async function proxy(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const targetPath = `/${path.join("/")}${request.nextUrl.search}`;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "not authenticated" }, { status: 401 });
  }

  const forward = async (token: string) =>
    fetch(`${API_URL}${targetPath}`, {
      method: request.method,
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: BODY_METHODS.has(request.method) ? await request.blob() : undefined,
      cache: "no-store",
    });

  let upstream = await forward(accessToken);

  if (upstream.status === 401) {
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      });
      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json();
        upstream = await forward(tokens.access_token);
        if (upstream.ok) {
          const payload = await upstream.text();
          return setAuthCookies(
            new NextResponse(payload, {
              status: upstream.status,
              headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
            }),
            tokens,
          );
        }
      }
    }
    return clearAuthCookies(
      NextResponse.json({ detail: "session expired" }, { status: 401 }),
    );
  }

  const payload = await upstream.text();
  return new NextResponse(payload, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
