import { NextRequest, NextResponse } from "next/server";
import { resolveActor, requirePermission } from "@/lib/authorization/mockAuth";
import { validateHomeScreenConfiguration } from "@/lib/validation/semanticValidator";
import { getConfigurationRepository } from "@/lib/configuration/repository";
import { checkRateLimit } from "@/lib/publishing/rateLimit";
import { jsonError, handleUnexpected, checkBodySize, SCREEN_KEY } from "@/lib/publishing/apiHelpers";
import type { HomeScreenConfiguration } from "@/types/homeScreen";

const repo = getConfigurationRepository();

/**
 * POST /api/v1/configurations/home/publish
 *
 * Body is optional — if omitted, publishes the current draft. Always
 * re-validates (never trusts a prior /validate call — the draft could have
 * changed since), so this is "validate, then persist" atomically as one
 * operation (docs/architecture-review.md §9).
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "publish");

    if (!checkRateLimit(`publish:${actor.id}`, 10)) {
      return jsonError(429, "E_RATE_LIMITED", "Too many publish attempts — try again shortly.");
    }

    const tooLarge = checkBodySize(req);
    if (tooLarge) return tooLarge;

    let body: HomeScreenConfiguration | null = null;
    try {
      body = (await req.json()) as HomeScreenConfiguration;
    } catch {
      body = null;
    }
    const target = body ?? (await repo.getDraft(SCREEN_KEY))?.content;
    if (!target) {
      return jsonError(400, "E_NO_TARGET", "No body provided and no draft exists to publish.");
    }

    const result = validateHomeScreenConfiguration(target);
    if (!result.valid) {
      await repo.appendAudit({
        screenKey: SCREEN_KEY,
        action: "publish_rejected",
        actor: actor.id,
        role: actor.role,
        detail: `Rejected: ${result.errors.map((e) => e.code).join(", ")}`,
      });
      return NextResponse.json({ published: false, ...result }, { status: 422 });
    }

    const published = await repo.publish(SCREEN_KEY, target, actor.id);
    await repo.appendAudit({
      screenKey: SCREEN_KEY,
      action: "published",
      actor: actor.id,
      role: actor.role,
      detail: `Published revision ${published.revision}.`,
      revision: published.revision,
    });

    return NextResponse.json(
      { published: true, revision: published.revision, etag: published.etag, publishedAt: published.createdAt, warnings: result.warnings },
      { headers: { ETag: published.etag } }
    );
  } catch (err) {
    return handleUnexpected(err);
  }
}
