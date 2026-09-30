# JSON Migration Plan — v1 legacy payload → v2 normalized contract

Companion to [`architecture-review.md`](./architecture-review.md) (decisions) and
[`json-analysis.md`](./json-analysis.md) (defect inventory `F-01…F-20`, assumptions
`A-01…A-15`). This document is the field-by-field mapping and the executable migration
steps; `frontend/src/schema/home-screen.schema.json` is the schema those steps must satisfy.

## 1. Principle

**Preserve all valid business content. Change only the structure and the safety
properties.** Every literal string, label, image URL, and action id from the original
JSON that is not itself defective (`F-02`/`F-03` placeholders) reappears unchanged in
`frontend/src/schema/examples/home-screen.valid.json`. Nothing is invented except where an
assumption (`A-xx`) was required to resolve a genuine ambiguity — and every such case
is listed in §6.

## 2. Envelope mapping

| v1 field | v2 field | Change |
|---|---|---|
| `schemaVersion: "1.0"` | `schemaVersion: "2.0.0"` | Semver; major bump = breaking envelope change |
| *(none)* | `configurationId` | New — UUID, backend-generated |
| *(none)* | `revision` | New — monotonic integer, backend-generated |
| *(none)* | `status` | New — `draft \| published \| archived` |
| *(none)* | `environment` | New — `development \| staging \| production` |
| `minAppVersion: {android, iOS}` | `platformConstraints.minAppVersion: {android, ios}` | Key casing normalized (`F-01`); nested under a named object |
| *(none)* | `publishedAt` | New — set on publish, null in draft |
| *(none)* | `cache: {maxAgeSeconds}` | New — feeds `Cache-Control` on `GET /published` |
| `themes` (7× `{light,dark}` background only) | `theme.tokens` (semantic map) | Restructured — see §3 |
| `style.backgroundTheme` | `screens[].style.backgroundToken` | Renamed, now references `theme.tokens` |
| `style.statusBar: "LIGHT"` | `screens[].style.statusBarStyle: "auto"` | Re-typed enum; `A-09` |
| `launcherIcon` | `appIcons` | Restructured — see §5 |
| `bottomNavigation[]` | `navigation.bottom[]` | Reshaped items — see §4 |
| `widgets[]` + `widgetData{}` | `screens[].components[]` | Merged into one ordered array — see §4 |

## 3. Theme mapping

v1 `themes.<name> = {light, dark}` was a flat background-colour swatch reused (by name
collision only) as a *button* fill in two places that don't exist (`F-07`). v2 splits
this into two independent concerns:

```jsonc
"theme": {
  "tokens": {
    "surface.default":   { "light": "#FFFFFF", "dark": "#1D1B18" },
    "surface.transparent": { "light": "transparent", "dark": "transparent" },
    "surface.info":      { "light": "#E9F0FF", "dark": "#17293D" },
    "surface.warning":   { "light": "#FFF1E8", "dark": "#3A2410" },
    "surface.accent":    { "light": "#FDEDEC", "dark": "#3A1F1C" },
    "surface.success":   { "light": "#E4F3EC", "dark": "#132A20" },
    "surface.critical":  { "light": "#F6E3E5", "dark": "#301418" },
    "text.primary":      { "light": "#1D1B18", "dark": "#FFFFFF" },
    "text.onAccent":     { "light": "#FFFFFF", "dark": "#FFFFFF" }
  }
}
```

`surface.*` values are the original 7 themes, renamed `default→surface.default`, etc.,
values byte-identical. `text.*` tokens are new — added because the original palette had
no foreground colour at all (`F-15`); values chosen for AA contrast against each
`surface.*` pair (documented, not guessed silently — flagged as `A-16` in
`migration-report.json`).

Buttons no longer reference `theme.tokens` directly. The two undefined names become:

| v1 (undefined) | v2 `buttonStyle` |
|---|---|
| `outline_critical` | `{ "variant": "outline", "role": "critical" }` |
| `solid_success` | `{ "variant": "solid", "role": "success" }` |

