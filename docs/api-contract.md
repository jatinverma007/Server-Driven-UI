# API Contract

Base URL (local dev): `http://localhost:3001/api/v1` (examples below use
`:3311`, the port used while verifying this backend in the build sandbox —
use whatever port `npm run dev`/`npm start` prints).

All request bodies/responses are JSON. Mock auth (see
[`architecture-review.md §9`](./architecture-review.md) and
`frontend/src/lib/authorization/mockAuth.ts`) reads role/identity from
headers:

| Header | Values | Default |
|---|---|---|
| `x-user-role` | `viewer` \| `editor` \| `publisher` \| `admin` | `MOCK_ACTOR_ROLE` env (`.env.example`) |
| `x-user-id` | any string | `MOCK_ACTOR_ID` env |

| Role | read | write draft | validate | publish | restore |
|---|---|---|---|---|---|
| viewer | ✅ | – | – | – | – |
| editor | ✅ | ✅ | ✅ | – | – |
| publisher | ✅ | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |

A request lacking permission gets `403 { "error": { "code": "E_FORBIDDEN", ... } }`.

---

## `GET /configurations/home/draft`

Returns the current draft. If none exists yet, seeds the response from the
current published revision (marked `status:"draft"`) rather than 404'ing, so
the portal always has something to edit.

```bash
curl -s http://localhost:3311/api/v1/configurations/home/draft \
  -H "x-user-role: editor" | jq
```

## `PUT /configurations/home/draft`

Overwrites the draft in place. **No validation gate** — this is intentional
(`docs/architecture-review.md §9`): the portal must be able to save
in-progress, invalid work without losing it. Validation happens at
`/validate` and `/publish`.

```bash
curl -s -X PUT http://localhost:3311/api/v1/configurations/home/draft \
  -H "x-user-role: editor" -H "Content-Type: application/json" \
  --data-binary @frontend/src/schema/examples/home-screen.valid.json | jq
```

## `POST /configurations/home/validate`

Body optional — validates the given body, or the current draft if omitted.
Never persists anything. Returns `200` + `{valid:true}` or `422` +
`{valid:false, errors:[...]}`.

```bash
curl -s -X POST http://localhost:3311/api/v1/configurations/home/validate \
  -H "x-user-role: editor" | jq '.valid, .errors'

# Against the deliberately-broken fixture:
curl -s -X POST http://localhost:3311/api/v1/configurations/home/validate \
  -H "x-user-role: editor" -H "Content-Type: application/json" \
  --data-binary @frontend/src/schema/examples/home-screen.invalid.json | jq '.valid, (.errors | length)'
```

Each error: `{ code, path, message, severity }`. Error codes: see
[`json-migration-plan.md`](./json-migration-plan.md) and
`frontend/src/lib/validation/semanticValidator.ts` — `E_SCHEMA_*` (structural),
`E_UNRESOLVED_PLACEHOLDER`, `E_DUPLICATE_COMPONENT_ID`, `E_DUPLICATE_ID`,
`E_UNKNOWN_COMPONENT`, `E_UNKNOWN_ACTION`, `E_UNKNOWN_DATA_SOURCE`,
`E_UNKNOWN_THEME_TOKEN`, `E_UNSUPPORTED_ICON_ID`, `E_INVALID_DATE_RANGE`,
`E_INCOMPATIBLE_SCHEMA_VERSION`, `E_MISSING_ACCESSIBILITY_LABEL`,
`E_INVALID_ORDERING`, `E_NO_TARGET`.

## `POST /configurations/home/publish`

Body optional (publishes the current draft if omitted). **Always
re-validates** regardless of any prior `/validate` call. On success, creates
a new immutable revision and atomically repoints "published" at it in one
DB transaction. On failure, nothing is persisted except an audit entry.

```bash
# publisher role required
curl -s -X POST http://localhost:3311/api/v1/configurations/home/publish \
  -H "x-user-role: publisher" | jq

# rejected publish — no revision created, published pointer untouched
curl -s -X POST http://localhost:3311/api/v1/configurations/home/publish \
  -H "x-user-role: publisher" -H "Content-Type: application/json" \
  --data-binary @frontend/src/schema/examples/home-screen.invalid.json | jq '.published, (.errors|length)'
```

## `GET /configurations/home/published`

**The only endpoint iOS calls.** Never returns a draft. Supports
`ETag`/`If-None-Match` (`304` on match) and `Cache-Control` from
`cache.maxAgeSeconds` in the payload.

```bash
curl -s -D- http://localhost:3311/api/v1/configurations/home/published | head -10

ETAG=$(curl -s -D- -o /dev/null http://localhost:3311/api/v1/configurations/home/published \
  | grep -i '^etag:' | cut -d' ' -f2 | tr -d '\r')
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "If-None-Match: $ETAG" http://localhost:3311/api/v1/configurations/home/published
# → 304
```

Query/header context a real client would send (documented, mocked in this
PoC — no server-side personalization is implemented beyond what
`AudienceEvaluator`/portal preview does client-side): platform, app version,
schema version, user type, environment.

## `GET /configurations/home/revisions`

Revision history — metadata only (`revision`, `etag`, `createdAt`,
`createdBy`, `restoredFromRevision`), not full content.

```bash
curl -s http://localhost:3311/api/v1/configurations/home/revisions -H "x-user-role: viewer" | jq
```

## `GET /configurations/home/revisions/:revision`

Full immutable content of one revision.

```bash
curl -s http://localhost:3311/api/v1/configurations/home/revisions/1 -H "x-user-role: viewer" | jq '.content.schemaVersion'
```

## `POST /configurations/home/revisions/:revision/restore`

Rollback. Creates a **new** revision copying the target's content (never
rewinds the pointer destructively), so you can roll forward again
afterwards. Requires `publisher`/`admin`.

```bash
curl -s -X POST http://localhost:3311/api/v1/configurations/home/revisions/1/restore \
  -H "x-user-role: publisher" | jq
```

## `GET /component-catalog`, `GET /action-catalog`, `GET /data-source-catalog`

The allowlists the portal's dropdowns and the semantic validator both read
from. No auth required (read-only, non-sensitive).

```bash
curl -s http://localhost:3311/api/v1/component-catalog | jq '.components[].type'
curl -s http://localhost:3311/api/v1/action-catalog | jq '.actions | length'
curl -s http://localhost:3311/api/v1/data-source-catalog | jq '.dataSources[].id'
```

---

## Error shape

```json
{ "error": { "code": "E_FORBIDDEN", "message": "Role \"viewer\" does not have permission \"write_draft\"." } }
```

## Mock data endpoints (backend-internal, never sent to iOS)

`GET /mock-data/invites/pending`, `/mock-data/banners/large`,
`/mock-data/banners/small`, `/mock-data/claims/monthly-summary` — what
`dataSourceId`s resolve to in this PoC. A published configuration never
contains these URLs (`architecture-review.md §6`); they exist purely so the
portal preview and a future iOS network layer have something real to call
through their own registries.
