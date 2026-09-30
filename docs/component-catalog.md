# Component Catalog

The closed set of native component types a published configuration may
reference. Machine-readable source of truth:
[`frontend/src/schema/catalog/components.ts`](../frontend/src/schema/catalog/components.ts)
(drives the JSON Schema `Component.type` enum, the portal's "add component"
picker, and the iOS `ComponentRegistry`). This is a controlled registry, not
a generic layout engine — see `docs/architecture-review.md §"unsafe action /
API handling"` and the project brief's "do not create a fully generic
arbitrary layout engine."

| type | label | audience-aware | data-bound | layout config | item groups |
|---|---|---|---|---|---|
| `header` | Header | no | no | no | — |
| `quickActions` | Quick Actions | yes | no | yes | `topItems`, `items`, `bottomItems` |
| `actionCenter` | Action Center | yes | no (per-item `dataSourceId`) | yes | `items` |
| `bannerCarousel` | Banner Carousel | yes | yes (`props.dataSourceId`) | yes | — |
| `rechargeBills` | Recharge & Bills | yes | no | yes | `topItems`, `items`, `bottomItems` |
| `monthlyClaim` | Monthly Claim | yes | yes (`props.dataSourceId`) | yes | `topItems`, `items` |
| `rewardsHub` | Rewards Hub | yes | no | yes | `topItems`, `items` |
| `unsupported` | *(client-only sentinel)* | — | — | — | — |

`unsupported` is **never written by the server**. It is what an iOS build
decodes an unrecognized `type` value into (`architecture-review.md §10`) so
one bad/future component can't blank the whole screen. `component-catalog.ts`
deliberately excludes it from `COMPONENT_CATALOG` so the portal can never
offer it as something to add.

## Item-group semantics

`topItems` / `items` / `bottomItems` were never defined in the original
payload (`json-analysis.md F-16`, assumption `A-13`). As implemented:

- **`topItems`** — an inline trailing accessory rendered on the same row as
  the component's title (right-aligned, `Spacer()`-pushed — not a
  full-width row of its own), matching the Figma reference
  (`HANDOVER--PAY`, node `4908:4290`) across all four item-group
  components: `quickActions.topItems[0]` = "Check Balance", which the iOS
  renderer additionally treats as a local reveal/hide/refresh toggle (see
  `QuickActionsComponentView`, `BalanceDisplay`) since the balance figure
  itself is security-sensitive and native-gated, never schema-driven;
  `rechargeBills.topItems[0]` = the Bharat Connect icon;
  `monthlyClaim.topItems[0]` = "Download report"; `rewardsHub.topItems[0]`
  = "View more".
- **`items`** — the primary grid/list content, laid out per `layout`
  (`columns`, `orientation`, `viewType`).
- **`bottomItems`** — a row of small chip buttons rendered *below* the main
  grid (e.g. `quickActions`'s UPI ID chip + "Style Your QR", or
  `rechargeBills`'s "Plan Expired? Recharge now" + "View More").

Not every component uses every group — `bannerCarousel` uses none (it's
entirely `dataSourceId`-driven); `actionCenter` uses only `items`.

## Corner radius / tile shape / gradients — what's schema-driven vs. native

This came up directly (`https://www.figma.com/design/EP0SYzo0fAlZUNgnquFF1d/HANDOVER--PAY`,
node `5382:6285` — the full home screen), so it's worth stating plainly
rather than leaving it implicit in the renderer code:

- **Colors are schema-driven, sizes/shapes are native.** Every fill —
  a screen's hero gradient (`ScreenStyle.backgroundGradientToken`), an
  icon tile's fill/border (`ComponentItem.style`), a chip's fill/border —
  resolves through `theme.tokens`/`theme.gradients`, is light/dark aware,
  and can change without an app release. *How big* something is, and
  *how rounded its corners are*, does not come from the schema at all —
  it's a native constant (`DSRadius`/`DSSpacing` on iOS; the matching
  literal pixel values in the portal's preview components), because it's
  tied to a specific component's *layout*, not its theme.
- **The radius/shape itself can still differ by component**, just not by
  schema field: `quickActions` and `rechargeBills` each sit inside a
  white, `rounded-[24px]` "section card" (`DSRadius.sectionCard`) with a
  16pt outer margin (node `5382:7481`/`5382:7608`); `monthlyClaim` has no
  such section-level card, only smaller per-item ones — `DSRadius.claimCard`,
  `rounded-[12px]` (node `5382:7195` "Approved" / `5382:7223` "Rejected").
  Each of those cards keys its status color/badge/checkmark off the item's
  own `id` natively (`ClaimStatus` on iOS), not a schema field — see
  `MonthlyClaimComponentView`. `quickActions`' icon tiles are
  `rounded-[16px]` with a gradient fill (`chip.icon`); `rechargeBills`'
  icon tiles are fully **circular** with a flat cream fill and a
  semi-transparent orange border — same `ComponentItem.style` mechanism
  (`backgroundToken`/`borderToken`, no gradient), different native shape
  (`TileShape.circular` on iOS, `shape="circle"` in the portal's
  `ItemIcon`). A component opts into a given native treatment in its own
  view; there's no per-item "radius" or "shape" field in the schema, and
  deliberately so — see `architecture-review.md`'s "native chrome vs.
  server-driven content" split.

## Layout semantics

| `layout` field | Meaning |
|---|---|
| `orientation` | `horizontal` \| `vertical` — axis `items` flows along. |
| `viewType` | `fixed` (all items laid out at once, e.g. a 4-column grid) \| `scroll` (horizontally/vertically scrollable). |
| `itemSizing` | Only meaningful with `viewType:"scroll"`. Replaces the ambiguous legacy `isWidth` (`json-analysis.md F-06`): `intrinsic` (size to content), `fillViewport` (each item fills the visible width — the legacy `isWidth:true` mapping, assumption `A-07`), `pagedFullWidth` (snap-paging carousel). |
| `columns` | Only meaningful with `viewType:"fixed"`. 1–6. iOS may clamp this downward under larger Dynamic Type accessibility sizes — it's a hint, not a guarantee (`architecture-review.md §7.3`). |

## Versioning

Every component carries `componentVersion` (starts at `1`). A future
breaking change to one component's `props` shape bumps its version;
`ConfigurationValidator` on iOS checks the version it knows how to render
against the version in the payload and falls back to `.unsupported`
rendering for a version it doesn't recognize, exactly as it would for an
unknown `type` — so a component-level breaking change degrades gracefully
on older app builds without a full-screen failure.
