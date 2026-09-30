import Foundation

/// Mirrors the `Component.type` enum in the shared schema — the closed set
/// of component types the native `ComponentRegistry` has a real SwiftUI
/// view for. Two different situations both decode to `.unsupported`:
/// the backend explicitly said `"unsupported"` (a known, intentional
/// placeholder — see docs/json-migration-plan.md's unmapped-widget
/// disposition), or the backend sent a type string this build has never
/// heard of (a forward-compatible additive change on a later schema minor
/// version — docs/architecture-review.md's compatibility policy: iOS must
/// degrade gracefully rather than reject the whole payload). Either way the
/// raw string is preserved for logging/debug UI, never lost silently.
public enum ComponentType: Equatable, Sendable {
    case header
    case quickActions
    case actionCenter
    case bannerCarousel
    case rechargeBills
    case monthlyClaim
    case rewardsHub
    case unsupported(rawType: String)

    /// Stable identity for switch statements / registry lookups that don't
    /// care about the original raw string.
    public var kind: String {
        switch self {
        case .header: return "header"
        case .quickActions: return "quickActions"
        case .actionCenter: return "actionCenter"
        case .bannerCarousel: return "bannerCarousel"
        case .rechargeBills: return "rechargeBills"
        case .monthlyClaim: return "monthlyClaim"
        case .rewardsHub: return "rewardsHub"
        case .unsupported(let raw): return raw
        }
    }
}

extension ComponentType: Codable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        switch raw {
        case "header": self = .header
        case "quickActions": self = .quickActions
        case "actionCenter": self = .actionCenter
        case "bannerCarousel": self = .bannerCarousel
        case "rechargeBills": self = .rechargeBills
        case "monthlyClaim": self = .monthlyClaim
        case "rewardsHub": self = .rewardsHub
        default: self = .unsupported(rawType: raw)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(kind)
    }
}
