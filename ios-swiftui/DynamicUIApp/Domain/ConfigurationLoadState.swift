import Foundation

/// Where an active configuration came from — surfaced in the UI only in
/// DEBUG (a small badge) but always logged, since it's the first thing
/// worth knowing when triaging "why does this user's home screen look
/// wrong" (docs/architecture-review.md, offline/degraded-mode behavior).
public enum ConfigurationSource: Equatable, Sendable {
    case remote
    case cache
    case lastKnownGood
    case bundled
}

/// The full state machine `ConfigurationViewModel` drives `RootView` from.
/// Every state the spec asks for maps here: `.loading` (loading),
/// `.loaded(..., isStale: true)` (stale), `.incompatible` (incompatible),
/// `.error` (error) — "empty" is intentionally NOT a repository-level state
/// (whether a screen has anything to show depends on audience filtering,
/// which only `RootView`/`HomeScreenRenderer` can evaluate) and is instead
/// computed by `RootView` from a `.loaded` state's filtered component list.
public enum ConfigurationLoadState: Sendable {
    case loading
    case loaded(config: HomeScreenConfiguration, source: ConfigurationSource, isStale: Bool)
    case incompatible(installedVersion: String, requiredVersion: String)
    case error(message: String)
}
