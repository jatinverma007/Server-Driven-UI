/**
 * ConfigurationRepository — the one seam between "how a configuration is
 * persisted" and everything else (API routes, validators, tests). Swapping
 * SQLite for Postgres, or this better-sqlite3 implementation for real
 * `@prisma/client`, means writing one new class that implements this
 * interface — see docs/runbook.md § "Swapping in real Prisma Client".
 *
 * Concurrency / atomicity: `publish` and `restore` each run inside a single
 * better-sqlite3 `db.transaction(...)` — the revision insert and the
 * published-pointer update commit together or not at all, so a crash
 * mid-publish can never leave "a new revision exists but isn't pointed at"
 * or vice versa (docs/architecture-review.md §9).
 */
import { randomUUID, createHash } from "node:crypto";
import { getDb } from "@/lib/db/sqlite";
import type { HomeScreenConfiguration } from "@/types/homeScreen";

export interface AuditEntry {
  screenKey: string;
  action: "draft_saved" | "validated" | "publish_rejected" | "published" | "restored";
  actor: string;
  role: string;
  detail: string;
  revision?: number;
}

export interface PublishedRecord {
  screenKey: string;
  revision: number;
  content: HomeScreenConfiguration;
  etag: string;
  createdAt: string;
  createdBy: string;
  restoredFromRevision: number | null;
}

export interface DraftRecord {
  screenKey: string;
  content: HomeScreenConfiguration;
  updatedAt: string;
  updatedBy: string;
}

function computeEtag(content: string): string {
  return `"${createHash("sha256").update(content).digest("hex").slice(0, 32)}"`;
}

export class ConfigurationRepository {
  private get db() {
    return getDb();
  }

