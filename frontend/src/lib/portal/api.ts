"use client";

import type { HomeScreenConfiguration } from "@/types/homeScreen";
import type { ValidationIssue } from "@/lib/validation/semanticValidator";
import type { ComponentCatalogEntry } from "@/schema/catalog/components";
import type { ActionCatalogEntry } from "@/schema/catalog/actions";
import type { DataSourceCatalogEntry } from "@/schema/catalog/dataSources";

const BASE = "/api/v1";

/**
 * Every `/api/v1/*` call below is actually authorized by the session cookie
 * (sent automatically on same-origin `fetch`) — `mockAuth.resolveActor()`
 * reads that, not these headers, outside of `NODE_ENV=test`. The `role`
 * parameter and `x-user-role`/`x-user-id` headers are what the ~40 existing
 * route tests in tests/api.routes.test.ts authenticate with (they call
 * route handlers directly, no cookie in that harness), and `PortalProvider`
 * still threads the signed-in user's real role through here so this stays
 * a single call-site change if that plumbing is ever removed — sending them
 * against a real session is harmless: the server no longer looks at them.
 */
export type PortalRole = "viewer" | "editor" | "publisher" | "admin";

async function request<T>(path: string, role: PortalRole, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-user-role": role, "x-user-id": "portal-user@local" },
  });
  if (res.status === 401) {
    // Session expired/invalid mid-session — bounce to login rather than
    // surfacing a confusing "request failed" error in the middle of the
    // dashboard. `dashboard/layout.tsx` re-validates on the way back in.
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Your session has expired. Please log in again.");
  }
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;
  if (!res.ok && res.status !== 422 && res.status !== 304) {
    const message = body?.error?.message ?? `Request failed with ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export interface DraftResponse {
  content: HomeScreenConfiguration;
  updatedAt: string | null;
  updatedBy: string | null;
}

export function getDraft(role: PortalRole) {
  return request<DraftResponse>("/configurations/home/draft", role);
}

export function saveDraft(content: HomeScreenConfiguration, role: PortalRole) {
  return request<DraftResponse>("/configurations/home/draft", role, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
}

export interface ValidationResponse {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function validateConfig(content: HomeScreenConfiguration | undefined, role: PortalRole) {
  return request<ValidationResponse>("/configurations/home/validate", role, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: content ? JSON.stringify(content) : undefined,
  });
}

export interface PublishResponse {
  published: boolean;
  revision?: number;
  etag?: string;
  publishedAt?: string;
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
}

export function publishConfig(content: HomeScreenConfiguration | undefined, role: PortalRole) {
  return request<PublishResponse>("/configurations/home/publish", role, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: content ? JSON.stringify(content) : undefined,
  });
}

export interface RevisionSummary {
  revision: number;
  etag: string;
  createdAt: string;
  createdBy: string;
  restoredFromRevision: number | null;
}

export function listRevisions(role: PortalRole) {
  return request<{ revisions: RevisionSummary[]; currentRevision: number | null }>("/configurations/home/revisions", role);
}

export function restoreRevision(revision: number, role: PortalRole) {
  return request<{ restored: boolean; revision: number; restoredFromRevision: number }>(
    `/configurations/home/revisions/${revision}/restore`,
    role,
    { method: "POST" }
  );
}

export interface PortalUser {
  id: string;
  username: string;
  role: PortalRole;
  createdAt: string;
}

/** GET /api/v1/auth/me — who the current session cookie belongs to. Not
 * routed through `request()`: a 401 here just means "not signed in", which
 * shouldn't trigger `request()`'s redirect-to-/login (this call often runs
 * ON the login page's own load, and on the dashboard it's only ever called
 * after `dashboard/layout.tsx` already confirmed a valid session). */
export async function getCurrentUser(): Promise<PortalUser | null> {
  const res = await fetch(`${BASE}/auth/me`);
  if (!res.ok) return null;
  const body = await res.json();
  return body.user as PortalUser;
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, { method: "POST" });
}

export function getComponentCatalog(role: PortalRole = "viewer") {
  return request<{ components: ComponentCatalogEntry[] }>("/component-catalog", role);
}
export function getActionCatalog(role: PortalRole = "viewer") {
  return request<{ actions: ActionCatalogEntry[] }>("/action-catalog", role);
}
export function getDataSourceCatalog(role: PortalRole = "viewer") {
  return request<{ dataSources: DataSourceCatalogEntry[] }>("/data-source-catalog", role);
}
