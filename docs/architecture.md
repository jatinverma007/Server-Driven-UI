# Architecture

Implementation-facing reference. For *why* each decision was made, see
[`architecture-review.md`](./architecture-review.md); for the field-by-field
migration, see [`json-migration-plan.md`](./json-migration-plan.md). This
document describes the system as built.

## 1. Repository layout

```
ios-swiftui/     Native iOS 17+ SwiftUI app. Never imports frontend source.
frontend/        Admin portal (Next.js/React/Tailwind) + backend (Next.js
                 route handlers + Prisma/SQLite) in one Next.js app.
docs/            This document set.
```

The contract between the two app folders is the versioned, **published**
JSON API — nothing else. iOS never reads a frontend source file, a Prisma
model, or a portal component; it only ever calls
`GET /api/v1/configurations/home/published`.

## 2. Frontend layers (`frontend/src`)

```
app/
  api/v1/...          Route handlers — the backend. Thin: auth → validate →
                       repository → response. No business logic lives here.
  dashboard/          The admin portal UI (Phase 3).
components/
  editor/ preview/ common/    Portal UI.
lib/
  authorization/      Mock RBAC (docs/architecture-review.md §"Production
                       readiness" describes the real-SSO swap).
  configuration/      repository.ts — the ONE seam to persistence. Everything
                       above this line is storage-agnostic.
  db/                 SQLite connection (see §4 below for the Prisma story).
  validation/         semanticValidator.ts — structural (ajv) + semantic
                       (catalog/reference) validation, shared by /validate
                       and /publish.
  publishing/         Rate limiting, shared API response helpers.
schema/
  home-screen.schema.json   Authoritative JSON Schema (2020-12).
  catalog/            Action / data-source / component / icon allowlists —
                       the single source of truth the validator, the portal
                       dropdowns, and this doc all read from.
  examples/           Valid + invalid fixtures (contract tests + seed data).
types/
  homeScreen.ts        Hand-maintained TS types mirroring the JSON Schema.
```

## 2b. iOS layers (`ios-swiftui/DynamicUIApp`)

```
App/              @main entry point — the ONLY file outside the SPM package
                   (see ios-swiftui/README.md "Wiring this into an Xcode project").
Core/              AppEnvironment, AppLogger, SemVer, AppContainer (DI composition root).
Domain/            BindingContext protocol + MockUserProfile, TextResolution,
                   ConfigurationLoadState — app-level concerns with zero
                   dependency on networking or SwiftUI.
Data/              APIClient (URLSession), ConfigurationCache (disk),
                   BundledConfigurationSource, ConfigurationRepository — the
                   remote → cache → last-known-good → bundled precedence chain.
ServerDrivenUI/
  Models/          Codable mirror of home-screen.schema.json, 1:1 with
                   frontend/src/types/homeScreen.ts.
  Validation/       AudienceEvaluator, SchemaCompatibility,
                    MinAppVersionValidator, ConfigurationValidator — the
                    client-side defense-in-depth layer (§5 still runs first,
                    server-side, at publish time).
  Actions/          AppAction (closed catalog, mirrors actions.ts) + ActionRegistry.
  DataSources/       DataSourceID (closed catalog, mirrors dataSources.ts) +
                     DataSourceRegistry.
  Themes/            ThemeResolver — token → SwiftUI Color, safe fallback.
  Renderer/          HomeScreenRenderer, RenderContext.
  Components/        One dedicated native SwiftUI view per component type +
                      ComponentRegistry (closed dispatch, no generic layout engine).
DesignSystem/       Non-server-driven layout constants (native chrome only).
Presentation/       ConfigurationViewModel (MVVM), RootView, BottomNavView,
                     state views (loading/empty/stale/incompatible/error).
```

Same contract-mirroring discipline as `frontend/src/types/homeScreen.ts`:
every model field, every catalog id, and the audience/compatibility logic
are kept in lockstep by hand across backend, portal, and iOS, with each
side's tests (`schema.contract.test.ts` / `portalLogic.test.ts` /
`ModelDecodingTests.swift` + `AudienceEvaluatorTests.swift`) checking the
same cases. See [`ios-swiftui/README.md`](../ios-swiftui/README.md) for the
full design notes, the SPM/Xcode wiring story, and — importantly — this
container's lack of a Swift toolchain and exactly what that does and
doesn't mean for confidence in this code.

