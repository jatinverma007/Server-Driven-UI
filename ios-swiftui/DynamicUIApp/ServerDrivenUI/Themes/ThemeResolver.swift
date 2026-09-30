import SwiftUI

/// Resolves a `theme.tokens` entry to a SwiftUI `Color` for the current
/// color scheme. An unknown/missing token is the exact failure mode
/// docs/architecture-review.md's theme analysis calls out per client — the
/// resolver never crashes or renders nothing for it, it logs a warning and
/// falls back to a safe neutral surface so the component still has visible
/// bounds (better a wrong-looking gray box than an invisible one).
public struct ThemeResolver {
    public let theme: ThemeSpec

    public init(theme: ThemeSpec) {
        self.theme = theme
    }

    public func color(forToken token: String, colorScheme: ColorScheme) -> Color {
        guard let pair = theme.tokens[token] else {
            AppLogger.warning("Unknown theme token '\(token)' — falling back to neutral surface", category: .theme)
            return Self.fallbackColor
        }
        let hex = colorScheme == .dark ? pair.dark : pair.light
        guard let color = Self.parse(hex) else {
            AppLogger.warning("Theme token '\(token)' has unparseable color value '\(hex)'", category: .theme)
            return Self.fallbackColor
        }
        return color
    }

    /// Same resolution as `color(forToken:colorScheme:)`, but for a token
    /// this call site knows isn't guaranteed to exist in every theme
    /// payload the app can actually be running against — a revision the
    /// device fetches from `/published` (or the bundled
    /// `fallback-home-screen.json` safety net) can legitimately lag behind
    /// newer tokens a dev-time fixture already has, e.g. `status.critical
    /// .text`/`status.success.text`/`surface.border`/`brand.primary` were
    /// all missing from the actual on-device payload during Action Center
    /// development, which silently grayed out the 360° Request card's
    /// icon ring, meta text, and button (`color(forToken:colorScheme:)`'s
    /// own fallback is a deliberately neutral gray, appropriate for a
    /// token that's genuinely unknown, not one that's simply not rolled
    /// out yet). `fallbackHex` — the same literal value Figma specifies
    /// for that color — is used instead of that gray when the token is
    /// missing or unparseable; still logs the same warning either way, so
    /// the gap remains visible in the console once the token is expected
    /// to exist everywhere. Callers should still prefer the plain
    /// `color(forToken:colorScheme:)` for tokens core to every payload
    /// (`surface.default`, `text.primary`, etc.), and reach for this
    /// overload only for additive, still-rolling-out ones.
    public func color(forToken token: String, colorScheme: ColorScheme, fallbackHex: String) -> Color {
        guard theme.tokens[token] != nil else {
            AppLogger.warning("Unknown theme token '\(token)' — using hardcoded fallback instead of neutral surface", category: .theme)
            return Self.parse(fallbackHex) ?? Self.fallbackColor
        }
        return color(forToken: token, colorScheme: colorScheme)
    }

    /// Resolves a `theme.gradients` entry the same way `color(forToken:)`
    /// resolves a flat one: every stop is looked up through `color(forToken:)`
    /// itself, so a gradient stop gets the exact same light/dark resolution
    /// and "unknown token → neutral fallback + warning log" behavior as any
    /// other themed color — a gradient is not a separate, less-safe color
    /// system, just a themed color used in more than one place at once.
    /// Returns `nil` (never a fallback gradient) for an unknown gradient
    /// token or one with fewer than 2 stops, so every call site can treat
    /// "no gradient" and "fall back to the flat `backgroundToken`" as the
    /// same case.
    public func gradient(forToken token: String, colorScheme: ColorScheme) -> LinearGradient? {
        guard let spec = theme.gradients?[token], spec.stops.count >= 2 else {
            return nil
        }
        let stops = spec.stops.map { stop in
            Gradient.Stop(color: color(forToken: stop.colorToken, colorScheme: colorScheme), location: stop.location)
        }
        let (start, end) = Self.unitPoints(forCSSAngleDegrees: spec.angle)
        return LinearGradient(gradient: Gradient(stops: stops), startPoint: start, endPoint: end)
    }

    /// Converts a CSS `linear-gradient()` angle (0° = to top, clockwise) to
    /// a SwiftUI `UnitPoint` start/end pair. SwiftUI's `LinearGradient`
    /// operates over the unit square rather than the view's actual aspect
    /// ratio the way CSS extends the gradient line to the box's corners, so
    /// this is a deliberate, documented approximation — exact for the
    /// axis-aligned case (0/90/180/270, used by `hero.header`) and visually
    /// close for an arbitrary diagonal (used by the icon-tile `chip.icon`
    /// gradient copied from Figma's `133deg`). Good enough for a PoC that
    /// intentionally doesn't force pixel equality (see docs/component
    /// -catalog.md and the visual-fidelity notes in the implementation
    /// report) — a production client with exact-CSS-angle needs would
    /// instead compute the gradient line's box-corner intersection.
    static func unitPoints(forCSSAngleDegrees angle: Double) -> (UnitPoint, UnitPoint) {
        let radians = angle * .pi / 180
        let dx = sin(radians)
        let dy = -cos(radians)
        let start = UnitPoint(x: 0.5 - dx / 2, y: 0.5 - dy / 2)
        let end = UnitPoint(x: 0.5 + dx / 2, y: 0.5 + dy / 2)
        return (start, end)
    }

    private static let fallbackColor = Color(.sRGB, red: 0.87, green: 0.87, blue: 0.87, opacity: 1)

    /// Parses `"#RRGGBB"`, `"#RRGGBBAA"`, or the literal `"transparent"` —
    /// the exact value space the schema's `ColorValue` pattern allows
    /// (`frontend/src/schema/home-screen.schema.json` `$defs.ColorValue`).
    static func parse(_ value: String) -> Color? {
        if value == "transparent" { return .clear }
        guard value.hasPrefix("#") else { return nil }
        let hexDigits = String(value.dropFirst())
        guard hexDigits.count == 6 || hexDigits.count == 8, let intValue = UInt64(hexDigits, radix: 16) else {
            return nil
        }
        let r, g, b, a: Double
        if hexDigits.count == 8 {
            r = Double((intValue >> 24) & 0xFF) / 255
            g = Double((intValue >> 16) & 0xFF) / 255
            b = Double((intValue >> 8) & 0xFF) / 255
            a = Double(intValue & 0xFF) / 255
        } else {
            r = Double((intValue >> 16) & 0xFF) / 255
            g = Double((intValue >> 8) & 0xFF) / 255
            b = Double(intValue & 0xFF) / 255
            a = 1
        }
        return Color(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}
