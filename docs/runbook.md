# Runbook

## Setup

```bash
cd frontend
cp .env.example .env
npm install
```

### Normal machine (real internet access)

```bash
npm run db:generate   # npx prisma generate
npm run db:push        # npx prisma db push
npm run db:seed        # seeds draft + published revision 1 from the migrated fixture
```

### This build sandbox (known limitation — read before reporting a bug)

`prisma generate`/`db push` need to download engine binaries from
`binaries.prisma.sh`. That host is blocked by this sandbox's egress policy
(`403 Forbidden` at the proxy on `CONNECT` — a policy denial, not a missing
file or a checksum mismatch). This is a property of the container this PoC
was assembled in, not of the code. `npm run db:seed` still works here
without `db:generate`/`db:push` — `frontend/src/lib/db/sqlite.ts` opens the
same SQLite file directly via `better-sqlite3` (ships prebuilt native
binaries through npm, no blocked host involved) and creates the identical
tables `prisma/schema.prisma` describes. Skip straight to:

```bash
npm run db:seed
```

Everything else (backend, tests, portal) runs identically either way.

### Swapping in real Prisma Client

Once `npm run db:generate` succeeds (normal network), replace the body of
`frontend/src/lib/db/sqlite.ts` with:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSQLite3({ url: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });
```

and rewrite `lib/configuration/repository.ts`'s method bodies to call
`prisma.draftConfiguration.*` / `prisma.configurationRevision.*` /
`prisma.publishedPointer.*` / `prisma.auditLogEntry.*` instead of raw SQL —
the table/column names already match 1:1, and the public
`ConfigurationRepository` class signature does not change, so nothing
outside that one file is affected.

## Run

```bash
npm run dev        # http://localhost:3001 — portal + backend together
# or
npm run build && npm start   # production build
```

Local URLs:
- Portal: `http://localhost:3001/dashboard`
- Backend: `http://localhost:3001/api/v1/...` (see `docs/api-contract.md`)

## Test

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run test        # vitest run — 40 tests: semantic validator, repository
                     # atomicity, API route handlers, contract consistency
npm run build        # production build (also runs Next's own type/ESLint pass)
```

All four currently pass clean in this sandbox (`0 lint warnings`,
`0 typecheck errors`, `40/40 tests`, successful production build).

## Editing and publishing a configuration (via curl, until Phase 3's portal UI lands)

```bash
BASE=http://localhost:3001/api/v1

# 1. read the draft
curl -s "$BASE/configurations/home/draft" -H "x-user-role: editor" | jq '.content' > /tmp/draft.json

# 2. edit /tmp/draft.json by hand, or with jq, e.g.:
jq '.screens[0].components[0].props.rightActions[0].actionId = "open_search"' /tmp/draft.json > /tmp/draft2.json

# 3. save it back
curl -s -X PUT "$BASE/configurations/home/draft" -H "x-user-role: editor" \
  -H "Content-Type: application/json" --data-binary @/tmp/draft2.json | jq

# 4. validate
curl -s -X POST "$BASE/configurations/home/validate" -H "x-user-role: editor" | jq '.valid'

# 5. publish (publisher/admin only)
curl -s -X POST "$BASE/configurations/home/publish" -H "x-user-role: publisher" | jq

# 6. confirm
curl -s "$BASE/configurations/home/published" | jq '.revision'
```

## How iOS refresh retrieves it

`GET /api/v1/configurations/home/published` with `If-None-Match: <etag>` —
see `ios-swiftui` README (Phase 4) for `AppConfigurationService` /
`ConfigurationRepository` details. Pull-to-refresh and the debug refresh
button both call the same path; a failed or invalid fetch never replaces the
currently-rendered configuration (`docs/architecture-review.md §10`).

## Known limitations (this PoC)

- **Prisma engine binaries** — see above; works normally outside this
  sandbox.
- **Single writer / no draft locking** — two editors saving the draft
  concurrently last-write-wins. Production recommendation: optimistic
  concurrency via a draft `version` column.
- **Mock auth** — headers only, no signature. See
  `frontend/src/lib/authorization/mockAuth.ts` header comment for the SSO
  swap point.
- **In-memory rate limiting** — per-process, resets on restart; fine for a
  single local instance, not for a multi-instance deployment.
- **No iOS toolchain in this sandbox** — `ios-swiftui` is written and
  reasoned about but not compiled/run here; see that folder's README for
  what could and couldn't be verified from the command line.