## 3. Request flow

```
Portal edit ──PUT /draft──▶ DraftConfiguration (SQLite)
                                    │
                         POST /validate (no write)
                                    │  ajv structural + semanticValidator
                                    ▼
                              {valid, errors[]}
                                    │  (if valid)
                         POST /publish ─────▶ 1 DB transaction:
                                              insert ConfigurationRevision
                                              + move PublishedPointer
                                    │
                                    ▼
                    GET /published ──▶ iOS (ETag/If-None-Match aware)
```

`POST /publish` always re-runs full validation itself — it never trusts a
prior `/validate` call, because the draft may have changed in between. A
failed validation writes an audit entry (`publish_rejected`) and touches
nothing else; the published pointer is never moved except by the successful
transaction branch.

## 4. Persistence abstraction

`lib/configuration/repository.ts` defines `ConfigurationRepository` — every
route handler depends on this class, never on a specific database driver.
`prisma/schema.prisma` is the authoritative model definition (4 tables:
`DraftConfiguration`, `ConfigurationRevision`, `PublishedPointer`,
`AuditLogEntry` — see that file's header for the Postgres-swap story).

**Known limitation of the sandbox this PoC was built in:** the CLI commands
`prisma generate` / `prisma db push` need to download Prisma's engine
binaries from `binaries.prisma.sh`, and that host is blocked by this
sandbox's outbound network policy (403 at the proxy, not a missing-file or
checksum problem). `lib/db/sqlite.ts` therefore opens the same SQLite file
directly with `better-sqlite3` (ships prebuilt native binaries via npm — no
blocked host) and creates the identical tables by hand. On any machine with
normal internet access, `npm run db:generate && npm run db:push` works
normally and `@prisma/client` (with the already-declared
`@prisma/adapter-better-sqlite3` driver adapter) can replace
`lib/db/sqlite.ts`'s internals one-for-one — see
[`runbook.md § Swapping in real Prisma Client`](./runbook.md) for the exact
change. The public `ConfigurationRepository` interface does not change
either way, so no route handler or test changes.

## 5. Validation — two layers

1. **Structural** (`ajv`, `home-screen.schema.json`): types, required
   fields, enums, string formats (`date`, `date-time`, `uri`), patterns
   (semver, `https://`). Catches malformed shapes immediately and cheaply.
2. **Semantic** (`semanticValidator.ts`): everything JSON Schema cannot
   express — catalog membership (`actionId`, `dataSourceId`, component
   `type`, icon `iconId`), cross-references (`backgroundToken` must exist in
   `theme.tokens`), uniqueness across siblings (`componentId`, item `id`,
   campaign `id`), placeholder detection (`<UPLOAD_PENDING:*>`,
   `<CONFIRM_DATE>`), date-range sanity, accessibility-label presence, and
   `schemaVersion` major-version compatibility.

Both run for `/validate` and `/publish`; structural failures short-circuit
before semantic checks run (no point walking a shape ajv already rejected).

## 6. Compatibility policy

- **`schemaVersion`**: `major.minor.patch`. A major bump means the envelope
  itself changed shape; the client checks `major` *before* attempting to
  decode `screens` at all (`E_INCOMPATIBLE_SCHEMA_VERSION` server-side;
  iOS's `ConfigurationValidator` mirrors the same check).
- **`platformConstraints.minAppVersion`**: compared against the running
  app's own version before rendering; older builds keep last-known-good and
  surface an "update required" state instead of a partial render.
- **Unknown component `type`**: decodes to `.unsupported` on iOS (never a
  decode failure); the portal's editor and `component-catalog.ts` simply
  don't offer it. A minor schema/catalog addition is safe for old app
  builds by construction.
- **Unknown optional `props` fields**: `ComponentProps` is
  `additionalProperties: true` at the schema level and an index-signature
  type on iOS/TS — both sides ignore fields they don't recognize rather than
  failing.
- **New `actionId`/`dataSourceId`**: safe to add server-side at any time;
  clients that don't recognize them treat the reference as absent
  (`.unknown` action → no-op; unrecognized data source → static fields only,
  binding `fallback` used).

See `architecture-review.md §8` for the full risk table this policy answers.
