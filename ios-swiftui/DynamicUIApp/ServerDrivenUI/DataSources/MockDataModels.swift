import Foundation

/// Response shapes for the backend's `/api/v1/mock-data/*` endpoints,
/// mirroring `DATA_SOURCE_CATALOG[*].responseShape` in
/// `frontend/src/schema/catalog/dataSources.ts` exactly.

public struct PendingInviteResponse: Codable, Equatable, Sendable {
    public let invitedUserName: String
    public let inviteMobileNo: String
    public let avatarUrl: String?
}

public struct Banner: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let imageUrl: String
    public let actionId: String?
}

public struct BannersResponse: Codable, Equatable, Sendable {
    public let banners: [Banner]
}

public struct MonthlyClaimSummaryResponse: Codable, Equatable, Sendable {
    public let approvedAmount: String
    public let rejectedAmount: String
    public let currency: String
    /// Claim counts backing the "9 claims" caption on each status card
    /// (Figma `HANDOVER--PAY` node 5382:7195/5382:7223) — added alongside
    /// the existing amount fields rather than as a separate data source,
    /// since both figures come from the same monthly-summary fetch.
    public let approvedCount: Int
    public let rejectedCount: Int
}
