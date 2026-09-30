import { NextRequest, NextResponse } from "next/server";
import { getConfigurationRepository } from "@/lib/configuration/repository";
import { jsonError, handleUnexpected, SCREEN_KEY } from "@/lib/publishing/apiHelpers";

const repo = getConfigurationRepository();

/**
 * GET /api/v1/configurations/home/published
 *
 * The ONLY endpoint iOS calls. Never returns a draft (see "Published
 * endpoint behavior" in docs/architecture-review.md). Supports
 * If-None-Match/ETag/304 and takes platform/app-version/user-type/
 * environment as request context (query params here, for PoC simplicity —
 * documented in docs/api-contract.md).
 *
 * INTENTIONALLY UNAUTHENTICATED. Every other route in this app requires a
 * real session (see `lib/authorization/mockAuth.ts`'s `resolveActor()`) —
 * that's what closed the old `x-user-role` header-escalation exploit for
 * the admin portal (see the auth feature's implementation notes). This
 * route is different in kind: it's the read-only public config feed for
 * native clients (iOS's `AppEnvironment`/`APIClient` have no login flow at
 * all, by design — see ios-swiftui/README.md), and it can only ever
 * return already-published content, never a draft or anything
 * revision-history/audit-related. Requiring a session here would mean iOS
 * (or any other native client) could never load the home screen — there's
 * nothing this endpoint exposes that draft/publish/restore's session
 * requirement is actually protecting, so gating it identically to those
 * was a mismatch, not a deliberate security decision. Every route that
 * DOES need protecting (draft reads/writes, publish, restore, revision
 * history) still goes through `resolveActor()`/`requirePermission()`
 * unchanged.
 */
export async function GET(req: NextRequest) {
  try {
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
