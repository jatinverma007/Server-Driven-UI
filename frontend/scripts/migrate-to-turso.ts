/**
 * One-off migration: copy configuration data (drafts, published revision
 * history, audit log) from the local dev.db (SQLite file used by
 * `npm run dev`) into a remote Turso database — so the widgets/themes/nav
 * built and tested on localhost show up in the deployed (Vercel + Turso)
 * portal too.
 *
 * Deliberately does NOT touch User or Session — those already exist in
 * Turso (see scripts/create-user.ts) and this script must never disturb an
 * existing account or an active login.
 *
 * Run with the DESTINATION Turso credentials as env vars, same pattern as
 * create-user.ts:
 *
 *   cd frontend
 *   DATABASE_URL="libsql://<db>-<org>.turso.io" \
 *   TURSO_AUTH_TOKEN="<token from the Turso dashboard>" \
 *   npm run migrate-to-turso
 *
 * Safe to re-run: every write is idempotent —
 *   - DraftConfiguration / PublishedPointer (single row per screen) are
 *     upserted to match local (that's the point: make prod match local).
 *   - ConfigurationRevision / AuditLogEntry (append-only history) use
 *     INSERT OR IGNORE, so re-running never duplicates or clobbers rows
 *     already migrated.
 */
import { createClient, type InStatement } from "@libsql/client";

const DEST_BOOTSTRAP_SQL = `
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
`;

async function main() {
  const destUrl = process.env.DATABASE_URL;
  const destToken = process.env.TURSO_AUTH_TOKEN;

  if (!destUrl || !destUrl.startsWith("libsql://")) {
    console.error("Error: DATABASE_URL must be set to a libsql:// URL (the destination Turso database).");
    console.error('Usage: DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run migrate-to-turso');
    process.exit(1);
  }
  if (!destToken) {
    console.error("Error: TURSO_AUTH_TOKEN must be set.");
    process.exit(1);
  }

  const source = createClient({ url: "file:./dev.db" });
  const dest = createClient({ url: destUrl, authToken: destToken });

  console.log(`Source: file:./dev.db`);
  console.log(`Destination: ${destUrl}\n`);

  await dest.executeMultiple(DEST_BOOTSTRAP_SQL);

  // --- DraftConfiguration (single mutable row per screen — upsert) ---
  const drafts = await source.execute("SELECT * FROM DraftConfiguration");
  for (const row of drafts.rows) {
    await dest.execute({
      sql: `INSERT INTO DraftConfiguration (id, screenKey, content, updatedAt, updatedBy)
            VALUES (@id, @screenKey, @content, @updatedAt, @updatedBy)
            ON CONFLICT(screenKey) DO UPDATE SET
              content = excluded.content,
              updatedAt = excluded.updatedAt,
              updatedBy = excluded.updatedBy`,
      args: {
        id: row.id as string,
        screenKey: row.screenKey as string,
        content: row.content as string,
        updatedAt: row.updatedAt as string,
        updatedBy: row.updatedBy as string,
      },
    });
  }
  console.log(`DraftConfiguration: upserted ${drafts.rows.length} row(s).`);

  // --- ConfigurationRevision (append-only history — insert-or-ignore) ---
  const revisions = await source.execute("SELECT * FROM ConfigurationRevision ORDER BY screenKey, revision");
  if (revisions.rows.length > 0) {
    const statements: InStatement[] = revisions.rows.map((row) => ({
      sql: `INSERT OR IGNORE INTO ConfigurationRevision
              (id, screenKey, revision, content, etag, createdAt, createdBy, restoredFromRevision)
            VALUES (@id, @screenKey, @revision, @content, @etag, @createdAt, @createdBy, @restoredFromRevision)`,
      args: {
        id: row.id as string,
        screenKey: row.screenKey as string,
        revision: row.revision as number,
        content: row.content as string,
        etag: row.etag as string,
        createdAt: row.createdAt as string,
        createdBy: row.createdBy as string,
        restoredFromRevision: (row.restoredFromRevision as number | null) ?? null,
      },
    }));
    await dest.batch(statements, "write");
  }
  console.log(`ConfigurationRevision: migrated ${revisions.rows.length} row(s) (existing rows on the destination were left untouched).`);

  // --- PublishedPointer (single row per screen — upsert to match local) ---
  const pointers = await source.execute("SELECT * FROM PublishedPointer");
  for (const row of pointers.rows) {
    await dest.execute({
      sql: `INSERT INTO PublishedPointer (screenKey, currentRevision, updatedAt)
            VALUES (@screenKey, @currentRevision, @updatedAt)
            ON CONFLICT(screenKey) DO UPDATE SET
              currentRevision = excluded.currentRevision,
              updatedAt = excluded.updatedAt`,
      args: {
        screenKey: row.screenKey as string,
        currentRevision: row.currentRevision as number,
        updatedAt: row.updatedAt as string,
      },
    });
  }
  console.log(`PublishedPointer: upserted ${pointers.rows.length} row(s).`);

  // --- AuditLogEntry (append-only history — insert-or-ignore) ---
  const audits = await source.execute("SELECT * FROM AuditLogEntry ORDER BY createdAt");
  if (audits.rows.length > 0) {
    const statements: InStatement[] = audits.rows.map((row) => ({
      sql: `INSERT OR IGNORE INTO AuditLogEntry
              (id, screenKey, action, actor, role, detail, revision, createdAt)
            VALUES (@id, @screenKey, @action, @actor, @role, @detail, @revision, @createdAt)`,
      args: {
        id: row.id as string,
        screenKey: row.screenKey as string,
        action: row.action as string,
        actor: row.actor as string,
        role: row.role as string,
        detail: row.detail as string,
        revision: (row.revision as number | null) ?? null,
        createdAt: row.createdAt as string,
      },
    }));
    // Turso caps batch size generously, but chunk defensively for very large logs.
    const CHUNK = 200;
    for (let i = 0; i < statements.length; i += CHUNK) {
      await dest.batch(statements.slice(i, i + CHUNK), "write");
    }
  }
  console.log(`AuditLogEntry: migrated ${audits.rows.length} row(s) (existing rows on the destination were left untouched).`);

  console.log("\nDone. User/Session were not touched — your existing login is untouched.");

  source.close();
  dest.close();
}

main().catch((err) => {
  console.error("\nMigration failed:", err);
  process.exit(1);
});
