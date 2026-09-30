# Production-readiness audit

Principal Software Architect + Mobile Security Engineer review, conducted
2026-09-21 after Phases 1–5 (schema/contract, backend, portal, iOS,
end-to-end verification) were complete and passing. Scope: the 21 areas
specified in the brief. Every finding below is grounded in a specific file
and, where practical, a specific command run against this repository — not
a generic checklist. Per instruction, **only small, clearly-safe
corrections were applied directly**; everything larger is a scoped
recommendation, not implemented speculatively.

Severity legend: **Critical** — must fix before any real user sees this;
**High** — must fix before production, not before this PoC ships as a PoC;
**Medium** — should fix soon after production launch; **Low** — track, not
urgent.

## Fixes applied during this audit

Two findings were small, additive, zero-risk-to-existing-behavior, and
directly fixed a real gap — both applied and verified (`npm run typecheck`,
`npm run lint`, `npm run test` — 53/53 passing, up from 47 before Phase 6;
`npm run build` — production build succeeds).

### Fix 1 — `ASSET_HOST_ALLOWLIST` was documented as enforced but wasn't

**Severity: High** (a documented security control that silently does
nothing is worse than not documenting one at all — anyone auditing by
reading `.env.example` would have concluded this was covered).

- **Evidence**: `.env.example` line 15's comment says
  `ASSET_HOST_ALLOWLIST` is "enforced by lib/validation/semanticValidator.ts
  when set" — `grep -rn "ASSET_HOST_ALLOWLIST" src/` returned zero matches
  before this fix.
- **Impact**: any `AssetRef.remote` URL from any host would pass validation
  and get published, including a host that isn't the organization's own CDN
  — combined with iOS loading `.remote` URLs as opaque image bytes
  (`AsyncAssetImage`), this doesn't enable code execution, but it does allow
  publishing UI that fetches images from a host outside the approved list,
  which is the exact thing the env var was meant to prevent.
- **Fix**: added a generic remote-asset-host walk to
  `validateHomeScreenConfiguration()`, active only when
  `ASSET_HOST_ALLOWLIST` is set, producing a new `E_ASSET_HOST_NOT_ALLOWED`
  error code. A generic walk (rather than threading the check through the
  ~8 existing per-field `AssetRef` call sites) was chosen specifically to
  minimize risk: it can't miss a call site, and it can't change behavior
  for anything other than this one new check.
- **Affected files**: `frontend/src/lib/validation/semanticValidator.ts`
  (fix), `frontend/tests/semanticValidator.test.ts` (4 new tests: unset →
  no-op, disallowed host → rejected, allowed host → passes, real seed
  fixture → passes against its own documented allowlist).
- **Blocking**: no longer — fixed.

### Fix 2 — no request body size limit on draft/validate/publish

**Severity: Medium/High** (a real, unauthenticated-strength DoS vector —
mock auth means anyone who can reach the API at all can hit these routes).

- **Evidence**: `grep -rn "content-length\|bodyParser\|413" src/` returned
  nothing before this fix. Next.js App Router route handlers (unlike the
  old Pages API) impose no default body size limit; `await req.json()` on
  `PUT /draft`, `POST /validate`, `POST /publish` would happily buffer an
  arbitrarily large request body into memory.
- **Impact**: a small number of very large requests could exhaust server
  memory — more severe on this PoC's single-process/single-instance
  deployment (see "High availability" below) than it would be behind a
  properly-configured platform.
- **Fix**: added `checkBodySize()` to
  `frontend/src/lib/publishing/apiHelpers.ts` — a `Content-Length`-header
  check (2MB limit; the real seed fixture is ~16KB) applied before
  `req.json()` runs, on all three write endpoints. **This is honestly a
  partial mitigation, not a complete one** — a request with no
  `Content-Length` (chunked transfer) or one that understates its own size
  is not caught by this check; the doc comment on `checkBodySize()` says so
  explicitly and still recommends a platform/reverse-proxy-level limit (a
  CDN, `client_max_body_size`, or the hosting platform's own request-size
  cap) as the real production control. Applying only the cheap, safe,
  in-process half of this fix — not attempting to implement streaming
  body-size enforcement — matches "small, clearly safe corrections only."
