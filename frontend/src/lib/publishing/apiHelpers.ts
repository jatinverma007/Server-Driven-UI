import { NextRequest, NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/authorization/mockAuth";

export const SCREEN_KEY = "home";

/**
 * A home-screen configuration is a few KB of JSON in practice (the seeded
 * fixture is ~16KB). 2MB is generous headroom while still ruling out the
 * "someone POSTs a multi-hundred-MB body" case that route handlers accept
 * by default with no limit of their own — flagged in
 * docs/production-readiness-audit.md ("Size limits").
 */
const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;

/**
 * A best-effort, additive size guard, checked BEFORE `req.json()` buffers
 * the whole body into memory. It only catches requests that send an honest
 * `Content-Length` header — a chunked-transfer request with no
 * `Content-Length`, or a client that lies about it, is not caught here.
 * That residual gap is exactly why docs/production-readiness-audit.md still
 * recommends a platform/reverse-proxy-level body size limit (e.g. a CDN or
 * `client_max_body_size`) as the actual production control; this is cheap
 * defense-in-depth on top of that, not a replacement for it.
 */
export function checkBodySize(req: NextRequest, maxBytes: number = MAX_REQUEST_BODY_BYTES): NextResponse | null {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
    return jsonError(413, "E_PAYLOAD_TOO_LARGE", `Request body exceeds the ${maxBytes}-byte limit for this endpoint.`);
  }
  return null;
}

export function jsonError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export function handleUnexpected(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return jsonError(401, "E_UNAUTHORIZED", err.message);
  }
  if (err instanceof ForbiddenError) {
    return jsonError(403, "E_FORBIDDEN", err.message);
  }
  console.error("[api] unhandled error", err);
  return jsonError(500, "E_INTERNAL", "Unexpected server error.");
}
