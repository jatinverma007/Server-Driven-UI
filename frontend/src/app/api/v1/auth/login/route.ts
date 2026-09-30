import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, handleUnexpected, checkBodySize } from "@/lib/publishing/apiHelpers";
import { checkRateLimit } from "@/lib/publishing/rateLimit";
import { getUserRepository, toPublicUser } from "@/lib/authentication/userRepository";
import { verifyPassword } from "@/lib/authentication/passwordHash";
import { getSessionStore } from "@/lib/authentication/session";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, sessionCookieOptions } from "@/lib/authentication/cookies";

const LoginBody = z.object({
  username: z.string().trim().min(1, "Username or email is required."),
  password: z.string().min(1, "Password is required."),
});

const MAX_LOGIN_ATTEMPTS_PER_MINUTE = 10;

/**
 * POST /api/v1/auth/login — the only unauthenticated write endpoint in the
 * API. Deliberately returns the *same* generic error for "no such user" and
 * "wrong password" (never reveals which one), so a client can't enumerate
 * valid usernames by timing/message differences.
 */
export async function POST(req: NextRequest) {
  try {
    const tooLarge = checkBodySize(req, 16 * 1024); // a login body is a few dozen bytes at most
    if (tooLarge) return tooLarge;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonError(400, "E_INVALID_BODY", "Request body must be valid JSON.");
    }

    const parsed = LoginBody.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Username/email and password are required.";
      return jsonError(400, "E_VALIDATION", message);
    }
    const { username, password } = parsed.data;

    // Rate-limit by normalized username rather than IP (no reverse proxy in
    // this PoC to trust an IP header from) — bounds brute-force attempts
    // against any one account. See rateLimit.ts's own PoC-scope caveat.
    const rateLimitKey = `login:${username.trim().toLowerCase()}`;
    if (!checkRateLimit(rateLimitKey, MAX_LOGIN_ATTEMPTS_PER_MINUTE)) {
      return jsonError(429, "E_RATE_LIMITED", "Too many login attempts. Please wait a moment and try again.");
    }

    const user = getUserRepository().findByUsername(username);
    const genericError = () => jsonError(401, "E_INVALID_CREDENTIALS", "Incorrect username/email or password.");

    if (!user) return genericError();
    if (!verifyPassword(password, user.passwordHash)) return genericError();

    const sessionStore = getSessionStore();
    sessionStore.purgeExpired();
    const session = sessionStore.create(user.id);

    const response = NextResponse.json({ user: toPublicUser(user) });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions(SESSION_TTL_SECONDS));
    return response;
  } catch (err) {
    return handleUnexpected(err);
  }
}
