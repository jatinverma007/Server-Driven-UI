# Architecture Review — Server-Driven Home Screen

**Role:** Principal Software Architect review of `docs/original-dashboard_standard_response_final.json`
and the proposed Server-Driven UI (SDUI) system, before any application code is written.

**Companion documents:** the field-by-field defect list (`F-01`…`F-20`) and the
assumptions register (`A-01`…`A-15`) live in [`json-analysis.md`](./json-analysis.md) —
this document does not repeat them, it triages them by risk and turns them into
binding architectural decisions. The migration mechanics are in
[`json-migration-plan.md`](./json-migration-plan.md).

---

## 1. Verdict

The supplied JSON is a **reasonable v1 content payload from a system that was never
designed to be a security boundary**. It mixes layout, copy, runtime data references,
and literal navigation targets (`endpoint`) in one document with no way for a client to
tell them apart. Shipping it to a mobile client unchanged would mean the client trusts
the server to (a) tell it which URLs to call, (b) tell it which strings are safe to
treat as field lookups, and (c) never send anything malformed — none of which the
current shape can guarantee.

**Decision: adopt a new `schemaVersion: 2.x` normalized envelope** (§6) rather than
patch the v1 shape. The v1 shape is preserved verbatim as historical/reference data
only; it is never served to a client.

---

## 2. Contract ambiguities (ranked by blast radius)

| # | Ambiguity | Ref | Risk if unresolved |
|---|---|---|---|
| 1 | `endpoint` + `method` let the server name an arbitrary URL/verb | `F-05` | **Critical** — server compromise = client SSRF/data-exfil/destructive-call vector |
| 2 | `title`/`icon`/`meta` sometimes mean "literal text", sometimes "field name", with no marker | `F-04` | **High** — wrong render (shows `"invited_user_name"` as literal text) or wrong data leak (renders unintended field as text) |
| 3 | `isWidth: true` has 3 plausible layout meanings | `F-06` | **Medium** — visually broken row, not a crash |
| 4 | `userType` single scalar, "absent" meaning undefined | `F-10` | **High** — cannot express "not B2B" or multi-audience; silent over/under-exposure of a widget |
| 5 | `position` duplicated across two widgets (`F-08`) and duplicated as a second source of truth against array order (`F-09`) | `F-08`,`F-09` | **Medium** — non-deterministic ordering the moment audiences overlap |
| 6 | Two theme names used (`outline_critical`, `solid_success`) that don't exist in `themes` | `F-07` | **High** — `nil`/undefined lookup; exact crash mechanism depends on client (see §5) |
| 7 | `statusBar: "LIGHT"` on a white background | `F-14` | **Low** — cosmetic, but shows the payload was never rendered against its own theme before being authored |

## 3. Fields mixing literal values with runtime bindings

This is the single change with the largest correctness impact, so it gets its own
section rather than a table row.

**Evidence**, `widgetData.action_center.items[1]`:

```json
{
  "id": "invite",
  "icon": "user_name_icon",
  "title": "invited_user_name",
  "subtitle": "wants to activate their card",
  "meta": "invite_mobile_no",
  "dataSource": { "type": "api", "endpoint": "user_response" }
}
```

Contrast with `widgetData.header`, which *does* disambiguate, via a `*Field` suffix
convention (`nameField: "userName"`):

```json
{ "nameField": "userName", "profileImageField": "userProfileImage" }
```

So the document contains **two competing conventions** for the same concept, and the
one place that most needs disambiguation (a card whose whole purpose is to show
per-request runtime data) uses the unsafe one. A client cannot distinguish
`"title": "invited_user_name"` (a field reference) from, hypothetically,
`"title": "Send Money"` (literal, as used two objects away in `quick_actions`) without
an out-of-band naming heuristic — which will eventually collide with real copy.

**Architectural decision:** every user-visible string in the v2 contract is a
discriminated `TextValue`:

```jsonc
{ "kind": "literal", "value": "wants to activate their card" }
{ "kind": "binding", "path": "data.invitedUserName", "fallback": "Someone" }
```

`path` is validated against an allowlist per binding root:
- `user.*` — resolved from the device's local runtime-user model (never sent by the server).
- `data.*` — resolved from the component's own `dataSourceId` response, never a free path into arbitrary app state.

Neither root permits the server to name a path outside these two closed vocabularies
(`RUNTIME_BINDING_PATHS`, enforced by Zod enum + publish-time validation,
`E_UNKNOWN_BINDING_PATH`).

