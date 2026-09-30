import Foundation

public struct ComponentItemMedia: Codable, Equatable, Sendable {
    public let leading: AssetRef?
    public let trailing: AssetRef?
    public let badge: AssetRef?
}

public struct ComponentItemStyle: Codable, Equatable, Sendable {
    public let backgroundToken: String?
    /// A themed gradient (`theme.gradients` key) for this item's tile
    /// background — e.g. the peach diagonal wash behind each Quick Actions
    /// icon (`HANDOVER--PAY` node 4908:2556). Takes precedence over
    /// `backgroundToken` when both are present and the gradient token
    /// resolves; falls back to `backgroundToken`, then to no tile at all,
    /// exactly like `ItemGridView`'s existing "no `style` → no
    /// background" behavior for items that don't opt in (`rewardsHub`,
    /// `monthlyClaim`'s items keep their current look untouched).
    ///
    /// Defaulted on the `init` parameter, never inline on the stored
    /// property — an inline `= nil` is assigned straight through by the
    /// synthesized `init(from:)`, which then never decodes the key, so
    /// this was permanently `nil` regardless of the payload and every
    /// tile silently fell back to its flat `backgroundToken`. Same trap
    /// as `ThemeSpec.gradients` and `ScreenStyle.backgroundGradientToken`.
    public let backgroundGradientToken: String?
    /// A themed color token for the tile's 1pt border (e.g. the `#ffd7b7`
    /// border around each Quick Actions icon). Optional and independent of
    /// the fill — a tile can have a background with no border or vice
    /// versa. Defaulted on the `init` parameter for the same reason as
    /// `backgroundGradientToken` above.
    public let borderToken: String?

    public init(backgroundToken: String? = nil, backgroundGradientToken: String? = nil, borderToken: String? = nil) {
        self.backgroundToken = backgroundToken
        self.backgroundGradientToken = backgroundGradientToken
        self.borderToken = borderToken
    }
}

/// Mirrors `ComponentItem` — the shared shape used by every component's
/// `topItems`/`items`/`bottomItems` groups (quick actions, action-center
/// cards, recharge/bills tiles, claim rows, reward tiles). Everything but
/// `id` is optional because different item groups use different subsets
/// (docs/component-catalog.md "item-group semantics").
public struct ComponentItem: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let label: TextValue?
    public let subtitle: TextValue?
    public let meta: TextValue?
    public let media: ComponentItemMedia?
    public let accessibilityLabel: TextValue?
    public let actionId: String?
    public let dataSourceId: String?
    public let style: ComponentItemStyle?
    public let buttons: [ButtonSpec]?
}
