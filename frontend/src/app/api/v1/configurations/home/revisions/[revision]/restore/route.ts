import { NextRequest, NextResponse } from "next/server";
import { getConfigurationRepository } from "@/lib/configuration/repository";
import { resolveActor, requirePermission } from "@/lib/authorization/mockAuth";
import { jsonError, handleUnexpected, SCREEN_KEY } from "@/lib/publishing/apiHelpers";

const repo = getConfigurationRepository();

/**
 * POST /api/v1/configurations/home/revisions/:revision/restore
 *
 * Rollback. Creates a NEW revision copying the target's content (never
 * rewinds the pointer destructively — docs/architecture-review.md §9), so
 * you can always "roll forward" again afterwards.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ revision: string }> }) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "restore");
    const { revision: revisionParam } = await ctx.params;
    const revision = Number.parseInt(revisionParam, 10);
    if (Number.isNaN(revision)) {
      return jsonError(400, "E_INVALID_REVISION", "revision must be an integer.");
    }
    const restored = await repo.restore(SCREEN_KEY, revision, actor.id);
    if (!restored) {
      return jsonError(404, "E_REVISION_NOT_FOUND", `Revision ${revision} does not exist.`);
    }
    await repo.appendAudit({
      screenKey: SCREEN_KEY,
      action: "restored",
      actor: actor.id,
      role: actor.role,
      detail: `Restored from revision ${revision}, published as revision ${restored.revision}.`,
      revision: restored.revision,
    });
    return NextResponse.json({ restored: true, revision: restored.revision, restoredFromRevision: revision, etag: restored.etag });
  } catch (err) {
    return handleUnexpected(err);
  }
}