## 4. Invalid / unresolved placeholders

20× `<UPLOAD_PENDING:*>` and 6× `<CONFIRM_DATE>` (full inventory in `json-analysis.md §2.2–2.3`).
These are legitimate **editorial state** — a config mid-authoring — but they are
indistinguishable, at the type level, from a valid string. A naive client will:

- treat `<UPLOAD_PENDING:kyc>` as an image URL and issue a network request for it, or
- treat `<CONFIRM_DATE>` as a valid ISO date, producing `Invalid Date` / a parse
  exception depending on platform.

**Architectural decision:** placeholders are a **first-class, representable state**
(`AssetRef.kind = "pending"`), not a string convention. A pending asset is legal in a
`draft` configuration and is a hard publish-time rejection
(`E_UNRESOLVED_PLACEHOLDER`) — see §8. The client never receives a `pending` asset in
a published configuration and therefore never needs to special-case the placeholder
string itself.

## 5. Missing theme tokens

`outline_critical` and `solid_success` are referenced as `backgroundTheme` values on
two buttons but do not exist in the root `themes` map (`F-07`). This is a genuine defect
in the source data, not an interpretation issue, and it is a good concrete illustration
of **how this class of bug reaches production on each platform**:

| Client | Typical failure mode for a missing dictionary key |
|---|---|
| Swift, `[String: Theme]` subscript | Returns `nil` → optional must be force-unwrapped or the view silently gets no background → **crash if force-unwrapped, silent visual bug otherwise** |
| Web/React, `themes[name]` | Returns `undefined` → spreading `undefined` into style props → **blank/unstyled element**, and if further destructured, a `TypeError` |
| Naive JSON→struct decode with a closed enum for theme name | **Decode failure** → in a strict `Codable` implementation this can take down the *entire screen decode*, not just the one button, because `Decodable` synthesis fails top-down |

That last row is the one most relevant to this project: because `widgets`→`widgetData`
is one JSON tree, a single bad enum value anywhere in it can fail decoding for the
*whole payload* if the client uses strict nested `Codable` without per-component
isolation. This is why the v2 contract requires **per-component decode isolation**
(§9) regardless of the theme-token fix.

**Architectural decision:**
1. Split the flat `themes` (background-only) into semantic `theme.tokens`
   (`surface.*`, `text.*`, `border.*`, `accent.*`), each `{light, dark}` — a real
   design-token model instead of a single-purpose colour swatch.
2. Buttons carry a typed `buttonStyle: {variant, role}` instead of a `backgroundTheme`
   string, so `outline_critical`/`solid_success` become
   `{variant:"outline", role:"critical"}` / `{variant:"solid", role:"success"}` — no
   token lookup can miss.
3. Publish-time validation resolves **every** token reference in the document against
   `theme.tokens` and fails the publish (`E_UNKNOWN_THEME_TOKEN`) — a missing token
   can never leave draft state.

## 6. Unsafe action / API handling

Two independent unsafe patterns, both already flagged individually (`F-05`, `F-12`),
worth stating together as the core security decision of this project:

> **The backend must never be able to tell the client *where* to go or *what code* to run — only *which pre-approved capability, by name, to invoke*.**

Concretely, this repository enforces it as:

1. **No URLs, no HTTP methods, no endpoints in the wire format.** `dataSourceId` is an
   opaque string resolved by a compile-time `DataSourceRegistry` on the client into a
   native repository call. The registry, not the server, owns the URL, the verb, the
   headers, and the response shape.
2. **No selectors, class names, or arbitrary identifiers as actions.** `actionId` is
   validated server-side against `/api/v1/action-catalog` at publish time and decoded
   client-side into a closed Swift `enum AppAction`. `JSONDecoder` on an unrecognized
   raw value must not throw for the whole component — see §9 — it must degrade to
   `.unknown(raw)`, which the `ActionRegistry` logs and no-ops.
3. **No reflection.** The action → behaviour mapping is a `switch` over the enum,
   compiled into the app. A new action requires an app release, by design — the same
   tradeoff every native-navigation SDUI system makes, and the one this spec calls for.

## 7. iOS-specific limitations

### 7.1 Launcher icon campaigns (full analysis in `json-analysis.md F-13`)

The payload assumes the server can push a launcher icon. On iOS this is categorically
false:

