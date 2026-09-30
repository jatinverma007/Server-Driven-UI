import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import invalidFixture from "@/schema/examples/home-screen.invalid.json";

const BASE = "http://localhost/api/v1";

interface TestRequestInit {
  method?: string;
  headers?: HeadersInit;
  role?: string;
  body?: unknown;
}

function req(url: string, init?: TestRequestInit) {
  const headers = new Headers(init?.headers);
  if (init?.role) headers.set("x-user-role", init.role);
  if (init?.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

beforeAll(() => {
  process.env.DATABASE_URL = `file:./tests/tmp/api-${randomUUID()}.db`;
});

describe("API routes — draft → validate → publish → published → revisions → restore", () => {
  it("GET /published returns 404 before anything has been published", async () => {
    const { GET } = await import("@/app/api/v1/configurations/home/published/route");
    const res = await GET(req(`${BASE}/configurations/home/published`));
    expect(res.status).toBe(404);
  });

  it("PUT /draft requires write_draft permission (viewer forbidden)", async () => {
    const { PUT } = await import("@/app/api/v1/configurations/home/draft/route");
    const { baseConfig } = await import("./fixtures");
    const res = await PUT(req(`${BASE}/configurations/home/draft`, { method: "PUT", role: "viewer", body: baseConfig() }));
    expect(res.status).toBe(403);
  });

  it("editor can PUT /draft, then GET /draft returns it back", async () => {
    const { PUT, GET } = await import("@/app/api/v1/configurations/home/draft/route");
    const { baseConfig } = await import("./fixtures");
    const cfg = baseConfig();
    cfg.screens[0].title = "Edited via API";

    const putRes = await PUT(req(`${BASE}/configurations/home/draft`, { method: "PUT", role: "editor", body: cfg }));
    expect(putRes.status).toBe(200);

    const getRes = await GET(req(`${BASE}/configurations/home/draft`, { role: "editor" }));
    const body = await getRes.json();
    expect(body.content.screens[0].title).toBe("Edited via API");
  });

  it("POST /validate reports the current draft as valid", async () => {
    const { POST } = await import("@/app/api/v1/configurations/home/validate/route");
    const res = await POST(req(`${BASE}/configurations/home/validate`, { method: "POST", role: "editor" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
  });

  it("POST /validate rejects an invalid body without persisting anything", async () => {
    const { POST } = await import("@/app/api/v1/configurations/home/validate/route");
    const res = await POST(req(`${BASE}/configurations/home/validate`, { method: "POST", role: "editor", body: invalidFixture }));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.valid).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("editor cannot POST /publish (403)", async () => {
    const { POST } = await import("@/app/api/v1/configurations/home/publish/route");
    const res = await POST(req(`${BASE}/configurations/home/publish`, { method: "POST", role: "editor" }));
    expect(res.status).toBe(403);
  });

  it("POST /publish with an invalid body is rejected (422) and does not create a published revision", async () => {
    const { POST } = await import("@/app/api/v1/configurations/home/publish/route");
    const { GET: getPublished } = await import("@/app/api/v1/configurations/home/published/route");

    const res = await POST(req(`${BASE}/configurations/home/publish`, { method: "POST", role: "publisher", body: invalidFixture }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.published).toBe(false);

    const publishedRes = await getPublished(req(`${BASE}/configurations/home/published`));
    expect(publishedRes.status).toBe(404); // still nothing published
  });

  it("publisher publishes the (valid) draft — creates revision 1, GET /published now returns it with an ETag", async () => {
    const { POST } = await import("@/app/api/v1/configurations/home/publish/route");
    const { GET: getPublished } = await import("@/app/api/v1/configurations/home/published/route");

    const publishRes = await POST(req(`${BASE}/configurations/home/publish`, { method: "POST", role: "publisher" }));
    expect(publishRes.status).toBe(200);
    const publishBody = await publishRes.json();
    expect(publishBody.published).toBe(true);
    expect(publishBody.revision).toBe(1);

    const publishedRes = await getPublished(req(`${BASE}/configurations/home/published`));
    expect(publishedRes.status).toBe(200);
    const etag = publishedRes.headers.get("etag");
    expect(etag).toBeTruthy();

    const cachedRes = await getPublished(req(`${BASE}/configurations/home/published`, { headers: { "if-none-match": etag! } }));
    expect(cachedRes.status).toBe(304);
  });

  it("GET /revisions lists history; GET /revisions/:n returns full content", async () => {
    const { GET: listRevisions } = await import("@/app/api/v1/configurations/home/revisions/route");
    const { GET: getRevision } = await import("@/app/api/v1/configurations/home/revisions/[revision]/route");

    const listRes = await listRevisions(req(`${BASE}/configurations/home/revisions`));
    const list = await listRes.json();
    expect(list.currentRevision).toBe(1);
    expect(list.revisions.length).toBeGreaterThanOrEqual(1);

    const revRes = await getRevision(req(`${BASE}/configurations/home/revisions/1`), { params: Promise.resolve({ revision: "1" }) });
    expect(revRes.status).toBe(200);
    const rev = await revRes.json();
    expect(rev.content.schemaVersion).toBe("2.0.0");
  });

  it("editor cannot restore (403); publisher restore creates a new revision", async () => {
    const { PUT } = await import("@/app/api/v1/configurations/home/draft/route");
    const { POST: publish } = await import("@/app/api/v1/configurations/home/publish/route");
    const { POST: restore } = await import("@/app/api/v1/configurations/home/revisions/[revision]/restore/route");
    const { baseConfig } = await import("./fixtures");

    // create a revision 2 so restoring revision 1 is a meaningful change
    const cfg2 = baseConfig();
    cfg2.screens[0].title = "Changed for revision 2";
    await PUT(req(`${BASE}/configurations/home/draft`, { method: "PUT", role: "editor", body: cfg2 }));
    await publish(req(`${BASE}/configurations/home/publish`, { method: "POST", role: "publisher" }));

    const forbidden = await restore(req(`${BASE}/configurations/home/revisions/1/restore`, { method: "POST", role: "editor" }), {
      params: Promise.resolve({ revision: "1" }),
    });
    expect(forbidden.status).toBe(403);

    const ok = await restore(req(`${BASE}/configurations/home/revisions/1/restore`, { method: "POST", role: "publisher" }), {
      params: Promise.resolve({ revision: "1" }),
    });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.restored).toBe(true);
    expect(body.restoredFromRevision).toBe(1);
    expect(body.revision).toBe(3);
  });

  it("restoring an unknown revision returns 404", async () => {
    const { POST: restore } = await import("@/app/api/v1/configurations/home/revisions/[revision]/restore/route");
    const res = await restore(req(`${BASE}/configurations/home/revisions/999/restore`, { method: "POST", role: "publisher" }), {
      params: Promise.resolve({ revision: "999" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("API routes — request body size guard (added in the Phase 6 audit)", () => {
  it("PUT /draft rejects an oversized body with 413, based on Content-Length, before parsing it", async () => {
    const { PUT } = await import("@/app/api/v1/configurations/home/draft/route");
    const { baseConfig } = await import("./fixtures");
    const res = await PUT(
      req(`${BASE}/configurations/home/draft`, {
        method: "PUT",
        role: "editor",
        body: baseConfig(),
        headers: { "content-length": String(3 * 1024 * 1024) }, // lie about the size — the guard trusts the header, by design (see apiHelpers.ts)
      })
    );
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error.code).toBe("E_PAYLOAD_TOO_LARGE");
  });

  it("an ordinary-sized PUT /draft is unaffected by the guard", async () => {
    const { PUT } = await import("@/app/api/v1/configurations/home/draft/route");
    const { baseConfig } = await import("./fixtures");
    const res = await PUT(req(`${BASE}/configurations/home/draft`, { method: "PUT", role: "editor", body: baseConfig() }));
    expect(res.status).toBe(200);
  });
});

describe("API routes — catalogs", () => {
  it("serve the action, component and data-source catalogs", async () => {
    const { GET: actions } = await import("@/app/api/v1/action-catalog/route");
    const { GET: components } = await import("@/app/api/v1/component-catalog/route");
    const { GET: dataSources } = await import("@/app/api/v1/data-source-catalog/route");

    const a = await (await actions()).json();
    const c = await (await components()).json();
    const d = await (await dataSources()).json();

    expect(a.actions.length).toBeGreaterThan(0);
    expect(c.components.length).toBeGreaterThan(0);
    expect(d.dataSources.length).toBeGreaterThan(0);
  });
});