`buttonStyle.role` resolves to a `surface.<role>` / `text.<role>` token pair at render
time via a fixed table in `ThemeResolver` — never a free-text lookup.

## 4. Component mapping (widgets + widgetData → components)

General shape:

```jsonc
{
  "componentId": "<v1 widgets[].id>",
  "type": "<mapped type, see table>",
  "componentVersion": 1,
  "enabled": true,
  "audience": { "all": [ { "field": "user.type", "operator": "in", "value": ["B2B"] } ] }, // or omitted = everyone
  "style": { "backgroundToken": "surface.<name>" },
  "layout": { ... },          // present only for components that had one
  "props": { ... }            // component-specific, see component-catalog.md
}
```

| v1 `widgets[].id` | v1 `type` | v2 `type` | v1 `position` | v1 `userType` | Notes |
|---|---|---|---|---|---|
| `header` | `header` | `header` | 1 | — | |
| `quick_actions` | `quick_actions` | `quickActions` | 2 | — | |
| `action_center` | `action_center` | `actionCenter` | 3 | — | item 2 (`invite`) gains `dataSourceId: "invites.pending"` at item level |
| `large_banner` | `banner` | `bannerCarousel` | 4 | — | `banner` split into `bannerCarousel` (the only banner variant this PoC implements); `dataSourceId: "banners.large"` |
| `recharge_bills` | `recharge_bills` | `rechargeBills` | 5 | — | |
| `small_banner` | `banner` | `bannerCarousel` | 6 | — | second instance of the same component type, `dataSourceId: "banners.small"` |
| `monthly_claim` | `monthly_claim` | `monthlyClaim` | 7 | `B2B` | `dataSourceId: "claims.monthlySummary"`; `userType` → `audience` rule |
| `rewards_hub` | `rewards_hub` | `rewardsHub` | 7 | `B2C` | `userType` → `audience` rule; **the position-7 collision (`F-08`) disappears by construction** — both are ordinary array elements, order = `header, quickActions, actionCenter, bannerCarousel(large), rechargeBills, bannerCarousel(small), monthlyClaim, rewardsHub` per `A-02` |

`type` is the closed discriminator named explicitly in the project brief: `header |
quickActions | actionCenter | bannerCarousel | rechargeBills | monthlyClaim |
rewardsHub | unsupported`. `unsupported` is never written by the server — it is the
client-only decode fallback described in `architecture-review.md §10`.

### 4.1 Item-level mapping (applies inside `quickActions`, `actionCenter`, `rechargeBills`, `rewardsHub`, `monthlyClaim`)

| v1 item field | v2 field | Change |
|---|---|---|
| `id` | `id` | Unchanged; **now required on every item** (`F-16`) — 2 synthetic ids added (`monthly_claim.topItems[0]` → `download_report`; `action_center` buttons get `id`s derived from `actionId`) |
| `title` / `text` | `label: TextValue` | Unified name; literal unless in the binding list below |
| `icon` | `media.leading: AssetRef` | Remote URL → `{kind:"remote", url}`; `<UPLOAD_PENDING:x>` → `{kind:"pending", ref:"x"}` |
| `trailingIcon` | `media.trailing: AssetRef` | |
| `badge` | `media.badge: AssetRef` | Now requires `accessibilityLabel` per item (`A-14`) |
| `subtitle` | `subtitle: TextValue` | |
| `meta` | `meta: TextValue` | Literal unless in the binding list |
| `actionId` | `actionId` | Unchanged string, now validated against the action catalog |
| `buttons[]` | `buttons[]` | Each button: `text`→`label: TextValue`, `icon`→`icon: AssetRef`, `style.backgroundTheme`→`buttonStyle`, `iconPosition` unchanged |
| `dataSource: {type, endpoint, method?}` | `dataSourceId` | See §4.2 |
| `priority` | *(removed)* | Sort applied once at migration time (`A-08`); array order is now authoritative |

### 4.2 Data-source mapping