- Icons must be **compiled into the bundle** and declared in `Info.plist`
  (`CFBundleIcons.CFBundleAlternateIcons`); nothing can be installed at runtime.
- `UIApplication.setAlternateIconName(_:)` can only select a name already present in
  that plist, presents a **system confirmation the user can decline**, and fails
  (`.badRequest` internally) for any unknown name.
- A remote image URL — which is what 3 of the 7 campaigns still need
  (`<UPLOAD_PENDING:*>`) — **can never become an installed icon**, ever, on any iOS
  version.

**Architectural decision:** `appIcons` becomes an **approved icon catalog**
(`supportedIconIds`), sourced from what the *installed app build* actually bundles.
The server may only select among ids the client already ships. An id outside that set
is rejected at publish (`E_UNSUPPORTED_ICON_ID`) and, defensively, ignored at runtime
too (defense in depth — a stale cached config from an older app build must not crash a
newer/older build that doesn't recognize the id).

### 7.2 Strict `Codable` and partial-payload failure

Swift's default `Decodable` synthesis is **all-or-nothing per container**: one
malformed field can fail the decode of its entire parent object. Naively decoding the
whole `HomeScreenConfiguration` as one nested `Decodable` graph means a single bad
component (unknown `type`, a future field shape, a bad enum case) can blank the
**entire screen**, defeating the "unknown components must not crash rendering"
requirement. Addressed in §9.

### 7.3 Dynamic Type / VoiceOver on server-controlled layout

`columns: 4` fixed grids and horizontal `scroll` rows do not automatically reflow for
larger accessibility text sizes. `layout.columns` is documented as a *hint the client
may clamp*, not a guarantee — the native `QuickActionsView` reduces effective columns
under larger Dynamic Type categories regardless of what the server sent. Documented in
`component-catalog.md`.

### 7.4 Asset loading trust boundary

`AssetLoader` must not fetch arbitrary hosts. `AssetRef.kind:"remote".url` is validated
at publish time to be `https://` (HTTP rejected outside a local-dev environment flag)
and, in a production hardening pass, would be checked against an image-host allowlist
(documented as a recommendation, not implemented in this PoC — see
`docs/runbook.md` "Production hardening").

## 8. Backward-compatibility risks

| Risk | Mitigation adopted |
|---|---|
| A future optional field appears in a component's `props` that an older app build doesn't know | Component decoding uses `additionalProperties: true` at the JSON Schema level for `props`; Swift models decode only fields they know and silently ignore the rest (never `unknownKeysStrict`) |
| A future new `type` value appears (new component kind) | Client decodes `type` into a Swift enum with an explicit `.unsupported(String)` fallback case rather than failing the decode; renderer draws nothing (RELEASE) or a labelled placeholder (DEBUG) |
| `schemaVersion` major bump changes the envelope shape itself (not just component props) | `platformConstraints` + `schemaVersion` are checked *before* attempting to decode `screens`; an incompatible major version short-circuits to "incompatible" state without ever touching the incompatible decoder — see `docs/architecture.md §8` for the full compatibility table |
| An app build older than `minAppVersion` is served a revision using a feature it can't render | `ConfigurationValidator` compares the running app version against `platformConstraints.minAppVersion.ios` *before* rendering; on failure the app keeps last-known-good and surfaces "update required" rather than attempting a partial render |
| A component references a `dataSourceId` the *client's* registry doesn't have (server ahead of client) | Registry lookup returns `nil` → component renders its static fields only, data-bound fields fall back to `TextValue.fallback`; never a crash |

## 9. Publishing and rollback risks

| Risk | Mitigation |
|---|---|
| Publish succeeds with an internally inconsistent document (dup ids, dangling audience refs, ordering collisions) | 10-point semantic validation pipeline (`docs/json-migration-plan.md §4`) runs **before** any DB write; validation and publish are two separate endpoints so the portal can show errors without mutating state |
| A publish is only half-written (revision created but "published" pointer not moved) | Both operations happen inside a single Prisma `$transaction`; the "published" pointer is a single foreign key update, atomic by construction |
| Rollback loses the ability to roll forward again | Revisions are **immutable and append-only** — "restore" creates a **new** revision that copies a prior one's content rather than moving the pointer backward destructively, so history is monotonic and always fully replayable |
| A bad revision is published and clients pick it up before anyone notices | `GET /published` supports `ETag`/`If-None-Match`; combined with iOS's own publish-time-equivalent client-side validation (§10), a structurally invalid revision cannot reach that endpoint in the first place — the last line of defense is defense-in-depth, not the primary one |
| Two editors race on the same draft | Out of scope for the PoC (single-writer assumption documented); production recommendation is optimistic concurrency via a draft `version` column, noted in `docs/runbook.md` |

## 10. Cases that could crash or blank the iOS screen — and the specific mitigation for each

This is the section the requirement "cases that could crash or blank the iOS screen"
is asking for, stated as a direct mapping from failure mode → mitigating design.

| # | Failure mode | Where it would bite | Mitigation |
|---|---|---|---|
| 1 | Top-level decode failure (any single field malformed) | Whole-document `Decodable` | **Two-stage decode**: stage 1 decodes only the envelope (`configurationId`, `schemaVersion`, `status`, `theme`, `navigation`) with `screens` deferred as `[JSONValue]`/raw; stage 2 decodes each component **independently**, catching per-component decode errors and substituting `.unsupported` rather than aborting |
| 2 | Unknown `type` on one component | Component array decode | `type` decodes to a Swift enum with `.unsupported(rawValue)` catch-all case (never a throwing `enum` init) |
| 3 | Unknown `actionId` | Tap handling | Decodes to `AppAction.unknown(String)`; `ActionRegistry.perform` no-ops + logs, never crashes |
| 4 | Unknown `dataSourceId` | Data-bound component render | Registry lookup is `Optional`; component renders with `fallback` text, no force-unwrap |
| 5 | Theme token missing on-device (stale cache vs. newer token) | Colour resolution | `ThemeResolver.resolve(token:)` always has a hard-coded neutral fallback pair, never optional force-unwrap |
| 6 | Asset URL invalid / placeholder leaked into a published payload despite server-side validation (defense in depth) | Image loading | `AssetLoader` pattern-matches `AssetRef.kind`; `"pending"` never triggers a network call, `"remote"` validates `URL(string:)` before use |
| 7 | Network fetch of `/published` fails entirely (timeout, 5xx, no connectivity) | App launch / refresh | `ConfigurationRepository` falls through remote → cache → bundled, in that order; refresh failures never clear the already-rendered state (§7.3 "Refresh behavior" in the original brief) |
| 8 | Fetched JSON is syntactically valid but **semantically** invalid (e.g., duplicate `componentId`, an audience rule referencing an unknown field) | Post-fetch, pre-render | `ConfigurationValidator` runs the **same rule set as the backend's publish validator** (ported, not reimplemented ad hoc) before the view model ever swaps state; a failing validation is treated identically to a network failure — keep last-known-good |
| 9 | First launch, no network, no cache | App launch | Bundled fallback JSON ships in the app target and is schema-identical to a real published revision (validated in CI/tests, not just "trusted") |
| 10 | `minAppVersion` on the fetched revision is newer than the running app | Post-fetch, pre-render | Version comparison happens before component decoding is even attempted; state becomes `.incompatible`, screen keeps last-known-good underneath |

---

## 11. Summary of binding decisions carried into `json-migration-plan.md` and the schema

1. New `schemaVersion: "2.x"` envelope; v1 is never served.
2. No URLs/methods in the wire format — `dataSourceId` only.
3. No free-text field-name strings — every user-visible string is `TextValue {kind: literal|binding}`.
4. Placeholders are a typed `AssetRef.kind = "pending"` state, legal only in `draft`.
5. `theme.tokens` (semantic, `{light,dark}`) replaces the flat background-only `themes`; buttons use `buttonStyle {variant, role}`.
6. Audience is a constrained, non-executable rule tree (`{all|any|none: Condition[]}`), never a single scalar.
7. Order is array order only; `position`/`priority` fields are removed.
8. `actionId` and `dataSourceId` are both closed catalogs, validated at publish and decoded to closed enums on the client with explicit "unknown" fallbacks.
9. Component decoding is isolated per-item; one bad component cannot blank the screen.
10. Launcher icons are an approved-catalog model; remote URLs can never become installed icons.
11. Publish is atomic (single DB transaction) and revisions are immutable/append-only; rollback = new revision, never a destructive pointer move.
12. iOS re-implements the same semantic validation the backend runs, so a structurally-valid-but-semantically-broken payload is rejected on-device too, independent of server-side guarantees.
