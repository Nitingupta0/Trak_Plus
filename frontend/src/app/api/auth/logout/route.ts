import { NextResponse } from "next/server";

import { clearAuthCookies } from "@/lib/server/auth";

export async function POST() {
  return clearAuthCookies(NextResponse.json({ ok: true }));
}
