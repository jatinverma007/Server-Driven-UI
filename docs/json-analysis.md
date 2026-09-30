# Phase 1 — Analysis of `dashboard_standard_response_final.json`

> The original file is preserved unchanged at
> [`docs/original-dashboard_standard_response_final.json`](./original-dashboard_standard_response_final.json)
> for side-by-side comparison. Nothing in this repository mutates it.

---

## 1. Inventory of the supplied document

### 1.1 Root-level keys

| Key | Type | Purpose (inferred) |
|---|---|---|
| `schemaVersion` | `"1.0"` | Contract version. No `major.minor.patch`, no evolution rules. |
| `minAppVersion` | object | `{ android: "0.8.8", iOS: "1.5.65" }` — minimum client build that may render this payload. |
| `themes` | map | 7 named entries, each `{ light, dark }` **background colour only**. |
| `style` | object | `{ backgroundTheme: "default", statusBar: "LIGHT" }` — screen-level chrome. |
| `launcherIcon` | object | `defaultIconId` + 7 dated `campaigns`. |
| `bottomNavigation` | array (6) | Tab bar. Order = array order. |
| `widgets` | array (8) | **Ordering + audience only** (`id`, `type`, `position`, optional `userType`). |
| `widgetData` | map (8) | **Content**, keyed by the same ids. |

### 1.2 Widget inventory

| id | type | position | userType | Content source |
|---|---|---|---|---|
| `header` | `header` | 1 | — | static + runtime fields |
| `quick_actions` | `quick_actions` | 2 | — | fully static (4 cols) |
| `action_center` | `action_center` | 3 | — | static + 1 API-backed item |
| `large_banner` | `banner` | 4 | — | fully API-backed |
| `recharge_bills` | `recharge_bills` | 5 | — | fully static (4 cols) |
| `small_banner` | `banner` | 6 | — | fully API-backed |
| `monthly_claim` | `monthly_claim` | **7** | `B2B` | static labels + API amounts |
| `rewards_hub` | `rewards_hub` | **7** | `B2C` | fully static (3 cols) |

### 1.3 Distinct `actionId` values (34)

```
add_money, cards, check_balance, complete_kyc, copy_upi_id, download_claim_report,
dth_recharge, electricity_bill, fastag, gas_bill, generate_custom_upi, history,
home, invite_approve, invite_reject, mobile_recharge, open_bharat_connect,
open_brand_vouchers, open_cashback, open_notifications, open_omnis,
open_plan_details, open_search, pay_anyone, recharge_expired_plan, reports,
request_advance, rewards, scan_pay, style_qr, view_all_bills, view_all_rewards,
view_approved_claims, view_rejected_claims
```

These become the **allowlisted action catalog** (`/frontend/src/schema/catalog/actions.ts`).
Anything not in that list is rejected at publish time and ignored at render time.

### 1.4 Data sources (4 references, 3 distinct shapes)

| Location | `endpoint` | `method` |
|---|---|---|
| `action_center.items[1].dataSource` | `user_response` | *absent* |
| `large_banner.dataSource` | `/api/v1/banners/large_banner` | `GET` |
| `small_banner.dataSource` | `/api/v1/banners/small_banner` | `GET` |
| `monthly_claim.dataSource` | `/api/v1/claims/monthly-summary` | `GET` |

### 1.5 Assets

- **18 distinct absolute HTTPS URLs** on `uat1.omnicard.co.in/file-utils/…` — all valid `https://`.
- **20 unresolved `<UPLOAD_PENDING:…>` placeholders** (see §2.2).
- **1 symbolic, non-URL icon**: `action_center.items[1].icon = "user_name_icon"`.

### 1.6 Runtime (per-user) fields referenced

| Field name | Referenced from | Declared how |
|---|---|---|
| `userName` | `header.nameField` | explicit `*Field` suffix |
| `userProfileImage` | `header.profileImageField` | explicit `*Field` suffix |
| `unreadNotificationCount` | `header.rightActions[1].badgeCountField` | explicit `*Field` suffix |
| `enterpriseName` | `header.subDetails.variants[0].valueField` | explicit `*Field` suffix |
| `planName` | `header.subDetails.variants[1].valueField` | explicit `*Field` suffix |
| `invited_user_name` | `action_center.items[1].title` | **implicit — indistinguishable from literal text** |
| `invite_mobile_no` | `action_center.items[1].meta` | **implicit** |
| `user_name_icon` | `action_center.items[1].icon` | **implicit** |

