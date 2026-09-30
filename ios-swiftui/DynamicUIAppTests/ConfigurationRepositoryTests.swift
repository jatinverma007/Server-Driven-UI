import XCTest
@testable import DynamicUIAppCore

private final class FakePublishedFetcher: PublishedConfigFetching, @unchecked Sendable {
    var result: Result<APIClient.PublishedFetchResult?, Error> = .failure(APIError.notConnected)

    func fetchPublishedHomeScreen(ifNoneMatch etag: String?) async throws -> APIClient.PublishedFetchResult? {
        try result.get()
    }
}

/// Exercises the full remote → cache → last-known-good → bundled
/// precedence chain from `ConfigurationRepositoryImpl`, and the one
/// invariant that overrides all of it: a revision that fails validation is
/// never allowed to become — or overwrite — the active configuration.
final class ConfigurationRepositoryTests: XCTestCase {
    private var tempDir: URL!
    private var environment: AppEnvironment!

    override func setUp() {
        super.setUp()
        tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        environment = AppEnvironment(apiBaseURL: URL(string: "http://localhost:3000/api/v1")!, appVersion: "9.9.9", supportedSchemaMajor: 2)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempDir)
        super.tearDown()
    }

    private func envelopeData(revision: Int = 1, minIOSVersion: String = "1.0.0", schemaVersion: String = "2.0.0") throws -> Data {
        let config = TestFixtures.minimalConfiguration(revision: revision, schemaVersion: schemaVersion, minIOSVersion: minIOSVersion)
        let envelope = PublishedEnvelope(content: config, revision: revision, publishedAt: "2026-09-21T00:00:00.000Z")
        return try JSONEncoder().encode(envelope)
    }

    func testRemoteSuccessIsReportedAsSourceRemoteAndPersistsBothCacheSlots() async throws {
        let fetcher = FakePublishedFetcher()
        let data = try envelopeData(revision: 5)
        fetcher.result = .success(.init(envelope: try JSONDecoder().decode(PublishedEnvelope.self, from: data), rawData: data, etag: "\"abc\""))
        let cache = ConfigurationCache(directory: tempDir)
        let repo = ConfigurationRepositoryImpl(apiClient: fetcher, cache: cache, environment: environment)

        let state = await repo.loadInitial()

        guard case .loaded(let config, let source, let isStale) = state else {
            return XCTFail("expected .loaded, got \(state)")
        }
        XCTAssertEqual(source, .remote)
        XCTAssertFalse(isStale)
        XCTAssertEqual(config.revision, 5)
        let cachedRaw = await cache.loadRaw(.recentFetch)
        XCTAssertNotNil(cachedRaw)
        let lkgRaw = await cache.loadRaw(.lastKnownGood)
        XCTAssertNotNil(lkgRaw)
    }

    func testRemoteFailureFallsBackToDiskCacheWhenPresentAndValid() async throws {
        let cache = ConfigurationCache(directory: tempDir)
        let cachedData = try envelopeData(revision: 3)
        await cache.store(.recentFetch, rawData: cachedData, etag: "\"cached\"", fetchedAt: Date())

        let fetcher = FakePublishedFetcher()
        fetcher.result = .failure(APIError.notConnected)
        let repo = ConfigurationRepositoryImpl(apiClient: fetcher, cache: cache, environment: environment)

        let state = await repo.refresh()

        guard case .loaded(let config, let source, _) = state else {
            return XCTFail("expected .loaded from cache, got \(state)")
        }
        XCTAssertEqual(source, .cache)
        XCTAssertEqual(config.revision, 3)
    }

    func testRemoteAndCacheFailureFallsBackToLastKnownGood() async throws {
        let cache = ConfigurationCache(directory: tempDir)
        let lkgData = try envelopeData(revision: 2)
        await cache.store(.lastKnownGood, rawData: lkgData, etag: nil, fetchedAt: Date())
        // .recentFetch intentionally left empty to force the chain past it.

        let fetcher = FakePublishedFetcher()
        fetcher.result = .failure(APIError.timeout)
        let repo = ConfigurationRepositoryImpl(apiClient: fetcher, cache: cache, environment: environment)

        let state = await repo.refresh()

        guard case .loaded(let config, let source, _) = state else {
            return XCTFail("expected .loaded from last-known-good, got \(state)")
        }
        XCTAssertEqual(source, .lastKnownGood)
        XCTAssertEqual(config.revision, 2)
    }

    func testNoRemoteNoCacheFallsBackToBundled() async {
        let cache = ConfigurationCache(directory: tempDir) // empty
        let fetcher = FakePublishedFetcher()
        fetcher.result = .failure(APIError.notConnected)
        let repo = ConfigurationRepositoryImpl(apiClient: fetcher, cache: cache, environment: environment)

        let state = await repo.refresh()

        guard case .loaded(_, let source, let isStale) = state else {
            return XCTFail("expected .loaded from bundled fallback, got \(state)")
        }
        XCTAssertEqual(source, .bundled)
        XCTAssertTrue(isStale)
    }

    func testFetchedConfigurationBelowMinAppVersionIsReportedAsIncompatibleAndNeverCached() async throws {
        let fetcher = FakePublishedFetcher()
        let data = try envelopeData(revision: 9, minIOSVersion: "99.0.0")
        fetcher.result = .success(.init(envelope: try JSONDecoder().decode(PublishedEnvelope.self, from: data), rawData: data, etag: nil))
        let cache = ConfigurationCache(directory: tempDir)
        let repo = ConfigurationRepositoryImpl(apiClient: fetcher, cache: cache, environment: environment)

        let state = await repo.loadInitial()

        guard case .incompatible(let installed, let required) = state else {
            return XCTFail("expected .incompatible, got \(state)")
        }
        XCTAssertEqual(installed, "9.9.9")
        XCTAssertEqual(required, "99.0.0")
        let cachedRaw = await cache.loadRaw(.recentFetch)
        XCTAssertNil(cachedRaw, "an incompatible revision must never be persisted as the cache/last-known-good")
    }

    func testAConfigurationThatFailsValidationNeverOverwritesAnExistingLastKnownGood() async throws {
        let cache = ConfigurationCache(directory: tempDir)
        let goodData = try envelopeData(revision: 1)
        await cache.store(.lastKnownGood, rawData: goodData, etag: nil, fetchedAt: Date())
        await cache.store(.recentFetch, rawData: goodData, etag: "\"good\"", fetchedAt: Date())

        // A "remote" response with an incompatible schema major — must be
        // rejected, and must fall back to the untouched last-known-good
        // rather than ever becoming the active configuration.
        let badConfig = TestFixtures.minimalConfiguration(revision: 99, schemaVersion: "3.0.0")
        let badEnvelope = PublishedEnvelope(content: badConfig, revision: 99, publishedAt: "2026-09-21T00:00:00.000Z")
        let badData = try JSONEncoder().encode(badEnvelope)

        let fetcher = FakePublishedFetcher()
        fetcher.result = .success(.init(envelope: badEnvelope, rawData: badData, etag: "\"bad\""))
        let repo = ConfigurationRepositoryImpl(apiClient: fetcher, cache: cache, environment: environment)

        let state = await repo.refresh()

        guard case .loaded(let config, _, _) = state else {
            return XCTFail("expected fallback to succeed with .loaded, got \(state)")
        }
        XCTAssertEqual(config.revision, 1, "must still be the old last-known-good, never the rejected revision 99")

        let lkgRawAfter = await cache.loadRaw(.lastKnownGood)
        XCTAssertEqual(lkgRawAfter, goodData, "last-known-good bytes on disk must be untouched by the rejected fetch")
    }
}
