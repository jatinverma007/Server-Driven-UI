/**
 * Persistence — libSQL connection and schema bootstrap.
 *
 * WHY LIBSQL (not raw better-sqlite3 anymore): the original PoC used
 * better-sqlite3 directly against a local file, which works great for local
 * dev but cannot run on a serverless host like Vercel — those give a
 * function a read-only filesystem outside `/tmp`, and `/tmp` isn't shared
 * across instances or kept between cold starts, so a local SQLite file
 * there silently loses writes (Vercel's own docs: SQLite isn't supported).
 * `@libsql/client` solves this with ONE client API that works two ways,
 * selected purely by `DATABASE_URL`:
 *   - `file:./dev.db` (local dev, unchanged from before) — same embedded
 *     SQLite engine, same file on disk, works exactly as it always did.
 *   - `libsql://<db>-<org>.turso.io` + `TURSO_AUTH_TOKEN` (production) — a
 *     real hosted SQLite database reached over HTTP, so it works from any
 *     stateless serverless function. See docs/runbook.md for setup.
 * Nothing outside this file's `getDb()` needs to know or care which mode is
 * active — same "one seam" shape as the old file, now genuinely portable
 * instead of documenting a Postgres swap it never got.
 *
 * The client's calls are all async (network I/O, even for the local `file:`
 * case, to keep one code path) — every caller through `lib/configuration/
 * repository.ts` and `lib/authentication/*.ts` awaits them.
 */
import { createClient, type Client } from "@libsql/client";

function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "file:./dev.db";
}

declare global {
  var __sdui_db__: Client | undefined;
  var __sdui_db_bootstrap__: Promise<void> | undefined;
}

function createConnection(): Client {
  const url = resolveDatabaseUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
  // authToken is simply ignored by the client for a local `file:` URL —
  // only the remote `libsql://` protocol uses it — so it's safe to always
  // pass it through rather than branching on URL shape here.
  return createClient({ url, authToken });
}

const BOOTSTRAP_SQL = `
  CREATE TABLE IF NOT EXISTS DraftConfiguration (
    id         TEXT PRIMARY KEY,
    screenKey  TEXT NOT NULL UNIQUE,
    content    TEXT NOT NULL,
    updatedAt  TEXT NOT NULL,
    updatedBy  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ConfigurationRevision (
    id                    TEXT PRIMARY KEY,
    screenKey             TEXT NOT NULL,
    revision              INTEGER NOT NULL,
    content               TEXT NOT NULL,
    etag                  TEXT NOT NULL,
    createdAt             TEXT NOT NULL,
    createdBy             TEXT NOT NULL,
    restoredFromRevision  INTEGER,
    UNIQUE(screenKey, revision)
  );
  CREATE INDEX IF NOT EXISTS idx_revision_screenKey ON ConfigurationRevision(screenKey);

  CREATE TABLE IF NOT EXISTS PublishedPointer (
    screenKey        TEXT PRIMARY KEY,
    currentRevision  INTEGER NOT NULL,
    updatedAt        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS AuditLogEntry (
    id         TEXT PRIMARY KEY,
    screenKey  TEXT NOT NULL,
    action     TEXT NOT NULL,
    actor      TEXT NOT NULL,
    role       TEXT NOT NULL,
    detail     TEXT NOT NULL,
    revision   INTEGER,
    createdAt  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_audit_screenKey_createdAt ON AuditLogEntry(screenKey, createdAt);

  -- Authentication: manually-provisioned users (see scripts/create-user.ts)
  -- and their server-side sessions. passwordHash is "scrypt:<saltHex>:<hashHex>"
  -- (see lib/authentication/passwordHash.ts) — never a plaintext password.
  CREATE TABLE IF NOT EXISTS User (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE, -- stored lowercase; may be an email
    passwordHash  TEXT NOT NULL,
    role          TEXT NOT NULL, -- viewer | editor | publisher | admin (mockAuth.Role)
    createdAt     TEXT NOT NULL
  );

  -- Sessions are looked up by the SHA-256 hash of the opaque bearer token
  -- carried in the session cookie (see lib/authentication/session.ts) — the
  -- raw token itself is never persisted, mirroring ConfigurationRevision's
  -- etag-hashing convention above.
  CREATE TABLE IF NOT EXISTS Session (
    id          TEXT PRIMARY KEY,
    tokenHash   TEXT NOT NULL UNIQUE,
    userId      TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
    createdAt   TEXT NOT NULL,
    expiresAt   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_session_userId ON Session(userId);
`;

/** Process-wide singleton (cached on `global` so Next.js dev-mode hot
 * reloads don't open a new connection per reload, matching the standard
 * Prisma-in-Next.js singleton pattern) — bootstrap also runs exactly once
 * per process, its promise cached alongside the client so concurrent
 * first-callers all await the same run instead of racing `CREATE TABLE`s. */
export async function getDb(): Promise<Client> {
  if (!global.__sdui_db__) {
    global.__sdui_db__ = createConnection();
  }
  if (!global.__sdui_db_bootstrap__) {
    global.__sdui_db_bootstrap__ = global.__sdui_db__.executeMultiple(BOOTSTRAP_SQL);
  }
  await global.__sdui_db_bootstrap__;
  return global.__sdui_db__;
}
