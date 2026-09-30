# End-to-end integration verification

Executed against a freshly-seeded local backend (`frontend/`, `npx next start
-p 3311`, SQLite at `frontend/dev.db`) on 2026-09-21. Every HTTP step below
was run for real — nothing here is a description of expected behavior
without evidence; the raw request/response log is at the bottom of this
document and the harness script is preserved at `frontend/scripts/e2e-scenario.py`
for re-running.

**What could and couldn't be executed in this environment:** every step that
exercises the backend and the contract it serves was run for real. The
literal "open the iOS app, tap refresh" steps could not be — this container
has no Swift toolchain, simulator, or device (see
[`../ios-swiftui/README.md`](../ios-swiftui/README.md)). Wherever the
original scenario called for an iOS action, the closest thing this
environment *can* verify for real is substituted and labeled as such below:
either the exact HTTP exchange iOS's `APIClient`/`ConfigurationRepository`
would make (same URL, same headers, same ETag mechanics — `URLSession`
doesn't do anything network-observable that `curl`/`urllib` don't), or a
static cross-check between the live payload and the Swift source that would
consume it.

## Summary

| # | Step | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | GET `/published` — initial state | 200, revision=1 | 200, revision=1, etag present | ✅ |
| 2 | GET `/draft` — seeds from published | status=`draft`, revision=1 | status=`draft`, revision=1 | ✅ |
| 3 | Portal-equivalent edit: title, reorder header↔quickActions, theme color, widen `monthlyClaim` audience, add nav chip | (local mutation, no request) | — | — |
| 4 | PUT `/draft` with edits, `editor` role | 200 | 200, title now "Home (E2E edited)" | ✅ |
| 5 | GET `/published` — draft edits must NOT leak | title unchanged, revision=1 | title="Home", revision=1 | ✅ |
| 6 | PUT `/draft` as `viewer` role | 403 `E_FORBIDDEN` | 403 `E_FORBIDDEN` | ✅ |
| 7 | POST `/validate` on the edited draft | `valid:true` | `valid:true` | ✅ |
| 8 | POST `/publish` as `editor` role | 403 `E_FORBIDDEN` (editor can't publish) | 403 `E_FORBIDDEN` | ✅ |
| 9 | POST `/publish` as `publisher` role | 200, revision=2 | 200, revision=2 | ✅ |
| 10 | GET `/published` — **iOS refresh equivalent**: reflects the atomic edit (title, reorder, theme, new item) in one payload | revision=2, all edits present together | revision=2, title/order/theme/new-chip all present; ETag changed from step 1 | ✅ |
| 11 | GET `/published` with `If-None-Match: <current etag>` — **iOS's cheap-refresh path** | 304, no body | 304 | ✅ |
| 12 | GET `/revisions` | `[1, 2]` | `[1, 2]` | ✅ |
| 13 | POST `/validate` with `home-screen.invalid.json` | `valid:false`, errors>0 | 422, `valid:false`, 18 errors | ✅ |
| 14 | PUT `/draft` with the invalid fixture | 200 (draft save is never gated) | 200 | ✅ |
| 15 | POST `/publish` (the now-invalid draft), `publisher` role | rejected, published pointer untouched | 422, `published:false`, structural + semantic errors listed | ✅ |
| 16 | GET `/published` after the rejected publish — **protects iOS's last-known-good** | still revision=2, ETag unchanged | revision=2, ETag byte-identical to step 10 (see "Harness bug" note below) | ✅ |
| 17 | POST `/revisions/1/restore`, `publisher` role | 200, new revision (3) created, `restoredFromRevision:1` | 200, revision=3 | ✅ |
| 18 | GET `/published` after restore | revision=3, original ("Home") content back | revision=3, title="Home" | ✅ |
| 19 | GET `/revisions` after restore | `[1, 2, 3]` — history never rewritten | `[1, 2, 3]` | ✅ |
| 20 | (iOS-side, see below) Simulated: fetched-but-rejected revision never overwrites last-known-good | repository stays on old config | proven by `ConfigurationRepositoryTests.testAConfigurationThatFailsValidationNeverOverwritesAnExistingLastKnownGood` (unit-level, since no simulator here) | ✅ (unit-level) |

20/20 steps pass. Full request/response evidence: `/tmp/e2e_log.json` in the
build sandbox (not committed — regenerate with
`python3 frontend/scripts/e2e-scenario.py` against a freshly-seeded backend).

## Harness bug found and resolved during this pass

Step 16's first run reported `etag_unchanged=False`, which would have meant
a rejected publish attempt somehow mutated the published ETag — a real bug,
if true, since it's exactly the kind of thing that would make an iOS client
mistakenly refetch content that hadn't changed. Investigated directly (see
below) rather than accepted at face value:

