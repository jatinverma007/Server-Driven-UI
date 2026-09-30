# ios-swiftui

The native SwiftUI client for the OmniCard server-driven home screen. SwiftUI,
MVVM + Clean Architecture layering, async/await, URLSession, Codable, XCTest —
Swift Package Manager only, no CocoaPods/Carthage/third-party UI framework
anywhere in the dependency graph. See [`../docs/architecture.md`](../docs/architecture.md)
and [`../docs/architecture-review.md`](../docs/architecture-review.md) for the
system-wide design; this file covers what's specific to this half of the repo.

## ⚠️ No Swift/Xcode toolchain in the build sandbox this was written in

This entire package was written, reviewed, and cross-checked against the
shared JSON Schema and the backend's actual API responses **without ever
running `swift build`/`swift test`/Xcode** — this container has no Swift
toolchain (`which swift swiftc` returns nothing). Concretely, that means:

- **Verified**: every model's field set and every enum's raw values were
  checked field-by-field against `frontend/src/schema/home-screen.schema.json`
  and `frontend/src/types/homeScreen.ts`; every catalog id (`AppAction`,
  `DataSourceID`) was checked one-for-one against
  `frontend/src/schema/catalog/*.ts`; every endpoint path and response shape
  in `APIClient`/`DataSourceRegistry` was checked against the routes actually
  implemented and tested in `frontend/src/app/api/v1/**` and
  `docs/api-contract.md`; the whole decode-isolation mechanism
  (`FailableWrapper`/`FailableComponent`) is a well-established Swift
  `Decodable` pattern, exercised by `ComponentDecodeIsolationTests.swift`
  with hand-constructed malformed JSON that mirrors exactly the kind of
  breakage `home-screen.invalid.json` catalogs.
- **NOT verified**: this code has not been compiled. There will very likely
  be small mechanical issues a first `swift build` would surface — a missing
  `import`, an access-level mismatch, a typo — the kind of thing a compiler
  catches in seconds and a careful read cannot fully substitute for. Treat
  this as a thorough, structurally-complete first draft that needs one real
  build pass, not as compiled-and-passing code.
- **Cannot be verified at all without a Mac**: actual on-device/simulator
  rendering, SwiftUI layout correctness, Dynamic Type behavior, VoiceOver
  behavior, dark mode appearance, and the asset-catalog/launcher-icon pieces
  (see "Bundled icon assets" below) all require Xcode.

If you have Xcode available, the fastest way to close this gap is:

```bash
cd ios-swiftui
swift build   # compiles DynamicUIAppCore on its own, no Xcode project needed
swift test    # runs DynamicUIAppTests
```

Fix whatever `swift build` reports (expect this to take under an hour for a
codebase this size — the architecture and every call site were written
deliberately, not generated blind) and then follow "Wiring this into an
Xcode project" below to actually run the app.

## What's here

```
ios-swiftui/
├── Package.swift                 # SPM package: DynamicUIAppCore (library) + DynamicUIAppTests
├── DynamicUIApp/
│   ├── App/DynamicUIApp.swift    # @main — the ONLY file outside the package, see below
│   ├── Core/                     # AppEnvironment, AppLogger, SemVer, AppContainer (DI root)
│   ├── Domain/                   # BindingContext, MockUserProfile, TextResolution, ConfigurationLoadState
│   ├── Data/                     # APIClient, ConfigurationCache, BundledConfigurationSource, ConfigurationRepository
│   ├── ServerDrivenUI/
│   │   ├── Models/                # Codable mirror of frontend/src/schema/home-screen.schema.json
│   │   ├── Validation/            # AudienceEvaluator, SchemaCompatibility, MinAppVersionValidator, ConfigurationValidator
│   │   ├── Actions/                # AppAction (closed catalog) + ActionRegistry
│   │   ├── DataSources/            # DataSourceID (closed catalog) + DataSourceRegistry
│   │   ├── Themes/                 # ThemeResolver
│   │   ├── Renderer/               # HomeScreenRenderer, RenderContext
│   │   └── Components/             # One native SwiftUI view per component type + ComponentRegistry
│   ├── DesignSystem/               # Non-server-driven layout constants + ComponentContainer
│   ├── Presentation/                # ConfigurationViewModel, RootView, BottomNavView, state views
│   └── Resources/fallback-home-screen.json   # bundled offline fallback (see "Fixtures" below)
├── DynamicUIAppTests/               # XCTest — 9 files, see "Tests" below
└── Fixtures/                        # human-browsable mirror of frontend's shared fixtures (see its own README)
```

## Wiring this into an Xcode project

**SPM alone cannot produce a runnable, signed iOS app** — there is no
`Info.plist`, no asset catalog compilation/app icon, no code signing without
an actual Xcode app target. "SPM only" in this PoC's brief means what it
means everywhere in modern iOS architecture: no CocoaPods, no Carthage, no
third-party UI framework — all *dependency management and internal
modularization* goes through SPM, which is exactly what `Package.swift`
does. The unavoidable minimum on top of that is a thin Xcode app target that
adds this folder as a local Swift Package dependency. Concretely:

