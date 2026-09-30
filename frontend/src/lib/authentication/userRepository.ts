/**
 * User persistence — same raw-SQL/`better-sqlite3` style as
 * `lib/configuration/repository.ts` (prepared statements, `@param`
 * binding), against the `User` table added in `lib/db/sqlite.ts`.
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
  private get db() {
    return getDb();
  }

  findByUsername(username: string): UserRecord | null {
    const row = this.db
      .prepare<{ username: string }, UserRecord>(
        "SELECT id, username, passwordHash, role, createdAt FROM User WHERE username = @username"
      )
      .get({ username: normalizeUsername(username) });
    return row ?? null;
  }

  findById(id: string): UserRecord | null {
    const row = this.db
      .prepare<{ id: string }, UserRecord>(
        "SELECT id, username, passwordHash, role, createdAt FROM User WHERE id = @id"
      )
      .get({ id });
    return row ?? null;
  }

  /** Throws (UNIQUE constraint) if the username already exists — surfaced
   * as a friendly message by `scripts/create-user.ts`. */
  createUser(username: string, passwordHash: string, role: Role): UserRecord {
    const record: UserRecord = {
      id: randomUUID(),
      username: normalizeUsername(username),
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO User (id, username, passwordHash, role, createdAt)
         VALUES (@id, @username, @passwordHash, @role, @createdAt)`
      )
      .run(record);
    return record;
  }

  /** Used only by `scripts/create-user.ts --update` — resets an existing
   * user's password/role for local testing convenience. Never exposed
   * through an API route (no self-service password change in this PoC). */
  updateCredentials(id: string, passwordHash: string, role: Role): void {
    this.db
      .prepare("UPDATE User SET passwordHash = @passwordHash, role = @role WHERE id = @id")
      .run({ id, passwordHash, role });
  }

  listUsers(): PublicUser[] {
    const rows = this.db
      .prepare<[], UserRecord>("SELECT id, username, passwordHash, role, createdAt FROM User ORDER BY createdAt ASC")
      .all() as UserRecord[];
    return rows.map(toPublicUser);
  }
}

let singleton: UserRepository | null = null;
export function getUserRepository(): UserRepository {
  if (!singleton) singleton = new UserRepository();
  return singleton;
}
