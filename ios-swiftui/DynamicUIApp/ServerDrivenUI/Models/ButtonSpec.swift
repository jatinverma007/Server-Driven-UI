import Foundation

public enum ButtonVariant: String, Codable, Sendable { case solid, outline, ghost }
public enum ButtonRole: String, Codable, Sendable { case primary, success, critical, neutral }

public struct ButtonStyleSpec: Codable, Equatable, Sendable {
    public let variant: ButtonVariant
    public let role: ButtonRole
}

public enum IconPosition: String, Codable, Sendable { case start, end }

/// Mirrors `ButtonSpec`. `actionId` is catalog-checked server-side at
/// publish time; iOS still decodes it into `AppAction` defensively (never
/// trusts that publish-time validation ran — see docs/architecture-review.md
/// "Defense in depth").
public struct ButtonSpec: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let label: TextValue
    public let icon: AssetRef?
    public let iconPosition: IconPosition?
    public let buttonStyle: ButtonStyleSpec?
    public let actionId: String
    public let accessibilityLabel: TextValue?
}
