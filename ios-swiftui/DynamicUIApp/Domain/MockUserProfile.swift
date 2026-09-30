import Foundation

/// The native equivalent of the portal's `MOCK_RUNTIME_DATA`
/// (`frontend/src/lib/portal/textValue.ts`) — a stand-in for a real
/// session/profile service. `ConfigurationViewModel` picks `.b2c`/`.b2b`
/// via a DEBUG-only toggle (mirroring the portal's B2B/B2C preview switch)
/// so the same seeded configuration can be exercised both ways without a
/// real backend session.
public struct MockUserProfile: Sendable, Equatable, Hashable {
    public var userType: String
    public var values: [String: String]

    public init(userType: String, values: [String: String]) {
        self.userType = userType
        self.values = values
    }

    public static let b2c = MockUserProfile(userType: "B2C", values: [
        "user.userName": "Priya Nair",
        "user.planName": "Gold",
        "data.invitedUserName": "Rahul Verma",
        "data.inviteMobileNo": "+91 90000 12345",
    ])

    public static let b2b = MockUserProfile(userType: "B2B", values: [
        "user.userName": "Priya Nair",
        "user.enterpriseName": "Nair Textiles Pvt Ltd",
        "data.invitedUserName": "Rahul Verma",
        "data.inviteMobileNo": "+91 90000 12345",
    ])
}

extension MockUserProfile: BindingContext {
    public func stringValue(forPath path: String) -> String? { values[path] }

    /// No mock avatar URLs are seeded, matching the portal preview's own
    /// `resolveAssetUrl` — a binding with no override always falls through
    /// to its `AssetRefStatic` fallback.
    public func assetURL(forPath path: String) -> String? { nil }
}