- **Affected files**: `frontend/src/lib/publishing/apiHelpers.ts` (fix),
  `.../draft/route.ts`, `.../validate/route.ts`, `.../publish/route.ts`
  (call sites), `frontend/tests/api.routes.test.ts` (2 new tests).
- **Blocking**: the in-process half is fixed; the platform-level half is a
  deployment-configuration task, tracked below, not blocking this PoC.

## Findings by area (not fixed — scoped recommendations)

| # | Area | Severity | Finding | Fix | Blocking? |
|---|---|---|---|---|---|
| 1 | **Security (auth)** | Critical *(for real prod)* | `resolveActor()` (`mockAuth.ts`) trusts unsigned `x-user-role`/`x-user-id` headers — anyone can claim `admin`. Already self-documented in the file's own header comment as a PoC stand-in. | Replace with a real session (NextAuth + enterprise SSO/OIDC), verified server-side; `ROLE_PERMISSIONS` becomes a real RBAC lookup. One file to change (`resolveActor`'s call sites are untouched). | Not blocking for a PoC being evaluated as a PoC; **blocking before any real user/data touches this.** |
| 2 | **RBAC** | Low | Role matrix (`viewer`/`editor`/`publisher`/`admin`) is coarse — no per-environment scoping (e.g. an editor allowed to touch `staging` but not `production`). Verified via live testing (docs/end-to-end-verification.md steps 6, 8) that the matrix itself is enforced correctly. | Add an `environment` dimension to `Permission` checks if/when multi-environment publishing is needed. | No — not needed for single-environment PoC. |
| 3 | **Signing (iOS)** | N/A — unverifiable here | No Xcode/Apple Developer account in this environment; code signing, provisioning profiles, and entitlements were never exercised. | Verify on first real Xcode build (see `ios-swiftui/README.md`). | Not blocking the PoC deliverable; blocking before TestFlight/App Store. |
| 4 | **Auditability** | Medium | `repo.appendAudit()` is called on every state-changing action (`draft_saved`, `validated`, `publish_rejected`, `published`, `restored` — confirmed via `grep -rn "appendAudit" src/`) and `AuditLogEntry` rows are real, but **no route exposes `repo.listAudit()`** — there is currently no way to read the audit trail except direct DB access. | Add `GET /api/v1/configurations/home/audit` (admin-only). Small, but deliberately not added in this pass — it's a new endpoint + RBAC wiring + tests, past the "small, clearly safe correction" bar for an unattended fix. | Not blocking the PoC; should be the first thing added in the next iteration. |
| 5 | **Schema evolution** | Low | Major/minor policy is well-defined and mirrored on both clients (`docs/architecture.md §6`). No tooling exists to auto-generate a migration plan for a future major bump — expected to be a manual, human-reviewed process each time (like this repo's own v1→v2 migration, `docs/json-migration-plan.md`). | None needed now; document as an accepted manual process. | No. |
| 6 | **Backward compatibility** | Low | `ComponentProps.additionalProperties: true` (schema) / index signature (TS) / "ignored by default" (Swift `Decodable`) means a NEW field added without a minor-version bump is silently invisible to older clients rather than erroring loudly. This is the intended tradeoff (graceful degradation over hard failure) but is worth stating as a conscious choice, not an oversight. | None — document the tradeoff (this file). | No. |
| 7 | **Rollback safety** | None found | Verified live end-to-end (docs/end-to-end-verification.md steps 17–19): restore creates a NEW revision, never rewrites history; `restoredFromRevision` is recorded. | — | No. |
| 8 | **Caching** | Low | ETag/If-None-Match verified live (steps 10–11: real 304). `Cache-Control: public, max-age=<config.cache.maxAgeSeconds>` is set from the *content itself* — a compromised/misconfigured draft could set an unreasonable `maxAgeSeconds` (e.g. 0 or a huge number) and it would flow straight into a cache-control header. | Clamp `maxAgeSeconds` to a sane range (e.g. 60–3600) in the route handler, independent of what the content says. Not applied here (behavioral change to caching semantics — deferred rather than risked in an unattended pass). | No — low real-world impact at current scale. |
| 9 | **Offline (iOS)** | None found | Full remote → cache → last-known-good → bundled chain implemented and unit-tested (`ConfigurationRepositoryTests.swift`), including the specific "rejected revision never overwrites last-known-good" case. Unverifiable on-device (no simulator) but the logic is exercised against the real wire format. | — | No. |
| 10 | **Performance** | Low | `GET /revisions` has no pagination — `repo.listRevisions()` returns every revision ever created for a screen key. Fine at PoC scale (single-digit revisions); would degrade linearly for a screen with thousands of publishes over years. | Add `?limit=&cursor=` to `listRevisions`. | No — not at this scale. |
| 11 | **Accessibility** | Medium | iOS: `accessibilityLabel` is wired for icon-only/actionable items (`ItemGridView`, `ActionButtonView`) and the schema's own `E_MISSING_ACCESSIBILITY_LABEL` rule catches the common gap at publish time — verified live (docs/architecture-review.md's rule, exercised by `semanticValidator.test.ts`). **Not verified**: actual VoiceOver behavior (no simulator), Dynamic Type layout (no simulator), and whether the portal's `@dnd-kit` drag-and-drop reordering (`ComponentList.tsx`) has a working keyboard-only path — `@dnd-kit` supports keyboard sensors but this repo doesn't confirm one is wired up. | Add `KeyboardSensor` to the portal's `@dnd-kit` sensor list if it isn't already there (quick `grep` shows only `PointerSensor` is configured); verify VoiceOver/Dynamic Type on first real device test. | Not blocking the PoC; should block a real accessibility sign-off. |
| 12 | **Observability** | Medium | Backend: `console.error` only, no structured logging/metrics. iOS: `AppLogger` (os.Logger-based) covers every degrade-gracefully path (unknown action, unknown component, unknown token, rejected config) but nothing forwards these anywhere outside the device's own console. | Backend: structured logs (pino/winston) + an APM (Datadog/Sentry). iOS: forward `AppLogger.warning/error` to a crash-reporting SDK. Both are real integrations, not "small" fixes — not attempted here. | Not blocking the PoC; should be near-top of the next iteration's list. |
| 13 | **Asset delivery** | High → Fixed | See "Fix 1" above. | Fixed this pass. | No longer. |
| 14 | **CDN** | Low | No CDN configured (expected — this runs on localhost). The ETag/Cache-Control design is already CDN-friendly (a CDN would just honor the existing headers); no code change needed to add one later. | Put a CDN in front of `/published` and static assets when deploying beyond localhost. | No — infra task, not a code gap. |
| 15 | **DB migration** | High *(outside this sandbox)* | `lib/db/sqlite.ts` opens SQLite directly with `better-sqlite3` and hand-creates tables, bypassing Prisma's migration system entirely — a sandbox network-policy workaround, extensively documented in `docs/architecture.md §4` and `docs/runbook.md` with the exact swap-back steps. Verified again during this audit: `grep -rn "binaries.prisma.sh"` in the proxy's block list still applies in this container. | On any machine with normal internet access: `npm run db:generate && npm run db:push`, then swap `lib/db/sqlite.ts`'s internals for `@prisma/client` per the runbook — the public `ConfigurationRepository` interface doesn't change. | Blocking a *real* multi-environment deployment; not blocking this PoC's evaluation (the workaround is transparent, tested, and reversible). |
| 16 | **High availability** | Critical *(for real prod)* | Single SQLite file, single Node process. The in-memory rate limiter (`rateLimit.ts`) and the SQLite connection itself (`lib/db/sqlite.ts`'s `global.__sdui_db__` singleton) are both process-local — running >1 instance would give each instance its own rate-limit state and, far worse, its own SQLite file unless they shared a disk (and SQLite doesn't handle concurrent multi-process writers well even then). | Real Postgres (already the target of the Prisma swap-back) + a shared rate limiter (Redis/Upstash, already called out in `rateLimit.ts`'s own header comment) before running more than one instance. | Not blocking this single-instance PoC; blocking before any HA deployment. |
| 17 | **Rate limiting** | Medium | Implemented (`checkRateLimit`, token bucket, 10/min per actor on `/publish`) and self-documents its own limitation (in-memory, per-process). Not applied to `/validate` or `/draft` (higher-frequency, lower-consequence endpoints — a deliberate choice, not an oversight, but worth stating explicitly). | Add a shared limiter before HA (same fix as #16). Consider a lighter limit on `/draft`/`/validate` if abuse is observed. | No — acceptable for single-instance PoC. |
| 18 | **Size limits** | Medium/High → Partially fixed | See "Fix 2" above. | Partially fixed this pass (in-process half); platform-level limit still recommended. | No longer critical; residual gap tracked. |
| 19 | **App Store compliance** | Positive finding, one action item | By construction, this app never downloads or executes code — every backend-controlled string is either literal display content or an opaque id resolved against a closed, compiled-in catalog (`AppAction`, `DataSourceID`, `ComponentType` — see `ios-swiftui/README.md`'s architecture notes). This is squarely within Apple's guidelines for server-driven *content* vs. the prohibited server-driven *code*. **Action item, not a violation**: the `NSAppTransportSecurity` / `NSAllowsLocalNetworking` exception documented in `ios-swiftui/README.md` is for local development against `http://localhost` only and must not ship in a release build pointed at a real `https://` API. | Ensure the ATS exception is scoped out (or the API base URL is switched to `https://`) before any App Store submission. | Not blocking the PoC; blocking before submission. |
| 20 | **Sensitive-data exposure** | None found (verified) | `handleUnexpected()` (`apiHelpers.ts`) returns a generic `E_INTERNAL`/500 to the client and logs the real error only server-side via `console.error` — confirmed by reading the function, not assumed. No stack traces, DB errors, or file paths are exposed in any API response observed during the Phase 2 test suite or the Phase 5 live E2E run. `MOCK_ACTOR_ID`/`MOCK_ACTOR_ROLE` in `.env` are local dev defaults, not secrets. | — | No. |
| 21 | **Disaster recovery** | High *(outside this sandbox)* | `frontend/dev.db` is a single file with no backup/replication — a lost/corrupted file loses every revision and audit entry ever created. Expected for a local PoC; not acceptable for production. | Once on Postgres (#15): automated backups + point-in-time recovery, matching whatever the hosting platform offers (RDS snapshots, etc.). | Not blocking this PoC; blocking before production. |

## What this audit deliberately did NOT do

Per instruction ("do not implement speculative large changes automatically;
apply only small, clearly safe corrections"), the following were
identified but intentionally left as recommendations rather than
implemented: real authentication/SSO, a shared/distributed rate limiter, an
audit-log read endpoint, structured logging/APM integration, CDN
provisioning, Postgres migration, and revision-list pagination. Each is a
multi-file, behavior-changing, or infrastructure-level change that belongs
in a reviewed follow-up, not an unattended audit pass.

## Verification of this audit's own changes

```
cd frontend
npm run typecheck   # clean
npm run lint        # clean
npm run test         # 53/53 passing (was 47 before this phase)
npm run build         # production build succeeds
```

Re-run `npm run db:seed` after these checks if you want the dev server back
in its pre-audit seeded state (the audit's own test runs use isolated
per-test SQLite files, per `beforeAll` in each test file, and never touch
`frontend/dev.db`).
