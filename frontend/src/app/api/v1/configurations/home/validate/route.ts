import { NextRequest, NextResponse } from "next/server";
import { resolveActor, requirePermission } from "@/lib/authorization/mockAuth";
import { validateHomeScreenConfiguration } from "@/lib/validation/semanticValidator";
import { getConfigurationRepository } from "@/lib/configuration/repository";
import { handleUnexpected, checkBodySize, SCREEN_KEY } from "@/lib/publishing/apiHelpers";

const repo = getConfigurationRepository();

/** POST /api/v1/configurations/home/validate — validates a body (or, if
 * omitted, the current draft) without persisting or publishing anything. */
export async function POST(req: NextRequest) {
  try {
    const actor = resolveActor(req);
    requirePermission(actor, "validate");
    const tooLarge = checkBodySize(req);
    if (tooLarge) return tooLarge;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const target = body ?? repo.getDraft(SCREEN_KEY)?.content;
    if (!target) {
      return NextResponse.json({ valid: false, errors: [{ code: "E_NO_TARGET", path: "(root)", message: "No body provided and no draft exists.", severity: "error" }], warnings: [] }, { status: 400 });
    }

    const result = validateHomeScreenConfiguration(target);
    repo.appendAudit({
      screenKey: SCREEN_KEY,
      action: "validated",
      actor: actor.id,
      role: actor.role,
      detail: result.valid ? "Validation passed." : `Validation failed: ${result.errors.length} error(s).`,
    });
    return NextResponse.json(result, { status: result.valid ? 200 : 422 });
  } catch (err) {
    return handleUnexpected(err);
  }
}