---

## 2. Defects, ambiguities and risks

Each finding has an ID used throughout the codebase, the migration report and the
validator messages.

### 2.1 `F-01` — Platform key casing is inconsistent

```json
"minAppVersion": { "android": "0.8.8", "iOS": "1.5.65" }
```

`android` is lower-case, `iOS` is camel-with-leading-lower-upper. Any generated
client model (Swift `CodingKeys`, Kotlin `@SerialName`, TS interface) needs a
bespoke mapping, and the key is easy to mistype as `ios`/`IOS`.

**Resolution:** normalized contract uses a `platformConstraints` object keyed by a
closed enum `ios | android`, all lower-case. Legacy `iOS` is accepted by the
*migration* tool only, never by the runtime schema.

### 2.2 `F-02` — 20 unresolved `<UPLOAD_PENDING:…>` placeholders

| # | Path | Token |
|---|---|---|
| 1 | `launcherIcon.campaigns[3].iconId` | `ic_launcher_ind` |
| 2 | `launcherIcon.campaigns[4].iconId` | `ic_launcher_rakhi` |
| 3 | `launcherIcon.campaigns[5].iconId` | `ic_launcher_diwali` |
| 4 | `bottomNavigation[3].icon` | `reports` |
| 5 | `bottomNavigation[4].icon` | `rewards` |
| 6 | `widgetData.header.subDetails.variants[1].icon` | `upgrade_badge` |
| 7 | `widgetData.quick_actions.topItems[0].icon` | `balance` |
| 8 | `widgetData.quick_actions.items[2].icon` | `add_money` |
| 9 | `widgetData.quick_actions.bottomItems[2].icon` | `style_qr` |
| 10 | `widgetData.action_center.items[0].icon` | `kyc` |
| 11 | `widgetData.action_center.items[0].buttons[0].icon` | `arrow_right` |
| 12 | `widgetData.action_center.items[1].buttons[0].icon` | `invite_reject` |
| 13 | `widgetData.action_center.items[1].buttons[1].icon` | `invite_approve` |
| 14 | `widgetData.action_center.items[2].icon` | `quick_request` |
| 15 | `widgetData.action_center.items[2].buttons[0].icon` | `arrow` |
| 16 | `widgetData.recharge_bills.topItems[0].icon` | `bharat_connect` |
| 17 | `widgetData.recharge_bills.bottomItems[0].icon` | `wallet_alert` |
| 18 | `widgetData.recharge_bills.bottomItems[1].icon` | `arrow_right` |
| 19 | `widgetData.monthly_claim.topItems[0].icon` | `download` |
| 20 | `widgetData.rewards_hub.topItems[0].icon` | `arrow` |

These are *editorial TODOs shipped inside a production-shaped payload*. If a client
naively treats `icon` as a URL it will attempt to load
`<UPLOAD_PENDING:kyc>` as a network resource.

**Resolution:**
- Assets become a tagged union: `{kind:"remote",url}` | `{kind:"bundled",name}` | `{kind:"pending",ref}`.
- `kind:"pending"` is **legal in a draft and rejected at publish** (`E_UNRESOLVED_PLACEHOLDER`).
- iOS `AssetLoader` renders a neutral placeholder for `pending` and never issues a request.
- The migration tool converts each token to `{kind:"pending",ref:"kyc"}` so the admin can
  see exactly what still needs an upload, and to `{kind:"bundled"}` where a local asset exists.

### 2.3 `F-03` — 6 unresolved `<CONFIRM_DATE>` values

`launcherIcon.campaigns[2]` (holi), `[4]` (raksha_bandhan), `[5]` (diwali) each have
both `startDate` and `endDate` set to `<CONFIRM_DATE>`. A date parser will throw or
silently produce a null date, which in a naive implementation means "campaign is
always active" or "never active" — neither is deterministic.

**Resolution:** `startDate`/`endDate` are `date` strings validated by JSON Schema
`format: "date"`; the placeholder is caught by the same `E_UNRESOLVED_PLACEHOLDER` rule.
Campaigns additionally gain an explicit `timeZone` (see `F-13`) and `priority`.