| v1 `dataSource.endpoint` | v1 `method` | v2 `dataSourceId` | Bound onto |
|---|---|---|---|
| `user_response` | *(absent)* | `invites.pending` | `actionCenter` item `invite` (`A-05`) |
| `/api/v1/banners/large_banner` | `GET` | `banners.large` | `bannerCarousel` (`large_banner`) |
| `/api/v1/banners/small_banner` | `GET` | `banners.small` | `bannerCarousel` (`small_banner`) |
| `/api/v1/claims/monthly-summary` | `GET` | `claims.monthlySummary` | `monthlyClaim` |

No `endpoint`, `method`, or any URL fragment appears anywhere in
`home-screen.schema.json` — `dataSourceId` is a bare enum-checked string. The URL/verb
live only in `frontend/src/schema/catalog/dataSources.ts` (Phase 2) and, ultimately, in
the native `DataSourceRegistry` / backend route handler, neither of which is
server-editable content.

### 4.3 Binding vs. literal resolution (`F-04`, assumption `A-04`)

| v1 string | Resolved as | Reasoning |
|---|---|---|
| `action_center.items[1].icon = "user_name_icon"` | `binding`, `path: "data.avatarUrl"` *(asset, not text — modelled as `media.leading: {kind:"binding"}`... see note)* | Symbolic name, not a URL, not any literal copy used elsewhere → treated as a data reference |
| `action_center.items[1].title = "invited_user_name"` | `binding`, `path: "data.invitedUserName"`, `fallback: "Someone"` | Exact match to the `invited_user_name` field named in the brief's "runtime user data" list |
| `action_center.items[1].subtitle = "wants to activate their card"` | `literal` | Grammatically a complete sentence continuing "`<name>` wants to activate their card" — copy, not a field name |
| `action_center.items[1].meta = "invite_mobile_no"` | `binding`, `path: "data.inviteMobileNo"`, `fallback: ""` | Exact match to `invite_mobile_no` in the brief's runtime-data list |
| `header.nameField = "userName"` etc. | `binding`, `path: "user.userName"` | Already explicit via `*Field` suffix; just re-expressed as `TextValue` |

> **Note on `media` bindable fields:** `AssetRef` gains a fourth variant,
> `{kind:"binding", path, fallback: AssetRef}`, used only for `user_name_icon` →
> `data.avatarUrl`, so an avatar can come from the invite payload rather than the
> static asset catalog. This is documented explicitly in `home-screen.schema.json`
> (`AssetRef` oneOf) rather than left implicit.

## 5. Launcher icon → approved icon catalog mapping

| v1 `launcherIcon` | v2 `appIcons` |
|---|---|
| `defaultIconId` | `defaultIconId` — unchanged (`ic_launcher`) |
| *(none)* | `supportedIconIds` — **new**, closed list of ids the *installed app bundle* actually ships (`A-12`): `["ic_launcher", "ic_launcher_ny", "ic_launcher_26", "ic_launcher_chris"]` |
| *(none)* | `timeZone` — **new**, `"Asia/Kolkata"` (`A-11`) |
| `campaigns[]` | `campaigns[]` | Each campaign keeps `id`, `iconId`, `startDate`, `endDate`; gains `priority` (deterministic overlap resolution) |

Campaign disposition:

| id | v1 status | v2 disposition |
|---|---|---|
| `new_year` | complete | kept, publishable |
| `republic_day` | complete | kept, publishable |
| `holi` | dates = `<CONFIRM_DATE>` | **excluded from the publishable seed** (no "pending date" representation exists — dates are `format:date` strings), kept as-is in `home-screen.invalid.json` to exercise `E_UNRESOLVED_PLACEHOLDER` |
| `independence_day` | icon = `<UPLOAD_PENDING:ic_launcher_ind>`, dates complete | **resolved for the PoC seed**: treated as if the asset had since been bundled (`iconId: "ic_launcher_ind"` added to `supportedIconIds`) so the seed has a fourth, non-trivial campaign to demonstrate the approved-icon-catalog flow end to end; kept, publishable |
| `raksha_bandhan` | dates + icon both pending | **excluded** — two independent placeholder categories, kept in the invalid fixture |
| `diwali` | dates + icon both pending | **excluded** — kept in the invalid fixture |
| `christmas` | complete | kept, publishable |

