import Foundation

public enum NavigationItemVariant: String, Codable, Sendable {
    case standard
    case elevatedCenter
}

/// Mirrors `NavigationItem`. `actionId` is looked up in the closed
/// `AppAction` catalog — never a route string or deep link the server
/// invents on the fly (see `ServerDrivenUI/Actions/AppAction.swift`).
public struct NavigationItem: Codable, Equatable, Sendable {
    public let id: String
    public let label: TextValue
    public let icon: AssetRef
    public let actionId: String
    public let variant: NavigationItemVariant?
    public let audience: AudienceRule?

    public init(id: String, label: TextValue, icon: AssetRef, actionId: String, variant: NavigationItemVariant? = nil, audience: AudienceRule? = nil) {
        self.id = id; self.label = label; self.icon = icon; self.actionId = actionId
        self.variant = variant; self.audience = audience
    }
}

public struct NavigationSpec: Codable, Equatable, Sendable {
    public let bottom: [NavigationItem]
}
