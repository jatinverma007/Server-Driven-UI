/**
 * Edge-safe, fast first line of route protection for `/dashboard/*`.
 *
 * This checks only whether a session cookie is *present* — it cannot
 * validate the token against the database, because `better-sqlite3` is a
 * native Node addon that the Edge runtime middleware executes in cannot
 * load. That's fine: this layer exists purely to bounce the common case
 * (no cookie at all) before any React rendering happens, cheaply. The
 * authoritative check — is this token a real, unexpired session? — lives in
 * `src/app/dashboard/layout.tsx`, a Node-runtime Server Component that runs
 * next and can hit the database. A stale/forged/expired cookie value passes
 * this layer and is caught by that one.
 */
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/authentication/cookies";

export function middleware(req: NextRequest) {
  const hasSessionCookie = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
