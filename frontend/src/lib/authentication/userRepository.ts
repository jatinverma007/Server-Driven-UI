/**
 * User persistence — same `@libsql/client` style as
 * `lib/configuration/repository.ts` (async, `@param` binding), against the
 * `User` table added in `lib/db/sqlite.ts`.
 *
 * There is no self-service signup (per the spec: "Users will be manually
 * added to the database") — the only writer is `scripts/create-user.ts`,
 * exposed here as `createUser`.
 */
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/sqlite";
import type { Role } from "@/lib/authorization/mockAuth";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}

/** What's safe to hand back from an API route or put in a session payload —
 * deliberately never includes `passwordHash` (see
 * "Never expose passwords or sensitive authentication details in API
 * responses or logs" in the spec). */
export type PublicUser = Omit<UserRecord, "passwordHash">;

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class UserRepository {
  private db() {
    return getDb();
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const db = await this.db();
    const rs = await db.execute({
      sql: "SELECT id, username, passwordHash, role, createdAt FROM User WHERE username = @username",
      args: { username: normalizeUsername(username) },
    });
    return (rs.rows[0] as unknown as UserRecord | undefined) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const db = await this.db();
    const rs = await db.execute({
      sql: "SELECT id, username, passwordHash, role, createdAt FROM User WHERE id = @id",
      args: { id },
    });
    return (rs.rows[0] as unknown as UserRecord | undefined) ?? null;
  }

  /** Throws (UNIQUE constraint) if the username already exists — surfaced
   * as a friendly message by `scripts/create-user.ts`. */
  async createUser(username: string, passwordHash: string, role: Role): Promise<UserRecord> {
    const db = await this.db();
    const record: UserRecord = {
      id: randomUUID(),
      username: normalizeUsername(username),
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    };
    await db.execute({
      sql: `INSERT INTO User (id, username, passwordHash, role, createdAt)
            VALUES (@id, @username, @passwordHash, @role, @createdAt)`,
      args: { ...record },
    });
    return record;
  }

  /** Used only by `scripts/create-user.ts --update` — resets an existing
   * user's password/role for local testing convenience. Never exposed
   * through an API route (no self-service password change in this PoC). */
  async updateCredentials(id: string, passwordHash: string, role: Role): Promise<void> {
    const db = await this.db();
    await db.execute({
      sql: "UPDATE User SET passwordHash = @passwordHash, role = @role WHERE id = @id",
      args: { id, passwordHash, role },
    });
  }

  async listUsers(): Promise<PublicUser[]> {
    const db = await this.db();
    const rs = await db.execute("SELECT id, username, passwordHash, role, createdAt FROM User ORDER BY createdAt ASC");
    return (rs.rows as unknown as UserRecord[]).map(toPublicUser);
  }
}

let singleton: UserRepository | null = null;
export function getUserRepository(): UserRepository {
  if (!singleton) singleton = new UserRepository();
  return singleton;
}