1. Xcode → File → New → Project → iOS App, SwiftUI interface, name it
   `DynamicUIApp`, and **delete** the template's generated `ContentView.swift`
   and `@main App` file.
2. File → Add Package Dependencies → Add Local… → select `ios-swiftui/`
   (this folder, the one with `Package.swift`). Add `DynamicUIAppCore` to the
   app target.
3. Drag `DynamicUIApp/App/DynamicUIApp.swift` into the Xcode project (this is
   the one file that lives outside the package on purpose — see its own doc
   comment).
4. Add an App Transport Security exception to the target's `Info.plist` (the
   backend serves plain `http://`, not `https://`). `NSAllowsLocalNetworking`
   alone only covers unqualified hosts like `localhost` — it does **not**
   reliably cover a numeric LAN IP (`192.168.x.x`), which you need for a
   physical device (see step 5b). For local development, the simplest
   correct exception is:
   ```xml
   <key>NSAppTransportSecurity</key>
   <dict>
     <key>NSAllowsArbitraryLoads</key>
     <true/>
   </dict>
   ```
   `NSAllowsArbitraryLoads` disables ATS entirely for this build — fine for
   a local PoC, but it's a DEBUG-only convenience: remove it (and go through
   a real ATS exception domain, or plain HTTPS) before any release build.
5. Build and run:
   - **(a) iOS Simulator** — no extra setup. The Simulator shares the host
     Mac's network stack, so the default `http://localhost:3001/api/v1`
     (see `AppEnvironment.live`) reaches the same server you'd curl from
     Terminal. Just have `frontend`'s dev server running
     (`cd frontend && npm run dev` — see `../frontend/README.md`).
   - **(b) Physical iPhone** — `localhost` on a real device means the phone
     itself, not your Mac, so the default URL will never work there; every
     request fails and the app sits on the loading spinner forever. Instead:
     1. Find your Mac's LAN IP: **System Settings → Wi-Fi → Details…**
        (or `ipconfig getifaddr en0` in Terminal). Your iPhone must be on
        the same Wi-Fi network.
     2. In Xcode: **Product → Scheme → Edit Scheme… → Run → Arguments →
        Environment Variables**, add
        `API_BASE_URL = http://<your-mac-lan-ip>:3001/api/v1`
        (e.g. `http://192.168.1.23:3001/api/v1`). `AppEnvironment.live`
        reads this at launch — no source change or rebuild needed, just
        re-run.
     3. Make sure `frontend`'s dev server is reachable from the network,
        not just from the Mac itself: `npm run dev -- -H 0.0.0.0` (Next.js
        binds to localhost-only by default, which — like the iOS side —
        refuses connections from another device).
     4. First run on a new physical device also requires trusting the
        developer certificate once: **Settings → General → VPN & Device
        Management** on the iPhone → your developer profile → **Trust**.

## Bundled icon assets — a known, declared gap

`ComponentItem.media`/`NavigationItem.icon`/etc. reference bundled assets by
name (`AssetRef.bundled(name:)`) for icons that in a real build would live in
an `.xcassets` catalog (`"balance"`, `"kyc"`, `"arrow_right"`, the nav bar's
`"reports"`/`"rewards"`, and so on — the full list is every `"bundled"` name
in `Resources/fallback-home-screen.json`). **This repo does not include an
actual asset catalog with real artwork** — there is no icon art in the
original brief or the attached JSON to source it from, and generating
placeholder icon art wasn't part of the assignment. `AsyncAssetImage` handles
a missing bundled name gracefully (SwiftUI's `Image(name:bundle:)` simply
renders nothing for an unknown name — no crash — and the view always draws a
neutral background box underneath it), so the app runs and is fully
navigable/testable without them; it just shows placeholder boxes where real
iconography would be. Adding the real `.xcassets` catalog once art exists is
a pure asset-drop, no code change.

## Keeping fixtures in sync

`DynamicUIAppTests/Fixtures/*.json` and `Resources/fallback-home-screen.json`
are copies of `frontend/src/schema/examples/home-screen.valid.json` /
`home-screen.invalid.json` (`fallback-home-screen.json` additionally has its
`configurationId` changed to `cfg_home_bundled_fallback` so logs/debug UI can
tell "we're on the bundled fallback" apart from a real fetch). If you change
the shared schema or its example fixtures, update all three copies plus the
top-level `ios-swiftui/Fixtures/` human-browsable mirror in the same change —
`ModelDecodingTests.swift` decoding the real fixture end-to-end is the
regression check that would catch drift once a Swift toolchain is available
to actually run it.

## Architecture notes (the things worth explaining, not just listing)

