import Foundation

/// A single semantic color token's light/dark pair. Mirrors `ColorPair`.
public struct ColorPair: Codable, Equatable, Sendable {
    public let light: String
    public let dark: String
}

/// One stop in a `GradientSpec`. `colorToken` is a reference into the same
/// `theme.tokens` map every flat `backgroundToken` resolves against — a
/// gradient stop is a *dynamic* (light/dark-aware) color exactly like any
/// other themed color, never a literal hex baked into the gradient itself
/// (see `ThemeResolver.gradient`).
public struct GradientStop: Codable, Equatable, Sendable {
    public let colorToken: String
    public let location: Double
}

/// A themed gradient — `theme.gradients["hero.header"]` etc. `angle`
/// follows the CSS `linear-gradient()` convention (0° = to top, 90° = to
/// right, 180° = to bottom, clockwise) so it matches the Figma dev-mode
/// export byte-for-byte (`HANDOVER--PAY`'s `background-image:
/// linear-gradient(133deg, ...)`) without a manual conversion step when
/// porting a new design.
public struct GradientSpec: Codable, Equatable, Sendable {
    public let angle: Double
    public let stops: [GradientStop]
}

public struct ThemeSpec: Codable, Equatable, Sendable {
    public let tokens: [String: ColorPair]
    /// Optional and additive — a `ThemeSpec` decoded from a payload
    /// published before this field existed simply gets `nil` here, and
    /// every call site that consults it (`ThemeResolver.gradient`,
    /// `HomeScreenRenderer`, `ItemGridView`) already treats "no gradient
    /// for this token" as "fall back to the flat color," so older
    /// configurations keep rendering exactly as before.
    ///
    /// The default lives on the `init` parameter below, NOT inline on the
    /// stored property (`= nil`). An inline default is initialized
    /// directly by the compiler-synthesized `init(from:)`, which then
    /// never decodes the key at all — so `theme.gradients` came back `nil`
    /// on every single fetch no matter what the server sent, making
    /// `ThemeResolver.gradient(forToken:)` return `nil` for every token
    /// and silently reducing every themed gradient in the app to its flat
    /// fallback. That is why the hero wash behind the header/status bar
    /// never rendered, and why Quick Actions tiles never picked up their
    /// peach diagonal gradient. Same trap as `ScreenStyle`'s
    /// `backgroundGradientToken` and `ComponentItemStyle`'s two tokens —
    /// see those for the identical fix.
    public let gradients: [String: GradientSpec]?

    public init(tokens: [String: ColorPair], gradients: [String: GradientSpec]? = nil) {
        self.tokens = tokens
        self.gradients = gradients
    }
}

/// Mirrors `IconCampaign`. iOS does not act on these directly in this PoC
/// (dynamic launcher-icon switching would use `UIApplication.setAlternateIconName`
/// in `Presentation`) — modeled here so the full contract round-trips and so
/// a future increment can wire it up; see docs/architecture-review.md §7.1
/// for why only bundled icon ids are ever accepted.
public struct IconCampaign: Codable, Equatable, Sendable {
    public let id: String
    public let iconId: String
    public let startDate: String
    public let endDate: String
    public let priority: Int
}

public struct AppIconsSpec: Codable, Equatable, Sendable {
    public let defaultIconId: String
    public let supportedIconIds: [String]
    public let timeZone: String
    public let campaigns: [IconCampaign]
}
