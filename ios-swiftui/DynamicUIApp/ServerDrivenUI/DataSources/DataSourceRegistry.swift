import Foundation

/// The minimal capability `DataSourceRegistry` needs from the networking
/// layer, expressed as a protocol it owns (Clean Architecture dependency
/// inversion: `Data/Networking/APIClient.swift` conforms to this, but
/// `ServerDrivenUI` never imports networking types). A fake conforming to
/// this is all `DataSourceRegistryTests` needs.
public protocol RemoteDataFetching: Sendable {
    func get<T: Decodable>(path: String) async throws -> T
}

/// Maps the closed `DataSourceID` catalog to actual network calls against
/// this repo's own mock-data endpoints (`docs/api-contract.md`
/// `/mock-data/*`). Exactly like `ActionRegistry`, the server only ever
/// supplies the opaque id — the real path lives here, compiled in, mirroring
/// `DATA_SOURCE_CATALOG[*].mockEndpoint` in
/// `frontend/src/schema/catalog/dataSources.ts`.
///
/// Every method degrades to an empty/nil result on failure rather than
/// throwing — a failed data-source fetch means "this one component shows
/// nothing extra," never "the whole screen fails to render"
/// (docs/architecture-review.md's graceful-degradation rule applied to data,
/// not just to unknown components/actions).
public actor DataSourceRegistry {
    private let fetcher: RemoteDataFetching

    public init(fetcher: RemoteDataFetching) {
        self.fetcher = fetcher
    }

    public func fetchBanners(for id: DataSourceID) async -> [Banner] {
        let path: String
        switch id {
        case .bannersLarge: path = "/mock-data/banners/large"
        case .bannersSmall: path = "/mock-data/banners/small"
        default:
            AppLogger.warning("fetchBanners called for non-banner dataSourceId \(id)", category: .dataSource)
            return []
        }
        do {
            let response: BannersResponse = try await fetcher.get(path: path)
            return response.banners
        } catch {
            AppLogger.warning("Failed to fetch banners from \(path): \(error)", category: .dataSource)
            return []
        }
    }

    public func fetchPendingInvite() async -> PendingInviteResponse? {
        do {
            return try await fetcher.get(path: "/mock-data/invites/pending")
        } catch {
            AppLogger.warning("Failed to fetch pending invite: \(error)", category: .dataSource)
            return nil
        }
    }

    public func fetchMonthlyClaimSummary() async -> MonthlyClaimSummaryResponse? {
        do {
            return try await fetcher.get(path: "/claims/monthly-summary")
        } catch {
            // Keep the bundled local mock contract usable for older local
            // servers while the production-shaped endpoint rolls out.
            do {
                return try await fetcher.get(path: "/mock-data/claims/monthly-summary")
            } catch {
                AppLogger.warning("Failed to fetch monthly claim summary: \(error)", category: .dataSource)
                return nil
            }
        }
    }
}