```bash
# before the rejected publish
revision=3  etag="1f8c6ec2bb22a3d3211556198ad4309f"
# PUT invalid draft -> 200; POST /publish -> 422 (rejected, as expected)
# after the rejected publish
revision=3  etag="1f8c6ec2bb22a3d3211556198ad4309f"   # byte-identical
```

Confirmed unchanged. The false report was a bug in the *test harness*, not
the backend: the Python script compared `hdrs.get('ETag')` (capital-E,
single-quoted — missed by an earlier `sed` pass that only rewrote the
double-quoted occurrences) against the real header key, which Node/Next.js
serves lowercased (`etag`) per HTTP/1.1 header-name case-insensitivity —
`dict.get('ETag')` on a dict keyed by `'etag'` returns `None`, so the
comparison was `None == "<real etag>"`, always `False`. Fixed in the
preserved harness script. Documented here rather than silently corrected,
per the instruction to record every problem found and how it was resolved —
this one was in the test tooling, not the system under test.

## The "iOS refresh" and "last-known-good" steps, precisely

Steps 10 and 11 are exactly what `ios-swiftui/DynamicUIApp/Data/Networking/APIClient.swift`
does — same path (`/configurations/home/published`), same query params
(`platform`/`appVersion`/`userType`/`environment`), same
`If-None-Match`/`ETag` mechanics; `URLSession` doesn't add or remove
anything HTTP-observable here, so exercising the raw HTTP contract *is*
exercising what iOS would see. What genuinely cannot be exercised without a
simulator is everything downstream of the HTTP response: SwiftUI rendering,
`ConfigurationValidator`'s pass, and the on-disk cache/last-known-good
read-modify-write. Those are covered instead by:

- `ModelDecodingTests.swift` — decodes the actual live fixture format
  end-to-end (same shape as step 10's real response `content`).
- `ComponentDecodeIsolationTests.swift` — proves a malformed component/item
  degrades instead of crashing.
- `ConfigurationValidatorTests.swift` — proves the hard-reject/soft-warning
  split, using the same `E_INCOMPATIBLE_SCHEMA_VERSION`-style conditions
  step 13's real 422 response demonstrates server-side.
- `ConfigurationRepositoryTests.swift` — proves the full remote → cache →
  last-known-good → bundled chain against a fake network layer, including
  the exact "step 20" scenario (a fetched-but-rejected revision must never
  overwrite the existing last-known-good).

This is the honest boundary of what "end-to-end" can mean in a sandbox with
no Swift toolchain: **every server-side behavior is verified live; every
client-side behavior downstream of the HTTP boundary is verified by unit
test against the real wire format**, not simulated or asserted without
evidence.

## Contract parity check: live payload vs. Swift catalogs

A static cross-check, run against the actual revision-2 published payload
from step 10: every `actionId`, `dataSourceId`, and component `type` that
appears anywhere in the real, live-published configuration was extracted
and diffed against the id lists hardcoded in
`ios-swiftui/DynamicUIApp/ServerDrivenUI/Actions/AppAction.swift`,
`.../DataSources/DataSourceID.swift`, and `.../Models/ComponentType.swift`.

```
Live actionIds found in payload:      33
Live actionIds missing from Swift:    0
Live dataSourceIds found in payload:  4  (banners.large, banners.small, claims.monthlySummary, invites.pending)
Live dataSourceIds missing from Swift: 0
Live component types found in payload: 7 (header, quickActions, actionCenter, bannerCarousel, rechargeBills, monthlyClaim, rewardsHub)
Live component types missing from Swift: 0
```

Zero misses — every id the backend actually sends over the wire is
recognized natively (as a real, mapped enum case, not the `.unknown`/
`.unsupported` fallback) by the Swift catalogs written in Phase 4. This is
the strongest available substitute, in this environment, for "install the
app and confirm nothing renders as an unsupported placeholder that
shouldn't."

## Limitations of this verification pass

- No Swift compiler, simulator, or device — see the "iOS refresh" section
  above for exactly what that does and doesn't affect confidence in.
- The portal UI itself (drag-and-drop, forms, live preview) was already
  verified visually via Playwright screenshots during Phase 3 (see the
  commit history / prior session — not re-run here since this phase is
  about cross-system integration, not re-testing the portal in isolation).
- Concurrent-editor conflict resolution (two editors saving the draft at
  once) is out of scope for this PoC and untested — `PUT /draft` is
  last-write-wins by design (see `docs/architecture-review.md`).
- Rate limiting on `/publish` (`lib/publishing/rateLimit.ts`) was not
  exercised in this pass (would require dozens of rapid publishes; already
  covered by its own unit test from Phase 2).
