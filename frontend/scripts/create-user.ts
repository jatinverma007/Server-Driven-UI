/**
 * Manually provision a portal user — there is no self-service signup by
 * design (see the auth spec: "Users will be manually added to the
 * database"). Run with:
 *
 *   npm run create-user -- <username-or-email> <password> <role> [--update]
 *
 * <role> is one of: viewer | editor | publisher | admin (lib/authorization/mockAuth.Role).
 * --update resets the password/role of an existing user instead of failing
 * on a duplicate username — handy for local testing.
 *
 * Mirrors prisma/seed.ts's pattern (a `tsx`-run script going through the
 * app's own repository layer, never raw SQL) — the password is hashed here
 * with the same `hashPassword()` the login route verifies against, so a
 * hand-written INSERT can't accidentally produce a hash the app can't
 * check.
 */
import { getUserRepository } from "../src/lib/authentication/userRepository";
import { hashPassword } from "../src/lib/authentication/passwordHash";
import type { Role } from "../src/lib/authorization/mockAuth";

const KNOWN_ROLES: Role[] = ["viewer", "editor", "publisher", "admin"];

function usageAndExit(message?: string): never {
  if (message) console.error(`Error: ${message}\n`);
  console.error("Usage: npm run create-user -- <username-or-email> <password> <role> [--update]");
  console.error(`  <role> must be one of: ${KNOWN_ROLES.join(", ")}`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--update");
  const update = process.argv.includes("--update");
  const [username, password, role] = args;

  if (!username || !password || !role) usageAndExit("username, password, and role are all required.");
  if (!KNOWN_ROLES.includes(role as Role)) usageAndExit(`"${role}" is not a known role.`);
  if (password.length < 8) usageAndExit("password must be at least 8 characters.");

  const repo = getUserRepository();
  const existing = await repo.findByUsername(username);
  const passwordHash = hashPassword(password);

  if (existing) {
    if (!update) {
      usageAndExit(`A user "${username}" already exists. Pass --update to reset their password/role.`);
    }
    await repo.updateCredentials(existing.id, passwordHash, role as Role);
    console.log(`Updated user "${username}" (role: ${role}).`);
    return;
  }

  const created = await repo.createUser(username, passwordHash, role as Role);
  console.log(`Created user "${created.username}" (role: ${created.role}, id: ${created.id}).`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
