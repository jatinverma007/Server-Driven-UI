/**
 * ConfigurationRepository — the one seam between "how a configuration is
 * persisted" and everything else (API routes, validators, tests). Backed by
 * `@libsql/client` (see `lib/db/sqlite.ts` for why) rather than
 * `@prisma/client` — swapping in the real Prisma client later means writing
 * one new class that implements this interface, same as before.
 *
 * Concurrency / atomicity: `publish` and `restore` each run inside a single
 * libSQL interactive transaction (`client.transaction("write")`) — the
 * revision insert and the published-pointer update commit together or not
 * at all, so a crash mid-publish can never leave "a new revision exists but
 * isn't pointed at" or vice versa (docs/architecture-review.md §9). Every
 * method here is async — network I/O even for a local `file:` database, to
 * keep one code path for both modes — so every call site awaits it.
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
  private db() {
    return getDb();
  }

  async getDraft(screenKey: string): Promise<DraftRecord | null> {
    const db = await this.db();
    const rs = await db.execute({
      sql: "SELECT content, updatedAt, updatedBy FROM DraftConfiguration WHERE screenKey = @screenKey",
      args: { screenKey },
    });
    const row = rs.rows[0] as { content: string; updatedAt: string; updatedBy: string } | undefined;
    if (!row) return null;
    return { screenKey, content: JSON.parse(row.content), updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }

  async saveDraft(screenKey: string, content: HomeScreenConfiguration, actor: string): Promise<DraftRecord> {
    const db = await this.db();
    const now = new Date().toISOString();
    const serialized = JSON.stringify(content);
    await db.execute({
      sql: `INSERT INTO DraftConfiguration (id, screenKey, content, updatedAt, updatedBy)
            VALUES (@id, @screenKey, @content, @updatedAt, @updatedBy)
            ON CONFLICT(screenKey) DO UPDATE SET content = excluded.content, updatedAt = excluded.updatedAt, updatedBy = excluded.updatedBy`,
      args: { id: randomUUID(), screenKey, content: serialized, updatedAt: now, updatedBy: actor },
    });
    return { screenKey, content, updatedAt: now, updatedBy: actor };
  }

  async getPublished(screenKey: string): Promise<PublishedRecord | null> {
    const db = await this.db();
    const rs = await db.execute({
      sql: "SELECT currentRevision FROM PublishedPointer WHERE screenKey = @screenKey",
      args: { screenKey },
    });
    const pointer = rs.rows[0] as { currentRevision: number } | undefined;
    if (!pointer) return null;
    return this.getRevision(screenKey, Number(pointer.currentRevision));
  }

  async getRevision(screenKey: string, revision: number): Promise<PublishedRecord | null> {
    const db = await this.db();
    const rs = await db.execute({
      sql: `SELECT content, etag, createdAt, createdBy, restoredFromRevision
            FROM ConfigurationRevision WHERE screenKey = @screenKey AND revision = @revision`,
      args: { screenKey, revision },
    });
    const row = rs.rows[0] as
      | { content: string; etag: string; createdAt: string; createdBy: string; restoredFromRevision: number | null }
      | undefined;
    if (!row) return null;
    return {
      screenKey,
      revision,
      content: JSON.parse(row.content),
      etag: row.etag,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      restoredFromRevision: row.restoredFromRevision === null ? null : Number(row.restoredFromRevision),
    };
  }

  async listRevisions(screenKey: string): Promise<Array<Omit<PublishedRecord, "content">>> {
    const db = await this.db();
    type Row = { revision: number; etag: string; createdAt: string; createdBy: string; restoredFromRevision: number | null };
    const rs = await db.execute({
      sql: `SELECT revision, etag, createdAt, createdBy, restoredFromRevision
            FROM ConfigurationRevision WHERE screenKey = @screenKey ORDER BY revision DESC`,
      args: { screenKey },
    });
    return (rs.rows as unknown as Row[]).map((r) => ({
      screenKey,
      revision: Number(r.revision),
      etag: r.etag,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
      restoredFromRevision: r.restoredFromRevision === null ? null : Number(r.restoredFromRevision),
    }));
  }

  /** Atomically create a new immutable revision and point "published" at it. */
  async publish(screenKey: string, content: HomeScreenConfiguration, actor: string): Promise<PublishedRecord> {
    const db = await this.db();
    const tx = await db.transaction("write");
    try {
      const maxRs = await tx.execute({
        sql: "SELECT MAX(revision) as maxRevision FROM ConfigurationRevision WHERE screenKey = @screenKey",
        args: { screenKey },
      });
      const maxRow = maxRs.rows[0] as { maxRevision: number | null } | undefined;
      const nextRevision = Number(maxRow?.maxRevision ?? 0) + 1;
      const now = new Date().toISOString();
      const finalContent: HomeScreenConfiguration = {
        ...content,
        revision: nextRevision,
        status: "published",
        publishedAt: now,
        updatedAt: now,
      };
      const serialized = JSON.stringify(finalContent);
      const etag = computeEtag(serialized);

      await tx.execute({
        sql: `INSERT INTO ConfigurationRevision (id, screenKey, revision, content, etag, createdAt, createdBy, restoredFromRevision)
              VALUES (@id, @screenKey, @revision, @content, @etag, @createdAt, @createdBy, NULL)`,
        args: { id: randomUUID(), screenKey, revision: nextRevision, content: serialized, etag, createdAt: now, createdBy: actor },
      });

      await tx.execute({
        sql: `INSERT INTO PublishedPointer (screenKey, currentRevision, updatedAt)
              VALUES (@screenKey, @currentRevision, @updatedAt)
              ON CONFLICT(screenKey) DO UPDATE SET currentRevision = excluded.currentRevision, updatedAt = excluded.updatedAt`,
        args: { screenKey, currentRevision: nextRevision, updatedAt: now },
      });

      await tx.commit();
      return { screenKey, revision: nextRevision, content: finalContent, etag, createdAt: now, createdBy: actor, restoredFromRevision: null };
    } catch (err) {
      await tx.rollback();
      throw err;
    } finally {
      tx.close();
    }
  }

  /** Rollback = a NEW revision that copies an older one's content. History
   * is append-only and monotonic — never a destructive pointer rewind
   * (docs/architecture-review.md §9). */
  async restore(screenKey: string, fromRevision: number, actor: string): Promise<PublishedRecord | null> {
    const source = await this.getRevision(screenKey, fromRevision);
    if (!source) return null;
    const db = await this.db();
    const tx = await db.transaction("write");
    try {
      const maxRs = await tx.execute({
        sql: "SELECT MAX(revision) as maxRevision FROM ConfigurationRevision WHERE screenKey = @screenKey",
        args: { screenKey },
      });
      const maxRow = maxRs.rows[0] as { maxRevision: number | null } | undefined;
      const nextRevision = Number(maxRow?.maxRevision ?? 0) + 1;
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

      await tx.execute({
        sql: `INSERT INTO ConfigurationRevision (id, screenKey, revision, content, etag, createdAt, createdBy, restoredFromRevision)
              VALUES (@id, @screenKey, @revision, @content, @etag, @createdAt, @createdBy, @restoredFromRevision)`,
        args: {
          id: randomUUID(),
          screenKey,
          revision: nextRevision,
          content: serialized,
          etag,
          createdAt: now,
          createdBy: actor,
          restoredFromRevision: fromRevision,
        },
      });

      await tx.execute({
        sql: `INSERT INTO PublishedPointer (screenKey, currentRevision, updatedAt)
              VALUES (@screenKey, @currentRevision, @updatedAt)
              ON CONFLICT(screenKey) DO UPDATE SET currentRevision = excluded.currentRevision, updatedAt = excluded.updatedAt`,
        args: { screenKey, currentRevision: nextRevision, updatedAt: now },
      });

      await tx.commit();
      return { screenKey, revision: nextRevision, content: finalContent, etag, createdAt: now, createdBy: actor, restoredFromRevision: fromRevision };
    } catch (err) {
      await tx.rollback();
      throw err;
    } finally {
      tx.close();
    }
  }

  async appendAudit(entry: AuditEntry): Promise<void> {
    const db = await this.db();
    await db.execute({
      sql: `INSERT INTO AuditLogEntry (id, screenKey, action, actor, role, detail, revision, createdAt)
            VALUES (@id, @screenKey, @action, @actor, @role, @detail, @revision, @createdAt)`,
      args: {
        id: randomUUID(),
        screenKey: entry.screenKey,
        action: entry.action,
        actor: entry.actor,
        role: entry.role,
        detail: entry.detail,
        revision: entry.revision ?? null,
        createdAt: new Date().toISOString(),
      },
    });
  }

  async listAudit(screenKey: string, limit = 50) {
    const db = await this.db();
    const rs = await db.execute({
      sql: `SELECT action, actor, role, detail, revision, createdAt FROM AuditLogEntry
            WHERE screenKey = @screenKey ORDER BY createdAt DESC LIMIT @limit`,
      args: { screenKey, limit },
    });
    return rs.rows;
  }
}

let singleton: ConfigurationRepository | null = null;
export function getConfigurationRepository(): ConfigurationRepository {
  if (!singleton) singleton = new ConfigurationRepository();
  return singleton;
}
