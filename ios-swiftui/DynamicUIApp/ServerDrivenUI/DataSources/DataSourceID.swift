import Foundation

/// Mirrors `DATA_SOURCE_CATALOG` in `frontend/src/schema/catalog/dataSources.ts`
/// id-for-id. Just like `AppAction`, this is an opaque, catalog-checked
/// identifier — never a URL, host, or HTTP verb the server controls
/// (docs/architecture-review.md §6). The real endpoint + response shape are
/// compiled into `DataSourceRegistry`, not sent over the wire.
public enum DataSourceID: Equatable, Sendable, Hashable {
    case invitesPending
    case bannersLarge
    case bannersSmall
    case claimsMonthlySummary
    case unknown(String)

    public init(dataSourceId: String) {
        switch dataSourceId {
        case "invites.pending": self = .invitesPending
        case "banners.large": self = .bannersLarge
        case "banners.small": self = .bannersSmall
        case "claims.monthlySummary": self = .claimsMonthlySummary
        default: self = .unknown(dataSourceId)
        }
    }

    public var isKnown: Bool {
        if case .unknown = self { return false }
        return true
    }
}
