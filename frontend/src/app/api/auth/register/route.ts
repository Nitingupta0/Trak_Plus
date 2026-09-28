import { NextRequest, NextResponse } from "next/server";

import { fastapi } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const upstream = await fastapi("/auth/register", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
  const payload = await upstream.json().catch(() => ({ detail: "register failed" }));
  return NextResponse.json(payload, { status: upstream.status });
}
