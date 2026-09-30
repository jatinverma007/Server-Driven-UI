/**
 * Session cookie constants — one place defining the cookie's name and
 * attributes so the login route (sets it), the logout route (clears it),
 * `mockAuth.resolveActor` (reads it), and `middleware.ts` (checks for its
 * presence) all agree.
 *
 * httpOnly: never readable from client JS (mitigates token theft via XSS).
 * sameSite=lax: sent on same-site navigation/requests but not on
 * cross-site POSTs from another origin — the project's chosen CSRF
 * mitigation for these JSON-only mutation endpoints (see
 * docs/runbook.md-style rationale in `login/route.ts`), avoiding a
 * separate CSRF-token system.
 * secure: only in production, so it still works over plain http on
 * localhost during development.
 */
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "sdui_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days — mirrors session.ts's SESSION_TTL_MS

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function readSessionToken(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}
