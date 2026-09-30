import { NextRequest, NextResponse } from "next/server";
import { getConfigurationRepository } from "@/lib/configuration/repository";
import { resolveActor, requirePermission } from "@/lib/authorization/mockAuth";
import { handleUnexpected, SCREEN_KEY } from "@/lib/publishing/apiHelpers";

const repo = getConfigurationRepository();

/** GET /api/v1/configurations/home/revisions — revision history (metadata only, no full content). */
export async function GET(req: NextRequest) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "read");
    const revisions = await repo.listRevisions(SCREEN_KEY);
    const published = await repo.getPublished(SCREEN_KEY);
    return NextResponse.json({ revisions, currentRevision: published?.revision ?? null });
  } catch (err) {
    return handleUnexpected(err);
  }
}
