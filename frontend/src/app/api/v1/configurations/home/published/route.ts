import { NextRequest, NextResponse } from "next/server";
import { getConfigurationRepository } from "@/lib/configuration/repository";
import { resolveActor, requirePermission } from "@/lib/authorization/mockAuth";
import { jsonError, handleUnexpected, SCREEN_KEY } from "@/lib/publishing/apiHelpers";

const repo = getConfigurationRepository();

/**
 * GET /api/v1/configurations/home/published
 *
 * The ONLY endpoint iOS calls. Never returns a draft (docs/architecture-review.md
 * "Published endpoint behavior"). Supports If-None-Match/ETag/304 and takes
 * platform/app-version/user-type/environment as request context (query
 * params here, for PoC simplicity — a production client would likely send
 * some of these as headers instead; documented in docs/api-contract.md).
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "read");

    const published = await repo.getPublished(SCREEN_KEY);
    if (!published) {
      return jsonError(404, "E_NO_PUBLISHED_REVISION", "No revision has been published for this screen yet.");
    }

    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === published.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: published.etag,
          "Cache-Control": `public, max-age=${published.content.cache?.maxAgeSeconds ?? 300}`,
        },
      });
    }

    return NextResponse.json(
      { content: published.content, revision: published.revision, publishedAt: published.createdAt },
      {
        headers: {
          ETag: published.etag,
          "Cache-Control": `public, max-age=${published.content.cache?.maxAgeSeconds ?? 300}`,
        },
      }
    );
  } catch (err) {
    return handleUnexpected(err);
  }
}
