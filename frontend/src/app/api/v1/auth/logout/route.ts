import { NextRequest, NextResponse } from "next/server";
import { handleUnexpected } from "@/lib/publishing/apiHelpers";
import { getSessionStore } from "@/lib/authentication/session";
import { SESSION_COOKIE_NAME, readSessionToken, sessionCookieOptions } from "@/lib/authentication/cookies";

/** POST /api/v1/auth/logout — destroys the server-side session (if any) and
 * clears the cookie. Always succeeds (idempotent: logging out twice, or
 * with an already-expired/missing session, is not an error). */
export async function POST(req: NextRequest) {
  try {
    const token = readSessionToken(req);
    if (token) await getSessionStore().destroy(token);

    const response = NextResponse.json({ ok: true });
    // maxAge: 0 deletes the cookie immediately — same attributes as the set
    // call so the browser matches it to the cookie it's clearing.
    response.cookies.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(0));
    return response;
  } catch (err) {
    return handleUnexpected(err);
  }
}
