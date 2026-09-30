import Foundation

/// Static, compile-time facts about how this build talks to the backend and
/// identifies itself. Nothing here is ever sourced from the server response
/// — the client's own identity (platform, app version, environment) is
/// intentionally outside the server-driven contract (see
/// docs/architecture-review.md §6): the backend describes UI, it never
/// tells the client who the client is.
///
/// `userType` is a mock stand-in for whatever a real session/auth layer
/// would provide (see `Domain/UserProfile.swift`) — the audience evaluator
/// in `ServerDrivenUI/Validation/AudienceEvaluator.swift` treats it exactly
/// like a real session value.
public struct AppEnvironment: Sendable {
    public let apiBaseURL: URL
    public let appVersion: String
    public let platform: String
    public var userType: String
    public let buildEnvironment: String

    /// The schema major version this compiled binary understands. Bumped
    /// only on an app release that adds native support for a breaking
    /// schema change — see `ServerDrivenUI/Validation/SchemaCompatibility.swift`.
    public let supportedSchemaMajor: Int

    public init(
        apiBaseURL: URL,
        appVersion: String,
        platform: String = "ios",
        userType: String = "B2C",
        buildEnvironment: String = "development",
        supportedSchemaMajor: Int = 2
    ) {
        self.apiBaseURL = apiBaseURL
        self.appVersion = appVersion
        self.platform = platform
        self.userType = userType
        self.buildEnvironment = buildEnvironment
        self.supportedSchemaMajor = supportedSchemaMajor
    }

    /// Default live configuration, pointed at the local Next.js backend
    /// started by `npm run dev`/`npm start` in `frontend/` (see
    /// `../frontend/README.md`). `http://localhost` requires an App
    /// Transport Security exception in the host app's Info.plist — see
    /// `ios-swiftui/README.md` "Wiring this into an Xcode project".
    ///
    /// **`localhost` only resolves to the right machine on the Simulator**
    /// (which shares the host Mac's network stack). On a **physical
    /// iPhone**, `localhost` means the phone itself — there is no server
    /// listening there, so every request fails and the app sits on the
    /// loading state forever, which is exactly the failure mode this looked
    /// like when tested on a real device (see `ios-swiftui/README.md`,
    /// "Running on a physical iPhone").
    ///
    /// To support both without a code change/rebuild, the base URL is
    /// resolvable at *launch* time, in priority order:
    /// 1. `API_BASE_URL` in the active Xcode scheme's environment variables
    ///    (Product → Scheme → Edit Scheme… → Run → Arguments) — the
    ///    easiest way to point a physical-device run at your Mac's LAN IP
    ///    without touching source or Info.plist.
    /// 2. `API_BASE_URL` in the app target's `Info.plist`, for a more
    ///    permanent override.
    /// 3. `http://localhost:3001/api/v1` — correct for the Simulator only.
    ///    (Port 3001, not Next.js's default 3000 — `frontend/package.json`'s
    ///    `dev`/`start` scripts are pinned to `-p 3001`.)
    public static let live: AppEnvironment = {
        let resolved = ProcessInfo.processInfo.environment["API_BASE_URL"]
            ?? (Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String)
            ?? "http://localhost:3001/api/v1"
        guard let url = URL(string: resolved) else {
            AppLogger.error("API_BASE_URL '\(resolved)' is not a valid URL — falling back to http://localhost:3001/api/v1", category: .network)
            return AppEnvironment(
                apiBaseURL: URL(string: "http://localhost:3001/api/v1")!,
                appVersion: (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.6.0"
            )
        }
        return AppEnvironment(
            apiBaseURL: url,
            appVersion: (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.6.0"
        )
    }()
}
