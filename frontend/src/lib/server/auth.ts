import { NextResponse } from "next/server";

export const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const ACCESS_COOKIE = "tp_access";
export const REFRESH_COOKIE = "tp_refresh";

const isProd = process.env.NODE_ENV === "production";

export const accessCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  path: "/",
  maxAge: 60 * 60, // 1h — access tokens are short-lived; BFF auto-refreshes
};

export const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7d, matches backend REFRESH_TOKEN_EXPIRE_DAYS
};

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export function setAuthCookies(response: NextResponse, tokens: TokenPair) {
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, accessCookieOptions);
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, refreshCookieOptions);
  return response;
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...accessCookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...refreshCookieOptions, maxAge: 0 });
  return response;
}

export async function fastapi(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
}

export async function fastapiForm(path: string, form: Record<string, string>): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    cache: "no-store",
  });
}
