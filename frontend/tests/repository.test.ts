import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";

beforeAll(() => {
  // Isolated DB file for this test file, set before any getDb() call (the
  // connection is opened lazily — see src/lib/db/sqlite.ts).
  process.env.DATABASE_URL = `file:./tests/tmp/repo-${randomUUID()}.db`;
});

describe("ConfigurationRepository", () => {
  it("publish creates an immutable revision and atomically moves the published pointer", async () => {
    const { getConfigurationRepository } = await import("@/lib/configuration/repository");
    const { baseConfig } = await import("./fixtures");
    const repo = getConfigurationRepository();
    const screenKey = `screen-${randomUUID()}`;

    expect(await repo.getPublished(screenKey)).toBeNull();

    const cfg = baseConfig();
    const rev1 = await repo.publish(screenKey, cfg, "tester");
    expect(rev1.revision).toBe(1);
    expect((await repo.getPublished(screenKey))?.revision).toBe(1);

    const rev2 = await repo.publish(screenKey, cfg, "tester");
    expect(rev2.revision).toBe(2);
    expect((await repo.getPublished(screenKey))?.revision).toBe(2);

    // Revision 1 is still readable, unchanged, by direct lookup (immutability).
    expect((await repo.getRevision(screenKey, 1))?.revision).toBe(1);

    const history = await repo.listRevisions(screenKey);
    expect(history.map((r) => r.revision)).toEqual([2, 1]);
  });

  it("restore creates a NEW revision copying an old one rather than rewinding the pointer", async () => {
    const { getConfigurationRepository } = await import("@/lib/configuration/repository");
    const { baseConfig } = await import("./fixtures");
    const repo = getConfigurationRepository();
    const screenKey = `screen-${randomUUID()}`;

    const cfgV1 = baseConfig();
    await repo.publish(screenKey, cfgV1, "tester"); // revision 1

    const cfgV2 = baseConfig();
    cfgV2.screens[0].title = "Home v2";
    await repo.publish(screenKey, cfgV2, "tester"); // revision 2

    const restored = await repo.restore(screenKey, 1, "tester");
    expect(restored?.revision).toBe(3); // NOT 1 — append-only
    expect(restored?.restoredFromRevision).toBe(1);
    expect(restored?.content.screens[0].title).toBe("Home"); // content copied from revision 1

    expect((await repo.getPublished(screenKey))?.revision).toBe(3);
    // Revision 1 and 2 both still exist, untouched.
    expect(await repo.getRevision(screenKey, 1)).not.toBeNull();
    expect((await repo.getRevision(screenKey, 2))?.content.screens[0].title).toBe("Home v2");
  });

  it("restoring a non-existent revision returns null and does not touch the published pointer", async () => {
    const { getConfigurationRepository } = await import("@/lib/configuration/repository");
    const { baseConfig } = await import("./fixtures");
    const repo = getConfigurationRepository();
    const screenKey = `screen-${randomUUID()}`;
    await repo.publish(screenKey, baseConfig(), "tester");

    const result = await repo.restore(screenKey, 999, "tester");
    expect(result).toBeNull();
    expect((await repo.getPublished(screenKey))?.revision).toBe(1);
  });

  it("draft save/read round-trips and is never returned by getPublished", async () => {
    const { getConfigurationRepository } = await import("@/lib/configuration/repository");
    const { baseConfig } = await import("./fixtures");
    const repo = getConfigurationRepository();
    const screenKey = `screen-${randomUUID()}`;

    const cfg = baseConfig();
    cfg.screens[0].title = "Draft Title";
    await repo.saveDraft(screenKey, cfg, "editor@local");

    expect((await repo.getDraft(screenKey))?.content.screens[0].title).toBe("Draft Title");
    expect(await repo.getPublished(screenKey)).toBeNull(); // draft never leaks into published

    // Saving again overwrites in place (no history kept for drafts).
    const cfg2 = baseConfig();
    cfg2.screens[0].title = "Draft Title 2";
    await repo.saveDraft(screenKey, cfg2, "editor@local");
    expect((await repo.getDraft(screenKey))?.content.screens[0].title).toBe("Draft Title 2");
  });

  it("audit log records publish/restore/draft actions", async () => {
    const { getConfigurationRepository } = await import("@/lib/configuration/repository");
    const { baseConfig } = await import("./fixtures");
    const repo = getConfigurationRepository();
    const screenKey = `screen-${randomUUID()}`;

    await repo.saveDraft(screenKey, baseConfig(), "editor@local");
    await repo.appendAudit({ screenKey, action: "draft_saved", actor: "editor@local", role: "editor", detail: "test" });
    await repo.publish(screenKey, baseConfig(), "publisher@local");
    await repo.appendAudit({ screenKey, action: "published", actor: "publisher@local", role: "publisher", detail: "test", revision: 1 });

    const entries = (await repo.listAudit(screenKey)) as Array<{ action: string }>;
    expect(entries.map((e) => e.action)).toEqual(["published", "draft_saved"]);
  });
});
