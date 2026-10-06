import { NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  fastapi,
  setAuthCookies,
} from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "not authenticated" }, { status: 401 });
  }

  let upstream = await fastapi("/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Access token expired → try one silent refresh, then retry.
  if (upstream.status === 401) {
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      const refreshResponse = await fastapi("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json();
        upstream = await fastapi("/auth/me", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (upstream.ok) {
          const user = await upstream.json();
          return setAuthCookies(NextResponse.json(user), tokens);
        }
      }
    }
    return NextResponse.json({ detail: "not authenticated" }, { status: 401 });
  }

  const user = await upstream.json();
  return NextResponse.json(user, { status: upstream.status });
}
