import { NextRequest, NextResponse } from "next/server";
import { getConfigurationRepository } from "@/lib/configuration/repository";
import { resolveActor, requirePermission } from "@/lib/authorization/mockAuth";
import { jsonError, handleUnexpected, SCREEN_KEY } from "@/lib/publishing/apiHelpers";

const repo = getConfigurationRepository();

/** GET /api/v1/configurations/home/revisions/:revision — full content of one immutable revision. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ revision: string }> }) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "read");
    const { revision: revisionParam } = await ctx.params;
    const revision = Number.parseInt(revisionParam, 10);
    if (Number.isNaN(revision)) {
      return jsonError(400, "E_INVALID_REVISION", "revision must be an integer.");
    }
    const record = await repo.getRevision(SCREEN_KEY, revision);
    if (!record) {
      return jsonError(404, "E_REVISION_NOT_FOUND", `Revision ${revision} does not exist.`);
    }
    return NextResponse.json(record);
  } catch (err) {
    return handleUnexpected(err);
  }
}
