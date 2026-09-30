import Foundation

public enum StatusBarStyle: String, Codable, Sendable {
    case auto, lightContent, darkContent
}

public struct ScreenStyle: Codable, Equatable, Sendable {
    public let backgroundToken: String
    public let statusBarStyle: StatusBarStyle
    /// Optional hero-band gradient (e.g. the red-to-white wash behind the
    /// header in `HANDOVER--PAY` node 4908:2503) layered over
    /// `backgroundToken`, resolved via `ThemeResolver.gradient` — see
    /// `HomeScreenRenderer`. `nil`/unresolvable falls back to the flat
    /// `backgroundToken`, so an older payload without this field, or one
    /// naming a gradient token this client's theme doesn't have, renders
    /// exactly as before.
    ///
    /// Deliberately NOT given a default value on the stored property
    /// itself (`= nil`) — that's a well-known Codable synthesis trap: a
    /// stored property with an inline default is initialized straight to
    /// that default by the compiler-synthesized `init(from:)` and is never
    /// actually decoded from the payload, so the server's real value
    /// (`"hero.gradient2"`, etc.) was silently discarded on every fetch —
    /// this field was permanently `nil` regardless of what the JSON said,
    /// which is why the hero gradient (and the light status bar content
    /// that follows `hasHeroGradient`) never rendered even once the theme
    /// data and view hierarchy were both correct. The explicit `init`
    /// below gives it a default *parameter* instead, so
    /// `ScreenStyle(backgroundToken:statusBarStyle:)` call sites (tests,
    /// fixtures) still compile without opting into that trap.
    public let backgroundGradientToken: String?

    public init(backgroundToken: String, statusBarStyle: StatusBarStyle, backgroundGradientToken: String? = nil) {
        self.backgroundToken = backgroundToken
        self.statusBarStyle = statusBarStyle
        self.backgroundGradientToken = backgroundGradientToken
    }
}

/// Mirrors `Screen`. `components` is decoded with per-element isolation
/// (see `FailableComponent` below): a single malformed component object in
/// the array becomes a safe `.unsupported`/`decodeFailed` placeholder
/// instead of throwing and taking the rest of the screen — and the rest of
/// the *configuration* — down with it. This is the "two-stage decode"
/// mitigation from docs/architecture-review.md's crash-prevention table.
public struct Screen: Equatable, Sendable, Identifiable {
    public let screenId: String
    public let title: String
    public let style: ScreenStyle
    public let components: [Component]

    public var id: String { screenId }

    public init(screenId: String, title: String, style: ScreenStyle, components: [Component]) {
        self.screenId = screenId; self.title = title; self.style = style; self.components = components
    }
}

/// Recovers just enough of a component's top-level fields to build a
/// meaningful placeholder when the full `Component` decode fails —
/// deliberately shallow (every field optional) so recovering the envelope
/// itself can never throw.
private struct ComponentEnvelope: Decodable {
    struct StyleEnvelope: Decodable { let backgroundToken: String? }
    let componentId: String?
    let type: String?
    let componentVersion: Int?
    let enabled: Bool?
    let style: StyleEnvelope?
}

private struct FailableComponent: Decodable {
    let component: Component

    init(from decoder: Decoder) throws {
        if let ok = try? Component(from: decoder) {
            component = ok
            return
        }
        let envelope = try? ComponentEnvelope(from: decoder)
        let componentId = envelope?.componentId ?? "unrecoverable-\(UUID().uuidString.prefix(8))"
        let rawType = envelope?.type ?? "unknown"
        AppLogger.warning(
            "Component failed to decode; substituting placeholder. componentId=\(componentId) type=\(rawType)",
            category: .renderer
        )
        component = Component.placeholder(
            componentId: componentId,
            rawType: rawType,
            componentVersion: envelope?.componentVersion ?? 1,
            enabled: envelope?.enabled ?? true,
            backgroundToken: envelope?.style?.backgroundToken ?? "surface.default"
        )
    }
}

extension Screen: Codable {
    private enum CodingKeys: String, CodingKey { case screenId, title, style, components }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        screenId = try c.decode(String.self, forKey: .screenId)
        title = try c.decode(String.self, forKey: .title)
        style = try c.decode(ScreenStyle.self, forKey: .style)
        let failable = try c.decode([FailableComponent].self, forKey: .components)
        components = failable.map { $0.component }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(screenId, forKey: .screenId)
        try c.encode(title, forKey: .title)
        try c.encode(style, forKey: .style)
        try c.encode(components, forKey: .components)
    }
}