- **Two-stage / per-element decode isolation** (`ServerDrivenUI/Models/Screen.swift`,
  `DecodingUtilities.swift`): a malformed component object, or a malformed
  item inside `topItems`/`items`/`bottomItems`, is swapped for a safe
  placeholder instead of throwing and failing the whole array. This is what
  makes "one bad component can't blank the screen" and "unknown components
  must not crash" actually true at the decode boundary, not just at the
  registry-dispatch boundary. `ComponentDecodeIsolationTests.swift` proves it
  with hand-built malformed JSON.
- **Closed catalogs, no reflection** (`AppAction`, `DataSourceID`,
  `ComponentType`, `ComponentRegistry`, `ActionRegistry`): every id the
  backend can send is either a case in a compile-time-fixed enum or falls
  into an explicit `.unknown`/`.unsupported` case that is logged and safely
  ignored. There is no code path anywhere that turns a server-supplied
  string into a URL fetch, a dynamic selector, or an `eval`-like operation.
- **Defense in depth on validation**: the backend already refuses to
  *publish* anything invalid (`frontend/src/lib/validation/semanticValidator.ts`).
  iOS re-validates anyway (`ConfigurationValidator`) because it must never
  assume a payload reaching `/published` was actually validated — see that
  file's doc comment for exactly which conditions are hard-rejects here vs.
  soft warnings, and why the two lists deliberately differ from the
  backend's (a client-side reject discards a whole revision it already has
  safer fallbacks for; the backend has no such luxury at publish time).
  Recall in fact that `/publish` **always** re-validates the draft
  server-side regardless of any earlier `/validate` call — this client-side
  pass is a second, independent line of defense on top of that, not a
  replacement for it.
- **Remote → cache → last-known-good → bundled**, atomically
  (`Data/ConfigurationRepository.swift`): a config is only ever swapped in
  as a whole, validated unit; a rejected fetch never touches what's on disk
  for `.cache`/`.lastKnownGood`, and never touches what's currently
  rendered. `ConfigurationRepositoryTests.swift` exercises every branch of
  this chain, including the specific "a bad fetch must not overwrite an
  existing last-known-good" invariant.
- **Bindings resolve against a separate mock user model**
  (`Domain/MockUserProfile.swift`), never against anything the server sent —
  the server describes *which* binding path to show, never the value
  itself. `MockUserProfile.b2b`/`.b2c` mirror the portal's
  `MOCK_RUNTIME_DATA` (`frontend/src/lib/portal/textValue.ts`) exactly, so
  the DEBUG-only B2B/B2C preview toggle in `RootView` (`DebugSourceBadge`)
  produces the same binding resolutions the portal preview shows for the
  same audience.
- **`decodeFailed`/`.unsupported` never reach RELEASE users as visible
  chrome** (`UnsupportedComponentView`): `#if DEBUG` shows a labeled dashed
  box; a RELEASE build renders `EmptyView()` — the component is just absent,
  which is the correct production behavior.

## Tests (`DynamicUIAppTests/`, once `swift test` can run)

| File | Covers |
|---|---|
| `ModelDecodingTests.swift` | Full valid fixture round-trip; `TextValue`/`AssetRef` discriminated (de)coding; unknown `ComponentType` string → `.unsupported`; unknown `ComponentProps` keys ignored |
| `ComponentDecodeIsolationTests.swift` | The crash-prevention property: one malformed component/item doesn't drop its siblings |
| `AudienceEvaluatorTests.swift` | Same cases as `frontend/tests/portalLogic.test.ts` — all/any/none, every operator |
| `ThemeResolverTests.swift` | Hex/8-digit-hex/`transparent` parsing; unknown token falls back instead of crashing |
| `ActionRegistryTests.swift` | Known action dispatches; unknown/unregistered/nil action ids are safe no-ops; every catalog id maps to a known `AppAction` |
| `SchemaCompatibilityTests.swift` | Same-major-compatible / different-major-incompatible / unparseable-fails-closed, `SemVer` parsing+ordering, `MinAppVersionValidator` |
| `ConfigurationValidatorTests.swift` | Hard-reject vs. soft-warning conditions, matching the file's own doc comment |
| `DataSourceRegistryTests.swift` | Known id fetches; wrong-kind id and network failure both degrade instead of throwing |
| `ConfigurationRepositoryTests.swift` | Full remote→cache→last-known-good→bundled chain; incompatible-version never cached; rejected fetch never overwrites last-known-good |
| `BindingResolutionTests.swift` | `TextValue`/`AssetRef` resolution parity with the portal's `resolveText`/`resolveAssetUrl` |

## What this does NOT implement (by design, for this PoC)

- Real authentication/session — `AppEnvironment.userType`/`MockUserProfile`
  are the documented stand-ins (see `docs/architecture-review.md`).
- Dynamic launcher-icon switching from `appIcons.campaigns` — the model
  layer carries the full contract (`IconCampaign`, `AppIconsSpec`) so a
  future increment can call `UIApplication.setAlternateIconName` from it,
  but no `Presentation`-layer code acts on it yet.
- Push-driven refresh — only pull-to-refresh and app-launch fetch. A
  real deployment would likely add a silent push to trigger `refresh()`
  sooner than the next manual pull.
