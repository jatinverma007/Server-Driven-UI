import XCTest
@testable import DynamicUIAppCore

private struct FakeFetcher: RemoteDataFetching {
    var bannersLarge: BannersResponse = BannersResponse(banners: [Banner(id: "b1", imageUrl: "https://example.com/b1.png", actionId: nil)])
    var shouldThrow = false

    func get<T>(path: String) async throws -> T where T: Decodable {
        if shouldThrow { throw APIError.notConnected }
        switch path {
        case "/mock-data/banners/large":
            return bannersLarge as! T // swiftlint:disable:this force_cast
        case "/mock-data/invites/pending":
            return PendingInviteResponse(invitedUserName: "Rahul Verma", inviteMobileNo: "+91 90000 12345", avatarUrl: nil) as! T
        case "/mock-data/claims/monthly-summary":
            return MonthlyClaimSummaryResponse(approvedAmount: "1,200", rejectedAmount: "300", currency: "INR", approvedCount: 4, rejectedCount: 1) as! T
        default:
            throw APIError.httpError(status: 404)
        }
    }
}

final class DataSourceRegistryTests: XCTestCase {
    func testFetchesBannersForKnownDataSourceId() async {
        let registry = DataSourceRegistry(fetcher: FakeFetcher())
        let banners = await registry.fetchBanners(for: .bannersLarge)
        XCTAssertEqual(banners.count, 1)
        XCTAssertEqual(banners.first?.id, "b1")
    }

    func testFetchBannersForNonBannerIdReturnsEmptyRatherThanCrashing() async {
        let registry = DataSourceRegistry(fetcher: FakeFetcher())
        let banners = await registry.fetchBanners(for: .claimsMonthlySummary)
        XCTAssertTrue(banners.isEmpty)
    }

    func testNetworkFailureDegradesToNilRatherThanThrowing() async {
        let registry = DataSourceRegistry(fetcher: FakeFetcher(shouldThrow: true))
        let invite = await registry.fetchPendingInvite()
        XCTAssertNil(invite)
        let summary = await registry.fetchMonthlyClaimSummary()
        XCTAssertNil(summary)
        let banners = await registry.fetchBanners(for: .bannersLarge)
        XCTAssertTrue(banners.isEmpty)
    }

    func testFetchesPendingInviteAndMonthlyClaimSummary() async {
        let registry = DataSourceRegistry(fetcher: FakeFetcher())
        let invite = await registry.fetchPendingInvite()
        XCTAssertEqual(invite?.invitedUserName, "Rahul Verma")
        let summary = await registry.fetchMonthlyClaimSummary()
        XCTAssertEqual(summary?.currency, "INR")
    }
}