  getDraft(screenKey: string): DraftRecord | null {
    const row = this.db
      .prepare<{ screenKey: string }, { content: string; updatedAt: string; updatedBy: string }>(
        "SELECT content, updatedAt, updatedBy FROM DraftConfiguration WHERE screenKey = @screenKey"
      )
      .get({ screenKey });
    if (!row) return null;
    return { screenKey, content: JSON.parse(row.content), updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }

  saveDraft(screenKey: string, content: HomeScreenConfiguration, actor: string): DraftRecord {
    const now = new Date().toISOString();
    const serialized = JSON.stringify(content);
    this.db
      .prepare(
        `INSERT INTO DraftConfiguration (id, screenKey, content, updatedAt, updatedBy)
         VALUES (@id, @screenKey, @content, @updatedAt, @updatedBy)
         ON CONFLICT(screenKey) DO UPDATE SET content = excluded.content, updatedAt = excluded.updatedAt, updatedBy = excluded.updatedBy`
      )
      .run({ id: randomUUID(), screenKey, content: serialized, updatedAt: now, updatedBy: actor });
    return { screenKey, content, updatedAt: now, updatedBy: actor };
  }

  getPublished(screenKey: string): PublishedRecord | null {
    const pointer = this.db
      .prepare<{ screenKey: string }, { currentRevision: number }>(
        "SELECT currentRevision FROM PublishedPointer WHERE screenKey = @screenKey"
      )
      .get({ screenKey });
    if (!pointer) return null;
    return this.getRevision(screenKey, pointer.currentRevision);
  }

  getRevision(screenKey: string, revision: number): PublishedRecord | null {
    const row = this.db
      .prepare<
        { screenKey: string; revision: number },
        { content: string; etag: string; createdAt: string; createdBy: string; restoredFromRevision: number | null }
      >(
        `SELECT content, etag, createdAt, createdBy, restoredFromRevision
         FROM ConfigurationRevision WHERE screenKey = @screenKey AND revision = @revision`
      )
      .get({ screenKey, revision });
    if (!row) return null;
    return {
      screenKey,
      revision,
      content: JSON.parse(row.content),
      etag: row.etag,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      restoredFromRevision: row.restoredFromRevision,
    };
  }

  listRevisions(screenKey: string): Array<Omit<PublishedRecord, "content">> {
    type Row = { revision: number; etag: string; createdAt: string; createdBy: string; restoredFromRevision: number | null };
    const rows = this.db
      .prepare<{ screenKey: string }, Row>(
        `SELECT revision, etag, createdAt, createdBy, restoredFromRevision
         FROM ConfigurationRevision WHERE screenKey = @screenKey ORDER BY revision DESC`
      )
      .all({ screenKey }) as Row[];
    return rows.map((r) => ({ screenKey, ...r }));
  }

  /** Atomically create a new immutable revision and point "published" at it. */
  publish(screenKey: string, content: HomeScreenConfiguration, actor: string): PublishedRecord {
    const run = this.db.transaction((c: HomeScreenConfiguration) => {
      const maxRow = this.db
        .prepare<{ screenKey: string }, { maxRevision: number | null }>(
          "SELECT MAX(revision) as maxRevision FROM ConfigurationRevision WHERE screenKey = @screenKey"
        )
        .get({ screenKey });
      const nextRevision = (maxRow?.maxRevision ?? 0) + 1;
      const now = new Date().toISOString();
      const finalContent: HomeScreenConfiguration = {
        ...c,
        revision: nextRevision,
        status: "published",
        publishedAt: now,
        updatedAt: now,
      };
      const serialized = JSON.stringify(finalContent);
      const etag = computeEtag(serialized);

      this.db
        .prepare(
          `INSERT INTO ConfigurationRevision (id, screenKey, revision, content, etag, createdAt, createdBy, restoredFromRevision)
           VALUES (@id, @screenKey, @revision, @content, @etag, @createdAt, @createdBy, NULL)`
        )
        .run({ id: randomUUID(), screenKey, revision: nextRevision, content: serialized, etag, createdAt: now, createdBy: actor });

      this.db
        .prepare(
          `INSERT INTO PublishedPointer (screenKey, currentRevision, updatedAt)
           VALUES (@screenKey, @currentRevision, @updatedAt)
           ON CONFLICT(screenKey) DO UPDATE SET currentRevision = excluded.currentRevision, updatedAt = excluded.updatedAt`
        )
        .run({ screenKey, currentRevision: nextRevision, updatedAt: now });

      return { screenKey, revision: nextRevision, content: finalContent, etag, createdAt: now, createdBy: actor, restoredFromRevision: null };
    });
    return run(content);
  }

  /** Rollback = a NEW revision that copies an older one's content. History
   * is append-only and monotonic — never a destructive pointer rewind
   * (docs/architecture-review.md §9). */
  restore(screenKey: string, fromRevision: number, actor: string): PublishedRecord | null {
    const source = this.getRevision(screenKey, fromRevision);
    if (!source) return null;
    const run = this.db.transaction(() => {
      const maxRow = this.db
        .prepare<{ screenKey: string }, { maxRevision: number | null }>(
          "SELECT MAX(revision) as maxRevision FROM ConfigurationRevision WHERE screenKey = @screenKey"
        )
        .get({ screenKey });
      const nextRevision = (maxRow?.maxRevision ?? 0) + 1;
      const now = new Date().toISOString();
      const finalContent: HomeScreenConfiguration = {
        ...source.content,
        revision: nextRevision,
        status: "published",
        publishedAt: now,
        updatedAt: now,
      };
      const serialized = JSON.stringify(finalContent);
      const etag = computeEtag(serialized);

      this.db
        .prepare(
          `INSERT INTO ConfigurationRevision (id, screenKey, revision, content, etag, createdAt, createdBy, restoredFromRevision)
           VALUES (@id, @screenKey, @revision, @content, @etag, @createdAt, @createdBy, @restoredFromRevision)`
        )
        .run({
          id: randomUUID(),
          screenKey,
          revision: nextRevision,
          content: serialized,
          etag,
          createdAt: now,
          createdBy: actor,
          restoredFromRevision: fromRevision,
        });

      this.db
        .prepare(
          `INSERT INTO PublishedPointer (screenKey, currentRevision, updatedAt)
           VALUES (@screenKey, @currentRevision, @updatedAt)
           ON CONFLICT(screenKey) DO UPDATE SET currentRevision = excluded.currentRevision, updatedAt = excluded.updatedAt`
        )
        .run({ screenKey, currentRevision: nextRevision, updatedAt: now });

      return { screenKey, revision: nextRevision, content: finalContent, etag, createdAt: now, createdBy: actor, restoredFromRevision: fromRevision };
    });
    return run();
  }

  appendAudit(entry: AuditEntry): void {
    this.db
      .prepare(
        `INSERT INTO AuditLogEntry (id, screenKey, action, actor, role, detail, revision, createdAt)
         VALUES (@id, @screenKey, @action, @actor, @role, @detail, @revision, @createdAt)`
      )
      .run({
        id: randomUUID(),
        screenKey: entry.screenKey,
        action: entry.action,
        actor: entry.actor,
        role: entry.role,
        detail: entry.detail,
        revision: entry.revision ?? null,
        createdAt: new Date().toISOString(),
      });
  }

  listAudit(screenKey: string, limit = 50) {
    return this.db
      .prepare(
        `SELECT action, actor, role, detail, revision, createdAt FROM AuditLogEntry
         WHERE screenKey = @screenKey ORDER BY createdAt DESC LIMIT @limit`
      )
      .all({ screenKey, limit });
  }
}

let singleton: ConfigurationRepository | null = null;
export function getConfigurationRepository(): ConfigurationRepository {
  if (!singleton) singleton = new ConfigurationRepository();
  return singleton;
}
