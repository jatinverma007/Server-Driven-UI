import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/v1/auth";

beforeAll(() => {
  // Own, isolated DB file — same convention as tests/api.routes.test.ts —
  // so this file's users/sessions never collide with the other test file's
  // configuration fixtures (or with a developer's real dev.db).
  process.env.DATABASE_URL = `file:./tests/tmp/auth-${randomUUID()}.db`;
});

function jsonReq(url: string, init?: { method?: string; body?: unknown; cookie?: string }) {
  const headers = new Headers();
  if (init?.body !== undefined) headers.set("content-type", "application/json");
  if (init?.cookie) headers.set("cookie", init.cookie);
  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

describe("password hashing", () => {
  it("hashes never contain the plaintext and round-trip verify correctly", async () => {
    const { hashPassword, verifyPassword } = await import("@/lib/authentication/passwordHash");
    const hash = hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse battery staple");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(verifyPassword("wrong password", hash)).toBe(false);
  });

  it("verifyPassword never throws on a malformed stored hash", async () => {
    const { verifyPassword } = await import("@/lib/authentication/passwordHash");
    expect(verifyPassword("anything", "not-a-real-hash")).toBe(false);
    expect(verifyPassword("anything", "")).toBe(false);
  });
});

describe("session store", () => {
  it("creates a session whose token resolves back to the owning user, and destroy() invalidates it", async () => {
    const { getUserRepository } = await import("@/lib/authentication/userRepository");
    const { hashPassword } = await import("@/lib/authentication/passwordHash");
    const { getSessionStore } = await import("@/lib/authentication/session");

    const user = getUserRepository().createUser(`session-user-${randomUUID()}@local`, hashPassword("p@ssword1"), "editor");
    const store = getSessionStore();
    const session = store.create(user.id);

    const resolved = store.resolveUser(session.token);
    expect(resolved?.id).toBe(user.id);

    store.destroy(session.token);
    expect(store.resolveUser(session.token)).toBeNull();
  });

  it("rejects an expired session", async () => {
    const { getUserRepository } = await import("@/lib/authentication/userRepository");
    const { hashPassword } = await import("@/lib/authentication/passwordHash");
    const { getSessionStore } = await import("@/lib/authentication/session");
    const { getDb } = await import("@/lib/db/sqlite");

    const user = getUserRepository().createUser(`expired-user-${randomUUID()}@local`, hashPassword("p@ssword1"), "viewer");
    const store = getSessionStore();
    const session = store.create(user.id);

    // Backdate expiresAt directly — SessionStore's own API always sets a
    // future expiry, so this is the only way to exercise the expiry path
    // without mocking the system clock.
    getDb().prepare("UPDATE Session SET expiresAt = @past WHERE tokenHash IS NOT NULL AND userId = @userId").run({
      past: new Date(Date.now() - 1000).toISOString(),
      userId: user.id,
    });

    expect(store.resolveUser(session.token)).toBeNull();
  });
});

describe("POST /api/v1/auth/login", () => {
  it("logs in with correct credentials and sets a session cookie", async () => {
    const { getUserRepository } = await import("@/lib/authentication/userRepository");
    const { hashPassword } = await import("@/lib/authentication/passwordHash");
    const { SESSION_COOKIE_NAME } = await import("@/lib/authentication/cookies");
    const { POST } = await import("@/app/api/v1/auth/login/route");

    const username = `login-user-${randomUUID()}@local`;
    getUserRepository().createUser(username, hashPassword("correct-password"), "admin");

    const res = await POST(jsonReq(`${BASE}/login`, { method: "POST", body: { username, password: "correct-password" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.username).toBe(username.toLowerCase());
    expect(body.user.role).toBe("admin");
    expect(body.user.passwordHash).toBeUndefined();
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBeTruthy();
  });

  it("rejects an unknown username with a generic 401", async () => {
    const { POST } = await import("@/app/api/v1/auth/login/route");
    const res = await POST(jsonReq(`${BASE}/login`, { method: "POST", body: { username: `nobody-${randomUUID()}@local`, password: "whatever1" } }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("E_INVALID_CREDENTIALS");
  });

  it("rejects a wrong password with the same generic 401 (no user enumeration)", async () => {
    const { getUserRepository } = await import("@/lib/authentication/userRepository");
    const { hashPassword } = await import("@/lib/authentication/passwordHash");
    const { POST } = await import("@/app/api/v1/auth/login/route");

    const username = `wrongpass-user-${randomUUID()}@local`;
    getUserRepository().createUser(username, hashPassword("correct-password"), "viewer");

    const res = await POST(jsonReq(`${BASE}/login`, { method: "POST", body: { username, password: "incorrect-password" } }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("E_INVALID_CREDENTIALS");
  });

  it("rejects empty/missing fields with a 400 validation error, not a 500", async () => {
    const { POST } = await import("@/app/api/v1/auth/login/route");
    const res = await POST(jsonReq(`${BASE}/login`, { method: "POST", body: { username: "", password: "" } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("E_VALIDATION");
  });

  it("rejects a malformed JSON body with a 400, not a 500", async () => {
    const { POST } = await import("@/app/api/v1/auth/login/route");
    const req = new NextRequest(`${BASE}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/auth/me and POST /api/v1/auth/logout", () => {
  it("me returns 401 with no cookie, 200 with a valid session, and 401 again after logout", async () => {
    const { getUserRepository } = await import("@/lib/authentication/userRepository");
    const { hashPassword } = await import("@/lib/authentication/passwordHash");
    const { SESSION_COOKIE_NAME } = await import("@/lib/authentication/cookies");
    const { GET: ME } = await import("@/app/api/v1/auth/me/route");
    const { POST: LOGOUT } = await import("@/app/api/v1/auth/logout/route");
    const { POST: LOGIN } = await import("@/app/api/v1/auth/login/route");

    const noCookieRes = await ME(jsonReq(`${BASE}/me`));
    expect(noCookieRes.status).toBe(401);

    const username = `me-user-${randomUUID()}@local`;
    getUserRepository().createUser(username, hashPassword("p@ssword1"), "publisher");
    const loginRes = await LOGIN(jsonReq(`${BASE}/login`, { method: "POST", body: { username, password: "p@ssword1" } }));
    const token = loginRes.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(token).toBeTruthy();

    const meRes = await ME(jsonReq(`${BASE}/me`, { cookie: `${SESSION_COOKIE_NAME}=${token}` }));
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.username).toBe(username.toLowerCase());
    expect(meBody.user.role).toBe("publisher");

    await LOGOUT(jsonReq(`${BASE}/logout`, { method: "POST", cookie: `${SESSION_COOKIE_NAME}=${token}` }));

    const meAfterLogoutRes = await ME(jsonReq(`${BASE}/me`, { cookie: `${SESSION_COOKIE_NAME}=${token}` }));
    expect(meAfterLogoutRes.status).toBe(401);
  });
});
