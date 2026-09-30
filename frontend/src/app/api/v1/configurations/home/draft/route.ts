import { NextRequest, NextResponse } from "next/server";
import { getConfigurationRepository } from "@/lib/configuration/repository";
import { resolveActor, requirePermission } from "@/lib/authorization/mockAuth";
import { jsonError, handleUnexpected, checkBodySize, SCREEN_KEY } from "@/lib/publishing/apiHelpers";
import type { HomeScreenConfiguration } from "@/types/homeScreen";

const repo = getConfigurationRepository();

/** GET /api/v1/configurations/home/draft — current draft (never returned by /published). */
export async function GET(req: NextRequest) {
  try {
    const actor = resolveActor(req);
    requirePermission(actor, "read");
    const draft = repo.getDraft(SCREEN_KEY);
    if (!draft) {
      // First run — no draft yet. Seed one from the current published
      // revision if any, otherwise report empty so the portal can offer
      // "start from bundled seed".
      const published = repo.getPublished(SCREEN_KEY);
      if (published) {
        return NextResponse.json({ content: { ...published.content, status: "draft" }, updatedAt: null, updatedBy: null });
      }
      return jsonError(404, "E_NO_DRAFT", "No draft exists yet for this screen.");
    }
    return NextResponse.json({ content: draft.content, updatedAt: draft.updatedAt, updatedBy: draft.updatedBy });
  } catch (err) {
    return handleUnexpected(err);
  }
}

/** PUT /api/v1/configurations/home/draft — overwrite the draft in place (no validation gate — see /validate, /publish). */
export async function PUT(req: NextRequest) {
  try {
    const actor = resolveActor(req);
    requirePermission(actor, "write_draft");
    const tooLarge = checkBodySize(req);
    if (tooLarge) return tooLarge;
    const body = (await req.json()) as HomeScreenConfiguration;
    const withEnvelope: HomeScreenConfiguration = {
      ...body,
      status: "draft",
      configurationId: body.configurationId || `cfg_${SCREEN_KEY}_draft`,
    };
    const saved = repo.saveDraft(SCREEN_KEY, withEnvelope, actor.id);
    repo.appendAudit({ screenKey: SCREEN_KEY, action: "draft_saved", actor: actor.id, role: actor.role, detail: "Draft saved." });
    return NextResponse.json({ content: saved.content, updatedAt: saved.updatedAt, updatedBy: saved.updatedBy });
  } catch (err) {
    return handleUnexpected(err);
  }
}
