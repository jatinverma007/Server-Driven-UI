# frontend

Admin portal (Next.js/React/Tailwind) **and** its backend (Next.js route
handlers + Prisma/SQLite) in one app — see [`../docs/architecture.md`](../docs/architecture.md)
for why these two live together instead of as separate `/server` and
`/admin-portal` folders.

## Quick start

```bash
cp .env.example .env
npm install
npm run db:generate && npm run db:push   # normal network; see below if this fails
npm run db:seed
npm run dev
```

Open http://localhost:3001/dashboard.

**In a network-sandboxed environment** where `binaries.prisma.sh` is
unreachable, skip `db:generate`/`db:push` — `npm run db:seed` still works
(see [`../docs/runbook.md`](../docs/runbook.md) for why and how to swap back
to real `@prisma/client` once you have normal network access).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server (portal + backend), port 3001 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` over `src/` |
| `npm run lint` | `next lint` |
| `npm run test` | `vitest run` — 47 tests (semantic validator, repository atomicity, API routes, contract consistency, portal logic) |
| `npm run schema:validate` | ajv-validates `src/schema/examples/*.json` against `home-screen.schema.json` |
| `npm run db:seed` | Seeds a draft + published revision 1 from the migrated fixture |

## Layout

See [`../docs/architecture.md §2`](../docs/architecture.md#2-frontend-layers-frontendsrc).

## What the portal does

- **Widgets tab** — reorder screen components by drag-and-drop
  (`@dnd-kit`), enable/disable, edit title/background-token/audience/layout,
  edit item groups (`topItems`/`items`/`bottomItems`) with an add-item form
  built on `react-hook-form` + `zod`.
- **Navigation tab** — edit/reorder the bottom tab bar, per-tab audience.
- **Themes tab** — edit every semantic colour token, light and dark, add new
  tokens.
- **Versions tab** — revision history with restore (rollback creates a new
  revision, never rewrites history).
- **Right panel** — an iPhone-sized live preview rendered from the exact
  same normalized types and the exact same `AudienceRule` evaluator the
  backend validator uses (`lib/portal/audience.ts` mirrors
  `lib/validation/semanticValidator.ts`'s semantics). Toggle B2B/B2C, light/dark,
  and device size. **This preview is a labelled web approximation** — the
  iOS SwiftUI renderer is the final source of truth for real layout,
  spacing, Dynamic Type, and accessibility (banner shown at all times).
- **Advanced JSON editor** (secondary, opt-in) — synced with the form editor
  in both directions; "Apply" refuses JSON that doesn't parse or doesn't
  pass the same validator `/publish` runs.
- **Top bar** — environment/status/revision, unsaved-changes indicator, Save
  Draft, Validate, Publish (with a confirmation dialog). Role selector
  simulates viewer/editor/publisher/admin against the real mock-RBAC backend
  — buttons actually disable per role, and the server independently
  enforces the same rules (403 if bypassed).
