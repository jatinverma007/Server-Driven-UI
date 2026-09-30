/**
 * Authentication/RBAC.
 *
 * `resolveActor()` reads the real, server-validated session cookie (see
 * `lib/authentication/session.ts`) — this is the "session lookup" swap this
 * module's doc comment used to anticipate, and it's the only thing that
 * changed: every call site below (`can()`, `ForbiddenError`,
 * `requirePermission()`, the `Actor`/`Role`/`Permission` shapes) is
 * untouched, so the swap really did touch just this one file.
 *
 * TEST-ONLY FALLBACK: `tests/api.routes.test.ts`'s ~40 route tests call
 * handlers directly with a `NextRequest` carrying an `x-user-role`/
 * `x-user-id` header (no real cookie/session to attach in that harness).
 * Trusting unsigned headers would be a real vulnerability in production, so
 * that fallback is gated strictly behind `NODE_ENV === "test"` (set
 * automatically by Vitest) — it never runs against `next dev`/`next start`.
 */
import { NextRequest } from "next/server";
import { readSessionToken } from "@/lib/authentication/cookies";
import { getSessionStore } from "@/lib/authentication/session";

export type Role = "viewer" | "editor" | "publisher" | "admin";
export type Permission = "read" | "write_draft" | "validate" | "publish" | "restore";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: ["read"],
  editor: ["read", "write_draft", "validate"],
  publisher: ["read", "write_draft", "validate", "publish", "restore"],
  admin: ["read", "write_draft", "validate", "publish", "restore"],
};

const KNOWN_ROLES: Role[] = ["viewer", "editor", "publisher", "admin"];

export interface Actor {
  id: string;
  role: Role;
}

/** Thrown when a route requires an authenticated actor and the request has
 * no valid session — distinct from `ForbiddenError` (a *known* actor whose
 * role lacks a permission). `apiHelpers.handleUnexpected` maps this to 401,
 * `ForbiddenError` to 403. */
export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function resolveActor(req: NextRequest): Actor {
  if (process.env.NODE_ENV === "test") {
    const headerRole = req.headers.get("x-user-role");
    const headerId = req.headers.get("x-user-id");
    const role = (KNOWN_ROLES as string[]).includes(headerRole ?? "")
      ? (headerRole as Role)
      : ((process.env.MOCK_ACTOR_ROLE as Role) ?? "viewer");
    const id = headerId || process.env.MOCK_ACTOR_ID || "anonymous@local";
    return { id, role };
  }

  const token = readSessionToken(req);
  if (!token) throw new UnauthorizedError();
  const user = getSessionStore().resolveUser(token);
  if (!user) throw new UnauthorizedError("Session expired or invalid. Please log in again.");
  return { id: user.username, role: user.role as Role };
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export class ForbiddenError extends Error {
  constructor(permission: Permission, role: Role) {
    super(`Role "${role}" does not have permission "${permission}".`);
    this.name = "ForbiddenError";
  }
}

export function requirePermission(actor: Actor, permission: Permission): void {
  if (!can(actor.role, permission)) {
    throw new ForbiddenError(permission, actor.role);
  }
}
