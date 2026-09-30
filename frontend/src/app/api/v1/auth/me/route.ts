import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, handleUnexpected } from "@/lib/publishing/apiHelpers";
import { UnauthorizedError } from "@/lib/authorization/mockAuth";
import { getSessionStore } from "@/lib/authentication/session";
import { readSessionToken } from "@/lib/authentication/cookies";
import { toPublicUser } from "@/lib/authentication/userRepository";

/** GET /api/v1/auth/me — who (if anyone) the current session cookie
 * belongs to. Used by the portal on load to populate the signed-in user
 * without duplicating session-validation logic client-side, and by
 * middleware-adjacent server components as a lightweight "am I logged in"
 * check. Returns 401 (never a 200 with a null user) when there is no valid
 * session, so callers can use the status code directly. */
export async function GET(req: NextRequest) {
  try {
    const token = readSessionToken(req);
    if (!token) throw new UnauthorizedError();
    const user = getSessionStore().resolveUser(token);
    if (!user) throw new UnauthorizedError("Session expired or invalid. Please log in again.");
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (err) {
    if (err instanceof UnauthorizedError) return jsonError(401, "E_UNAUTHORIZED", err.message);
    return handleUnexpected(err);
  }
}
