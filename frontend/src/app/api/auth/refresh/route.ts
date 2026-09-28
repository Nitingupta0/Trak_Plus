import { NextRequest, NextResponse } from "next/server";

import { REFRESH_COOKIE, fastapi, refreshCookieOptions, setAuthCookies } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ detail: "not authenticated" }, { status: 401 });
  }
  const upstream = await fastapi("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!upstream.ok) {
    const detail = await upstream.json().catch(() => ({ detail: "refresh failed" }));
    return NextResponse.json(detail, { status: upstream.status });
  }
  const tokens = await upstream.json();
  // Keep the refresh cookie expiry in sync with the rotated token.
  const response = setAuthCookies(NextResponse.json({ ok: true }), tokens);
  return response;
}

export function DELETE() {
  // Convenience: logout is just cookie clearing.
  const response = NextResponse.json({ ok: true });
  response.cookies.set(REFRESH_COOKIE, "", { ...refreshCookieOptions, maxAge: 0 });
  return response;
}
