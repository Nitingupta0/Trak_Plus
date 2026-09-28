import { NextRequest, NextResponse } from "next/server";

import { fastapiForm, setAuthCookies } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ detail: "email and password required" }, { status: 400 });
  }

  const upstream = await fastapiForm("/auth/login", { username: email, password });
  if (!upstream.ok) {
    const detail = await upstream.json().catch(() => ({ detail: "login failed" }));
    return NextResponse.json(detail, { status: upstream.status });
  }
  const tokens = await upstream.json();
  return setAuthCookies(NextResponse.json({ ok: true }), tokens);
}
