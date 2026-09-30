/**
 * Seeds the local database with the normalized home-screen JSON produced in
 * Phase 1. Run with `npm run db:seed`. Idempotent — safe to re-run.
 *
 * Uses the repository module directly (not a raw Prisma client — see
 * src/lib/db/sqlite.ts header for why) so the seeded rows go through the
 * exact same code path as a real publish.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { getConfigurationRepository } from "../src/lib/configuration/repository";
import { validateHomeScreenConfiguration } from "../src/lib/validation/semanticValidator";
import type { HomeScreenConfiguration } from "../src/types/homeScreen";

const SCREEN_KEY = "home";
const SEED_ACTOR = "seed-script";

function loadFixture(name: string): HomeScreenConfiguration {
  const p = path.resolve(__dirname, "..", "src", "schema", "examples", name);
  return JSON.parse(readFileSync(p, "utf8"));
}

async function main() {
  const repo = getConfigurationRepository();
  const seed = loadFixture("home-screen.valid.json");

  const validation = validateHomeScreenConfiguration(seed);
  if (!validation.valid) {
    console.error("Seed fixture failed validation — refusing to seed:");
    console.error(JSON.stringify(validation.errors, null, 2));
    process.exit(1);
  }

  // Draft: same content, marked as draft, so the portal has something to edit immediately.
  await repo.saveDraft(SCREEN_KEY, { ...seed, status: "draft" }, SEED_ACTOR);
  await repo.appendAudit({ screenKey: SCREEN_KEY, action: "draft_saved", actor: SEED_ACTOR, role: "admin", detail: "Seeded initial draft." });

  // Published revision 1.
  const existing = await repo.getPublished(SCREEN_KEY);
  if (existing) {
    console.log(`Published revision already exists (revision ${existing.revision}) — skipping publish, draft re-seeded.`);
    return;
  }
  const published = await repo.publish(SCREEN_KEY, seed, SEED_ACTOR);
  await repo.appendAudit({
    screenKey: SCREEN_KEY,
    action: "published",
    actor: SEED_ACTOR,
    role: "admin",
    detail: `Seeded published revision ${published.revision}.`,
    revision: published.revision,
  });
  console.log(`Seeded draft + published revision ${published.revision} (etag ${published.etag}).`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
