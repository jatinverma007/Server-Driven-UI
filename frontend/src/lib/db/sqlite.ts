/**
 * Persistence — SQLite connection and schema bootstrap.
 *
 * PRODUCTION / NORMAL-NETWORK PATH: `prisma/schema.prisma` is the
 * authoritative model definition. On any machine with normal internet
 * access, `npm run db:generate` fetches Prisma's query/schema engines and
 * produces a typed `@prisma/client`; `npm run db:push` applies the schema.
 * `docs/runbook.md` § "Swapping in real Prisma Client" shows the ~10-line
 * change to `repository.ts` that swaps the implementation below for
 * `PrismaClient` + `@prisma/adapter-better-sqlite3` (already a declared
 * dependency) — the `ConfigurationRepository` interface does not change, so
 * no call site elsewhere in the app changes either.
 *
 * THIS SANDBOX: the build/verification environment this PoC was assembled
 * in blocks outbound access to `binaries.prisma.sh` at the network-policy
 * level (403 on CONNECT — not a missing-file or checksum issue, see
 * docs/runbook.md § "Known limitation: Prisma engine download"), so
 * `prisma generate`/`db push` cannot run here. This file instead opens the
 * same SQLite database directly with `better-sqlite3` (already a declared
 * dependency, ships prebuilt native binaries via npm — no blocked host
 * involved) and creates the identical tables `prisma/schema.prisma`
 * describes. Application code never imports this file directly; it only
 * goes through `lib/configuration/repository.ts`.
 */
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

function resolveDatabasePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const filePart = url.startsWith("file:") ? url.slice("file:".length) : url;
  return path.resolve(process.cwd(), filePart);
}

declare global {
  var __sdui_db__: Database.Database | undefined;
}

function createConnection(): Database.Database {
  const dbPath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  bootstrap(db);
  return db;
}

function bootstrap(db: Database.Database): void {
  db.exec(`
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
  `);
}

/** Process-wide singleton (cached on `global` so Next.js dev-mode hot
 * reloads don't open a new connection per reload, matching the standard
 * Prisma-in-Next.js singleton pattern). */
export function getDb(): Database.Database {
  if (!global.__sdui_db__) {
    global.__sdui_db__ = createConnection();
  }
  return global.__sdui_db__;
}