### 2.4 `F-04` — Literal text and runtime field names are indistinguishable

```json
{
  "id": "invite",
  "icon": "user_name_icon",          // ← field name? bundled asset name?
  "title": "invited_user_name",      // ← field name
  "subtitle": "wants to activate their card",   // ← literal copy
  "meta": "invite_mobile_no"         // ← field name
}
```

Three of the four string properties of the same object use different conventions,
with no discriminator. Elsewhere the payload *does* use a discriminating suffix
(`nameField`, `valueField`, `badgeCountField`) — so the contract has **two competing
conventions**, and `action_center` uses the unsafe one.

A renderer cannot decide this correctly. Heuristics ("contains an underscore ⇒ it's a
field") break on `"Scan & Pay"` vs a future field `plan name`, and are a latent
production incident.

**Resolution:** every user-visible string becomes an explicit `TextValue`:

```jsonc
{ "kind": "literal", "value": "Complete your KYC" }
{ "kind": "binding", "path": "user.userName", "fallback": "User" }
```

`path` is restricted to an allowlisted set of runtime paths (`RUNTIME_BINDING_PATHS`),
so the server cannot address arbitrary client state. Unknown paths are rejected at
publish and fall back to `fallback` at render.

### 2.5 `F-05` — `endpoint` values are inconsistent and client-executable

- `user_response` — no leading slash, not a path; looks like a *symbolic name*.
- `/api/v1/banners/large_banner` — snake_case last segment.
- `/api/v1/claims/monthly-summary` — kebab-case last segment.
- `method` present on three, absent on one.

Beyond the cosmetic inconsistency this is the single largest **security** problem in
the payload: the server is telling the app *which URL to call*. A compromised or
mis-configured config server could point the app at an attacker host, or at a
destructive endpoint with `method: "DELETE"`.

**Resolution:** the wire format never carries a URL or a method. It carries
`{ "dataSourceId": "banners.large" }`. The app maps that id, through a compile-time
`DataSourceRegistry`, to a native repository call it already knows how to make.
Unknown ids are rejected at publish and ignored at render.

Mapping applied by the migration tool:

| Legacy endpoint | `dataSourceId` |
|---|---|
| `user_response` | `invites.pending` |
| `/api/v1/banners/large_banner` | `banners.large` |
| `/api/v1/banners/small_banner` | `banners.small` |
| `/api/v1/claims/monthly-summary` | `claims.monthlySummary` |

### 2.6 `F-06` — `isWidth` has no defined meaning

Appears 3 times, always together with `orientation: "horizontal"` +
`viewType: "scroll"` (`action_center`, `large_banner`, `small_banner`). Plausible
readings, all materially different on screen:

1. each item's width is pinned to the viewport width (paged carousel);
2. each item fills the *available* width of its container;
3. the row is allowed to size itself by intrinsic content width.

**This is not guessed.** The normalized contract replaces it with an explicit enum:

```
itemSizing: "intrinsic" | "fillViewport" | "pagedFullWidth"
```

The migration maps `isWidth: true → "fillViewport"` and records
**assumption `A-07`** in [`migration-report.json`](../frontend/src/schema/migration-report.json).
The admin portal exposes the field as a dropdown so the intended behaviour can be
corrected in one edit without a code change. The iOS renderer implements all three.

### 2.7 `F-07` — Two referenced themes do not exist

`widgetData.action_center.items[1].buttons[*].style.backgroundTheme` references
`outline_critical` and `solid_success`. Neither is a key of the root `themes` map.
A renderer that does a plain dictionary lookup gets `nil`.

There is also a **category error**: `themes` entries are *background colours*, but
`outline_critical` / `solid_success` describe a **button appearance** (fill vs outline
plus a semantic role). Putting them in the same namespace is what allowed the omission
to go unnoticed.

**Resolution:** two separate namespaces.

- `theme.tokens` — semantic colour tokens (`surface.default`, `surface.info`, `text.primary`,
  `border.critical`, …), each `{light,dark}`.
- `buttonStyle` on a button — `{ variant: "solid"|"outline"|"ghost", role: "primary"|"success"|"critical"|"neutral" }`.

`outline_critical → {variant:"outline", role:"critical"}`,
`solid_success → {variant:"solid", role:"success"}`.
Publish-time validation resolves **every** token reference against the theme map
(`E_UNKNOWN_THEME_TOKEN`).

### 2.8 `F-08` — Duplicate widget positions

`monthly_claim` and `rewards_hub` both declare `position: 7`. Today they are disjoint
by `userType`, so the collision is *latent*: the moment either becomes visible to both
audiences (or a third audience is added), ordering is non-deterministic and depends on
the client's sort stability.

There is also a **double source of truth**: `widgets` is already an ordered JSON array
*and* carries `position`. The two can disagree.

**Resolution:** order is the array order of `screen.components`. There is no `position`
field. Publish-time validation enforces unique `componentId` within a screen.

### 2.9 `F-09` — Order and content live in unrelated collections

`widgets[]` holds ordering/audience; `widgetData{}` holds content; the join key is a
bare string. Nothing prevents:

- a `widgets` entry with no matching `widgetData` (renders empty),
- an orphan `widgetData` entry (dead payload weight),
- `type` disagreeing between the two copies (it is duplicated in both),
- `userType` disagreeing between the two copies — which **already happens**:
  `monthly_claim` declares `userType: "B2B"` in `widgets[6]` *and* in `widgetData.monthly_claim`,
  and `rewards_hub` likewise. Two places to edit, one place to forget.

**Resolution:** a single ordered array of self-contained components:

```jsonc
{ "componentId": "...", "type": "...", "componentVersion": 1,
  "enabled": true, "audience": {...}, "style": {...}, "props": {...} }
```

### 2.10 `F-10` — `userType` is a single scalar

`"userType": "B2B"` cannot express: multiple audiences, roles, plan tiers, app-version
gates, feature flags, or "everyone except X". Absence implicitly means "all", which is
not stated anywhere.

**Resolution:** a constrained, non-executable rule object (no expression evaluation):

```jsonc
{ "all": [ { "field": "user.type", "operator": "in", "value": ["B2B"] } ] }
```

Allowed fields and operators are closed sets — see `docs/architecture.md §6`.

### 2.11 `F-11` — Static content and runtime data are interleaved

`monthly_claim` ships static labels (`Approved`, `Rejected`) and static colour roles,
but the amounts come from `/api/v1/claims/monthly-summary`. `action_center.items[1]`
is a static card shape whose text comes from `user_response`. Nothing in the payload
says *which* prop is filled by the data source, so the client must hard-code the join —
defeating the point of server-driven UI.

**Resolution:** a component that consumes a data source declares
`dataSourceId` plus `TextValue` bindings whose `path` is rooted at `data.` for that
component's response (`data.approvedAmount`, `data.invitedUserName`, …). Layout config
and runtime business data stay in separate transport: the **published configuration
never contains user data**.

### 2.12 `F-12` — Action identifiers are unconstrained strings

Any `actionId` the server invents will reach the client's routing layer. Without an
allowlist this is the pivot from "content update" to "remote navigation control", and
in a wallet app that includes money-moving screens.

**Resolution:** `/api/v1/action-catalog` is the source of truth; the portal only offers
catalog values in dropdowns; publish rejects unknown ids (`E_UNKNOWN_ACTION`); iOS
decodes `actionId` into a typed `AppAction` enum and *ignores + logs* anything it does
not recognise. No reflection, no selector strings, no class names, no URLs.

### 2.13 `F-13` — Launcher-icon campaigns are not implementable as written on iOS

The payload implies "the server chooses the launcher icon". On iOS that is false:

- Alternate app icons must be **compiled into the bundle** and declared in
  `Info.plist → CFBundleIcons → CFBundleAlternateIcons`.
- `UIApplication.setAlternateIconName(_:)` can only select a name already present there.
- Calling it presents a **system alert** the user can decline; it cannot be silent.
- There is no API to download and install an icon at runtime. A remote URL can never
  become an app icon.

On top of that the campaign data itself is unusable:
`<UPLOAD_PENDING:…>` ids (`F-02`) can *never* resolve to a bundled icon, dates are
placeholders (`F-03`), there is **no time zone** (a date-only range is ambiguous across
IST/UTC), and there is **no overlap-resolution rule** for two campaigns covering the
same day.

**Resolution:** `appIcons` becomes an **approved icon catalog**:

```jsonc
"appIcons": {
  "defaultIconId": "ic_launcher",
  "supportedIconIds": ["ic_launcher","ic_launcher_ny","ic_launcher_26","ic_launcher_chris"],
  "timeZone": "Asia/Kolkata",
  "campaigns": [ { "id": "...", "iconId": "...", "startDate": "...", "endDate": "...", "priority": 10 } ]
}
```

- Publish rejects any `iconId` not in `supportedIconIds` (`E_UNSUPPORTED_ICON_ID`).
- `supportedIconIds` is itself validated against the icons the *current app version*
  reports; iOS additionally re-checks with `UIApplication.shared.supportedAlternateIcons`
  equivalents at runtime and falls back to `defaultIconId`.
- Overlaps resolve by highest `priority`, then earliest `startDate`, deterministically.
- Documented in [`docs/architecture.md §9`](./architecture.md).

### 2.14 `F-14` — `statusBar: "LIGHT"` contradicts the default theme

`style.backgroundTheme = "default"` is `#FFFFFF` in light mode. `statusBar: "LIGHT"`
conventionally means *light content* (white glyphs) → invisible on white. The value is
also mode-independent, so one setting cannot be right for both light and dark.

**Resolution:** `screen.statusBarStyle` is `"auto" | "lightContent" | "darkContent"`,
defaults to `auto` (derived from the resolved background luminance), and the migration
sets `auto` while recording assumption `A-09`.

### 2.15 `F-15` — Themes carry only a background colour

Each theme is `{light, dark}` — a single colour. There is no foreground, border or
accent token, so a renderer must hard-code text colours and **cannot guarantee contrast**
in either mode. `transparent` is also not a colour literal, so a strict hex validator
would reject it.

**Resolution:** `theme.tokens` is a map of semantic tokens (surface / text / border /
accent families). `transparent` is modelled explicitly as `"transparent"`, an allowed
sentinel alongside `#RRGGBB`/`#RRGGBBAA`. A minimum contrast check between
`surface.*` and its paired `text.*` runs at publish time as a **warning**.

### 2.16 `F-16` — Key naming is inconsistent across sibling item shapes

| Concept | Spellings found |
|---|---|
| visible label | `title` (33×), `text` (5×) |
| leading image | `icon`, `badge`, `trailingIcon` |
| grouping | `topItems`, `items`, `bottomItems` (roles never defined) |
| identity | `id` present on 47 nodes, **absent** on `monthly_claim.topItems[0]` and on all `action_center` buttons |

Items without an `id` cannot be targeted by analytics, A/B tests, or the admin editor.

**Resolution:** one item shape (`ComponentItem`) with `id` **required**, `label: TextValue`,
and a typed `media` slot (`leading` / `trailing` / `badge`). `topItems` / `items` /
`bottomItems` keep their names — their roles are now documented in
[`docs/component-catalog.md`](./component-catalog.md) — and each is an array of the same shape.

### 2.17 `F-17` — An icon-only button has no accessible name

`action_center.items[2].buttons[0]` is `{ "text": "", "icon": "<UPLOAD_PENDING:arrow>" }`.
Empty label + missing image = a control VoiceOver announces as "button" and nothing else.

**Resolution:** every actionable node carries `accessibilityLabel: TextValue` (required
when `label` is empty). Publish emits `E_MISSING_ACCESSIBILITY_LABEL` for an empty label
with no `accessibilityLabel`.

### 2.18 `F-18` — `priority` vs `position` are two unrelated ordering schemes

`action_center.items[*].priority` is `1,2,3`; widgets use `position`. Neither states
whether lower means first, and neither is enforced unique.

**Resolution:** array order everywhere. `priority` is dropped; the migration sorts
`action_center` items ascending by `priority` and records assumption `A-08`.

### 2.19 `F-19` — Missing operational metadata

The payload has no `configurationId`, `revision`, `status`, `environment`,
`publishedAt`, cache directives, or author. There is therefore no way to tell a draft
from a published payload, no way to roll back, and no way to reason about cache
freshness on the client.

**Resolution:** all of these are first-class in the normalized envelope.

### 2.20 `F-20` — `badge` on an item is an opaque image URL

`recharge_bills.items[0].badge` is an image URL with no semantics (offer tag? "new"?),
no text alternative, and no size contract.

**Resolution:** `media.badge` is an `AssetRef` plus a required
`accessibilityLabel` when present.

---

## 3. Assumptions register

These are **assumptions, not facts**. Each is machine-readable in
[`frontend/src/schema/migration-report.json`](../frontend/src/schema/migration-report.json) and
surfaced in the portal's "Migration notes" panel.

| ID | Assumption | Why it is needed | How to correct it |
|---|---|---|---|
| `A-01` | `widgets[].position` ascending = top-to-bottom render order. | Never stated. | Reorder in the portal (drag-and-drop). |
| `A-02` | Ties in `position` resolve by `widgets` array order (`monthly_claim` before `rewards_hub`). | `F-08`. | Reorder in the portal. |
| `A-03` | Absent `userType` means "visible to every audience". | Never stated. | Edit the audience rule per component. |
| `A-04` | `action_center.items[1]` `title`/`meta`/`icon` are **bindings**, `subtitle` is a **literal**. | `F-04`; chosen from the naming pattern and the sentence-shaped `subtitle`. | Toggle literal/binding in the portal. |
| `A-05` | `user_response` is the pending-invite feed → `invites.pending`. | `F-05`. | Change the data-source dropdown. |
| `A-06` | `header.nameField` etc. bind under `user.*` (`user.userName`, …). | Never stated. | Binding path dropdown. |
| `A-07` | `isWidth: true` → `itemSizing: "fillViewport"`. | `F-06` — genuinely undecidable. | Dropdown: `intrinsic` / `fillViewport` / `pagedFullWidth`. |
| `A-08` | `action_center.items[].priority` ascending = left-to-right. | `F-18`. | Drag-and-drop. |
| `A-09` | `statusBar: "LIGHT"` → `statusBarStyle: "auto"`. | `F-14` — the literal reading is unreadable on white. | Dropdown. |
| `A-10` | `transparent` means "no fill", not a colour. | `F-15`. | — (modelled explicitly). |
| `A-11` | Campaign dates are `Asia/Kolkata` civil dates, inclusive of `endDate`. | `F-13` — no time zone given. | `appIcons.timeZone`. |
| `A-12` | Only `ic_launcher`, `ic_launcher_ny`, `ic_launcher_26`, `ic_launcher_chris` are bundled; the three `<UPLOAD_PENDING>` icons are not shippable. | `F-02` + `F-13`. | Add the asset to the app bundle, ship an app update, then add the id to `supportedIconIds`. |
| `A-13` | `quick_actions` / `recharge_bills` `topItems` = a single full-width row above the grid; `bottomItems` = full-width rows below it. | Roles never defined; inferred from the content (`Check Balance`, `View More`). | Documented in the component catalog; layout variants are editable. |
| `A-14` | `badge` on `recharge_bills.items[0]` is a decorative offer flag. | `F-20`. | Provide an `accessibilityLabel` or remove it. |
| `A-15` | `schemaVersion "1.0"` corresponds to normalized `2.0.0`; the legacy shape is **not** served to clients. | Clean break; the app ships with a v2 bundled fallback. | — |

---

## 4. What the migration produced

`npm run migrate --workspace frontend` reads the original file and writes
`frontend/src/schema/fixtures/seed.published.json` plus `migration-report.json`.

Summary of the emitted report:

- 8 widgets → **8 components** in one ordered array, `position` removed.
- 2 audience scalars → **2 audience rules**; 6 components get the "everyone" rule.
- 34 action ids → **34 catalog entries**, all resolved.
- 4 endpoints → **4 data-source ids**, all resolved, zero URLs in the payload.
- 7 background themes → **26 semantic tokens**; 2 missing button themes (`F-07`) resolved
  into `buttonStyle` objects.
- 20 `<UPLOAD_PENDING>` → 20 `{kind:"pending"}` asset refs → **the seed cannot be published
  as-is**. `seed.published.json` replaces them with bundled placeholders so the PoC has a
  publishable baseline; `invalid.placeholders.json` keeps them to prove the rejection path.
- 6 `<CONFIRM_DATE>` → 3 campaigns dropped from the publishable seed, retained in the
  invalid fixture.
- 7 launcher campaigns → **4 publishable** (`A-12`), 3 blocked on assets.

See [`architecture.md`](./architecture.md) for the target design and
[`api-contract.md`](./api-contract.md) for the wire format.