Result: the publishable seed ships **4 of 7** campaigns (`new_year`, `republic_day`,
`independence_day`, `christmas`); the invalid fixture ships all 7 to prove every
placeholder is caught. `independence_day` is the one campaign where the migration
went beyond pure mapping — flagged as assumption `A-12b` (see `json-analysis.md §3`):
in a real rollout this still requires an actual app release that bundles
`ic_launcher_ind` before the campaign can go live; the PoC treats it as already bundled
purely to exercise the catalog end-to-end.

## 6. Full list of intentional content/behavior changes

Anything in this list is a **decision**, not an oversight — cross-referenced to the
assumption ledger in `json-analysis.md §3`:

1. `position`/`priority` fields removed; array order is authoritative (`A-01`, `A-02`, `A-08`).
2. `userType` scalar → `audience` rule tree (`A-03`).
3. `isWidth: true` → `layout.itemSizing: "fillViewport"` (`A-07`) on all 3 occurrences (`actionCenter`, both `bannerCarousel` instances).
4. `statusBar: "LIGHT"` → `statusBarStyle: "auto"` (`A-09`).
5. `banner` type split into `bannerCarousel` (only variant implemented this PoC).
6. `themes` (7 background swatches) → `theme.tokens` (9 semantic tokens: 7 carried over + 2 new `text.*`) (`F-15`).
7. `outline_critical` / `solid_success` → `buttonStyle {variant, role}` (`F-07`).
8. Every `icon`/`badge`/`trailingIcon` → typed `AssetRef`; 20 `<UPLOAD_PENDING:*>` → `{kind:"pending"}` (`F-02`).
9. Every `endpoint`/`method` → `dataSourceId` (`F-05`); zero URLs remain in the schema.
10. `title`/`text`/`subtitle`/`meta` → `TextValue`; 4 fields on the `invite` card reclassified as bindings (§4.3, `A-04`, `A-06`).
11. 2 synthetic `id`s added where the source had none (`F-16`).
12. `launcherIcon` → `appIcons` with a closed `supportedIconIds` catalog; 3 of 7 campaigns excluded from the publishable seed pending real assets/dates (`A-11`, `A-12`).
13. Buttons and items without an `accessibilityLabel` and an empty `label` gain one, or are flagged by the validator (`F-17`).

## 7. Migration tooling (Phase 2 deliverable, planned here)

`frontend/src/schema/migrate.ts` (implemented in Phase 2) will apply the table above
programmatically and emit:

- `frontend/src/schema/fixtures/seed.published.json` — publishable v2 document.
- `migration-report.json` — every mapping decision above as structured data
  (`{ruleId, path, before, after, assumptionId?}`), rendered by the admin portal's
  "Migration notes" panel.

For Phase 1, the mapping was applied **by hand** to produce the two example documents
below, so the schema itself can be validated before any transformation code exists.

## 8. Phase-1 example documents

- [`frontend/src/schema/home-screen.schema.json`](../frontend/src/schema/home-screen.schema.json) —
  the v2 JSON Schema (2020-12) implementing every decision above.
- [`frontend/src/schema/examples/home-screen.valid.json`](../frontend/src/schema/examples/home-screen.valid.json) —
  the full home screen, fully migrated, zero placeholders, validates clean.
- [`frontend/src/schema/examples/home-screen.invalid.json`](../frontend/src/schema/examples/home-screen.invalid.json) —
  same document with 6 deliberate violations (one per major validation category) to
  prove the schema — and later the semantic validator — actually rejects them. See the
  file's `"_invalidBecause"` companion array for the list.

Both examples are validated against the schema with `ajv` as part of this phase (see
`docs/runbook.md` "Phase 1 verification").
