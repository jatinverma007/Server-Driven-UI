/**
 * Password hashing — Node's built-in `crypto.scrypt`, no new dependency
 * (per the "avoid unnecessary dependencies unless already used by the
 * project" requirement; nothing in package.json already provides bcrypt/
 * argon2, and Node's scrypt is a CPU/memory-hard KDF suitable for password
 * storage).
 *
 * Stored format: `scrypt:<saltHex>:<hashHex>` — a single self-describing
 * string so the algorithm can change later without a migration step for
 * existing rows (a differently-prefixed hash would just fail to verify).
 * Never log or return this value — see `userRepository.ts`'s `PublicUser`,
 * which deliberately omits it from every value handed back to a route.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(plain, salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Constant-time compare via `timingSafeEqual` — never a plain `===` on
 * derived key bytes, which would leak timing information about how many
 * leading bytes matched. */
export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const saltHex = parts[1] ?? "";
  const hashHex = parts[2] ?? "";
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(plain, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    // Malformed stored hash (wrong hex, wrong length, etc.) — never throw
    // out of a login attempt; treat it as a non-match.
    return false;
  }
}
