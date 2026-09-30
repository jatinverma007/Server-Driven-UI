/**
 * Session persistence — opaque bearer tokens, same hashing convention as
 * `lib/configuration/repository.ts`'s revision `etag` (sha256 of the
 * secret; only the hash is ever persisted). The raw token is set as the
 * session cookie's value (see `cookies.ts`) and never stored server-side,
 * so a leaked database is not itself enough to forge a session.
 */
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/sqlite";
import { getUserRepository, type UserRecord } from "@/lib/authentication/userRepository";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreatedSession {
  token: string; // raw — only ever returned here, at creation time
  expiresAt: Date;
}

export class SessionStore {
  private db() {
    return getDb();
  }

  async create(userId: string): Promise<CreatedSession> {
    const db = await this.db();
    const token = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await db.execute({
      sql: `INSERT INTO Session (id, tokenHash, userId, createdAt, expiresAt)
            VALUES (@id, @tokenHash, @userId, @createdAt, @expiresAt)`,
      args: {
        id: randomUUID(),
        tokenHash: hashToken(token),
        userId,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    });
    return { token, expiresAt };
  }

  /** Validates a raw token and returns its owning user, or `null` if the
   * token is missing, unknown, or expired. Lazily deletes an expired row
   * rather than requiring a separate sweep job — fine at this PoC's scale. */
  async resolveUser(token: string): Promise<UserRecord | null> {
    const db = await this.db();
    const rs = await db.execute({
      sql: "SELECT id, userId, expiresAt FROM Session WHERE tokenHash = @tokenHash",
      args: { tokenHash: hashToken(token) },
    });
    const row = rs.rows[0] as { id: string; userId: string; expiresAt: string } | undefined;
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      await db.execute({ sql: "DELETE FROM Session WHERE id = @id", args: { id: row.id } });
      return null;
    }
    return getUserRepository().findById(row.userId);
  }

  async destroy(token: string): Promise<void> {
    const db = await this.db();
    await db.execute({ sql: "DELETE FROM Session WHERE tokenHash = @tokenHash", args: { tokenHash: hashToken(token) } });
  }

  /** Best-effort cleanup of expired rows — not called on every request;
   * wired into login so the table doesn't grow unbounded over a long-lived
   * dev server. */
  async purgeExpired(): Promise<void> {
    const db = await this.db();
    await db.execute({ sql: "DELETE FROM Session WHERE expiresAt <= @now", args: { now: new Date().toISOString() } });
  }
}

let singleton: SessionStore | null = null;
export function getSessionStore(): SessionStore {
  if (!singleton) singleton = new SessionStore();
  return singleton;
}
