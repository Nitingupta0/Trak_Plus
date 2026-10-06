import { NextRequest, NextResponse } from "next/server";

import { fastapi, setAuthCookies } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const credential = typeof body?.credential === "string" ? body.credential : "";
  if (!credential) {
    return NextResponse.json({ detail: "credential required" }, { status: 400 });
  }
  const upstream = await fastapi("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  const payload = await upstream.json().catch(() => ({ detail: "google sign-in failed" }));
  if (!upstream.ok) {
    return NextResponse.json(payload, { status: upstream.status });
  }
  return setAuthCookies(NextResponse.json({ ok: true }), payload);
}
