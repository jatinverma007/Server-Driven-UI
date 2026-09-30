import Foundation

/// What `ConfigurationRepositoryImpl` needs from the network layer,
/// expressed as its own protocol (same dependency-inversion pattern as
/// `RemoteDataFetching`) so `ConfigurationRepositoryTests` can substitute a
/// fake instead of hitting a real `URLSession`.
public protocol PublishedConfigFetching: Sendable {
    func fetchPublishedHomeScreen(ifNoneMatch etag: String?) async throws -> APIClient.PublishedFetchResult?
}

/// The one and only network boundary. Talks exclusively to this backend's
/// own `/api/v1` routes (`AppEnvironment.apiBaseURL`) — there is no
/// generic "fetch this URL the server gave me" capability anywhere in the
/// app, which is what makes the "server can't send an arbitrary URL to
/// execute/load" guarantee (docs/architecture-review.md §6) actually true
/// end-to-end: remote *asset* URLs (`AssetRef.remote`) are the one
/// exception, and even those are restricted to `https://` by the schema and
/// loaded only as opaque image bytes by `AsyncAssetImage`, never as code or
/// as a fetch target for anything else.
public final class APIClient: RemoteDataFetching, PublishedConfigFetching {
    private let session: URLSession
    private let environment: AppEnvironment
    private let decoder: JSONDecoder

    public init(session: URLSession = .shared, environment: AppEnvironment) {
        self.session = session
        self.environment = environment
        self.decoder = JSONDecoder()
    }

    // MARK: RemoteDataFetching (used by DataSourceRegistry)

    public func get<T: Decodable>(path: String) async throws -> T {
        let (data, response) = try await perform(path: path, ifNoneMatch: nil)
        try Self.checkStatus(response)
        return try decode(T.self, from: data)
    }

    // MARK: Published configuration (the one endpoint iOS ever renders from)

    public struct PublishedFetchResult: Sendable {
        public let envelope: PublishedEnvelope
        public let rawData: Data
        public let etag: String?

        public init(envelope: PublishedEnvelope, rawData: Data, etag: String?) {
            self.envelope = envelope
            self.rawData = rawData
            self.etag = etag
        }
    }

    /// `GET /configurations/home/published`, with the client context
    /// documented in docs/api-contract.md as query params, and
    /// `If-None-Match` support so a healthy client mostly gets cheap 304s.
    /// Returns `nil` when the server says 304 (caller already has the
    /// current revision cached).
    public func fetchPublishedHomeScreen(ifNoneMatch etag: String?) async throws -> PublishedFetchResult? {
        let (data, response) = try await perform(path: "/configurations/home/published", ifNoneMatch: etag)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.unexpected("non-HTTP response")
        }
        if http.statusCode == 304 {
            return nil
        }
        try Self.checkStatus(response)
        let envelope = try decode(PublishedEnvelope.self, from: data)
        return PublishedFetchResult(envelope: envelope, rawData: data, etag: http.value(forHTTPHeaderField: "ETag"))
    }

    // MARK: Internals

    private func perform(path: String, ifNoneMatch: String?) async throws -> (Data, URLResponse) {
        guard var components = URLComponents(url: environment.apiBaseURL.appendingPathComponent(String(path.dropFirst(path.hasPrefix("/") ? 1 : 0))), resolvingAgainstBaseURL: false) else {
            throw APIError.unexpected("could not build URL for path \(path)")
        }
        components.queryItems = [
            URLQueryItem(name: "platform", value: environment.platform),
            URLQueryItem(name: "appVersion", value: environment.appVersion),
            URLQueryItem(name: "userType", value: environment.userType),
            URLQueryItem(name: "environment", value: environment.buildEnvironment),
        ]
        guard let url = components.url else {
            throw APIError.unexpected("could not build URL for path \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("editor", forHTTPHeaderField: "x-user-role") // read-only calls; any role can read
        if let etag = ifNoneMatch {
            request.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }
        // The `/published` response also carries a real HTTP `Cache-Control:
        // max-age=…` header (server-side: `published/route.ts`), mirroring
        // the app-level `cache.maxAgeSeconds` from the JSON body it's
        // describing. That header is meant for the app's OWN staleness
        // bookkeeping (`ConfigurationRepositoryImpl.isStale`), not as a
        // literal HTTP caching directive — but `URLRequest`'s default
        // `.useProtocolCachePolicy` obeys it anyway: `URLSession.shared`'s
        // `URLCache` serves a still-fresh (< max-age) stored response
        // straight back to the caller, without ever putting this request's
        // `If-None-Match` header on the wire. The result: every `refresh()`
        // within `max-age` of a previous fetch silently re-serves the SAME
        // stale bytes as a normal 200 — this method's own 304 handling
        // never even gets a chance to run, and a freshly-published change
        // (a new gradient color, a new background token, …) stays invisible
        // client-side for up to `max-age` seconds no matter how many times
        // the user pulls to refresh. `.reloadIgnoringLocalCacheData` routes
        // around Foundation's cache entirely so every call actually reaches
        // the network and this app's own explicit ETag/If-None-Match + 304
        // handling (see `fetchPublishedHomeScreen`) is what decides
        // freshness, exactly as designed.
        request.cachePolicy = .reloadIgnoringLocalCacheData
        do {
            return try await session.data(for: request)
        } catch let urlError as URLError {
            AppLogger.warning("Network request failed for \(path): \(urlError)", category: .network)
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost, .cannotConnectToHost, .cannotFindHost:
                throw APIError.notConnected
            case .timedOut:
                throw APIError.timeout
            default:
                throw APIError.unexpected(urlError.localizedDescription)
            }
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            AppLogger.warning("Failed to decode \(T.self): \(error)", category: .network)
            throw APIError.decodingFailed(String(describing: error))
        }
    }

    private static func checkStatus(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.httpError(status: http.statusCode)
        }
    }
}
