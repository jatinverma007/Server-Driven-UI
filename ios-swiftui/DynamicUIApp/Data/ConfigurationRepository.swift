import Foundation

/// What `ConfigurationViewModel` depends on — never a concrete
/// `URLSession`/SQLite/file type. `ConfigurationRepositoryImpl` is the real
/// (remote → cache → last-known-good → bundled) implementation; tests
/// substitute a fake.
public protocol ConfigurationRepository: Sendable {
    func loadInitial() async -> ConfigurationLoadState
    func refresh() async -> ConfigurationLoadState
}

/// Implements the full precedence chain from the spec:
/// **remote → disk cache → last-known-good → bundled fallback**, with the
/// one invariant that overrides all of them: a revision that fails
/// `ConfigurationValidator` or `MinAppVersionValidator` is never allowed to
/// become the active configuration, no matter which source it came from —
/// see docs/architecture-review.md, "never replace working UI with an
/// invalid revision" and "atomic config updates" (a state transition is one
/// full validated config, never a partially-applied patch).
public actor ConfigurationRepositoryImpl: ConfigurationRepository {
    private let apiClient: PublishedConfigFetching
    private let cache: ConfigurationCache
    private let environment: AppEnvironment
    private let jsonDecoder = JSONDecoder()

    public init(apiClient: PublishedConfigFetching, cache: ConfigurationCache, environment: AppEnvironment) {
        self.apiClient = apiClient
        self.cache = cache
        self.environment = environment
    }

    public func loadInitial() async -> ConfigurationLoadState {
        await refresh()
    }

    public func refresh() async -> ConfigurationLoadState {
        do {
            let etag = await cache.loadETag(.recentFetch)
            if let result = try await apiClient.fetchPublishedHomeScreen(ifNoneMatch: etag) {
                logFetchedJSON(result.rawData, context: "200 — new revision")
                return await evaluate(config: result.envelope.content, source: .remote, rawData: result.rawData, etag: result.etag, isStale: false)
            }
            // 304 Not Modified: the cached bytes are still the published
            // revision. Refresh the freshness timestamp and re-serve them —
            // still counts as a confirmed-fresh remote read.
            if let raw = await cache.loadRaw(.recentFetch),
               let envelope = try? jsonDecoder.decode(PublishedEnvelope.self, from: raw) {
                logFetchedJSON(raw, context: "304 — re-served cached bytes")
                return await evaluate(config: envelope.content, source: .remote, rawData: raw, etag: etag, isStale: false)
            }
            AppLogger.warning("Received 304 but had no cached bytes to serve — treating as a miss", category: .network)
        } catch {
            AppLogger.warning("Remote refresh failed, falling back: \(error)", category: .network)
        }
        return await fallbackAfterRemoteFailure()
    }

    /// Logs the exact bytes this refresh is about to render from — the
    /// fastest way to answer "what JSON did the device actually pull?"
    /// without a proxy: filter Xcode's console (or Console.app, subsystem
    /// `com.omnicard.dynamicui`, category `network`) for "Configuration
    /// JSON loaded" after a pull-to-refresh. `.public` privacy on
    /// `AppLogger.info` means this prints in full even on a release-signed
    /// device, not redacted to `<private>`. Deliberately logs the raw
    /// server bytes (not a re-serialized `HomeScreenConfiguration`), so
    /// what you see here is byte-for-byte what `/published` actually sent
    /// — including any field the client silently drops or doesn't model.
    private func logFetchedJSON(_ data: Data, context: String) {
        let json = String(data: data, encoding: .utf8) ?? "<\(data.count) bytes, not valid UTF-8>"
        AppLogger.info("Configuration JSON loaded (\(context)):\n\(json)", category: .network)
    }

    // MARK: - Fallback chain

    private func fallbackAfterRemoteFailure() async -> ConfigurationLoadState {
        if let cached = await loadValidated(slot: .recentFetch, source: .cache) {
            return cached
        }
        if let lastKnownGood = await loadValidated(slot: .lastKnownGood, source: .lastKnownGood) {
            return lastKnownGood
        }
        return renderBundledOrFail()
    }

    private func loadValidated(slot: ConfigurationCache.Slot, source: ConfigurationSource) async -> ConfigurationLoadState? {
        guard let raw = await cache.loadRaw(slot),
              let envelope = try? jsonDecoder.decode(PublishedEnvelope.self, from: raw) else {
            return nil
        }
        // A cached/last-known-good revision that no longer clears the bars
        // (e.g. the app itself was downgraded) is not resurrected either —
        // fall further down the chain instead.
        guard case .satisfied = MinAppVersionValidator.check(
            installedVersion: environment.appVersion,
            requiredVersion: envelope.content.platformConstraints.minAppVersion.ios
        ) else { return nil }
        guard case .acceptable = ConfigurationValidator.validate(envelope.content, supportedSchemaMajor: environment.supportedSchemaMajor) else {
            return nil
        }
        let fetchedAt = await cache.loadFetchedAt(slot)
        return .loaded(config: envelope.content, source: source, isStale: isStale(envelope.content, fetchedAt: fetchedAt))
    }

    private func renderBundledOrFail() -> ConfigurationLoadState {
        guard let bundled = BundledConfigurationSource.load() else {
            return .error(message: "No network connection, no cached configuration, and the bundled fallback is unavailable.")
        }
        // The bundled fallback is trusted by construction (it ships inside
        // the signed app binary) — still worth a defensive validation pass
        // so a hand-edit mistake in Resources/fallback-home-screen.json
        // fails loudly in tests rather than silently at runtime.
        if case .reject(let reasons) = ConfigurationValidator.validate(bundled, supportedSchemaMajor: environment.supportedSchemaMajor) {
            AppLogger.error("Bundled fallback configuration itself failed validation: \(reasons)", category: .validation)
            return .error(message: "Bundled fallback configuration is invalid.")
        }
        return .loaded(config: bundled, source: .bundled, isStale: true)
    }

    // MARK: - Shared evaluate path (remote + confirmed-fresh 304)

    private func evaluate(config: HomeScreenConfiguration, source: ConfigurationSource, rawData: Data, etag: String?, isStale: Bool) async -> ConfigurationLoadState {
        if case .tooOld(let installed, let required) = MinAppVersionValidator.check(
            installedVersion: environment.appVersion,
            requiredVersion: config.platformConstraints.minAppVersion.ios
        ) {
            AppLogger.warning("Configuration requires iOS \(required), installed app is \(installed)", category: .validation)
            return .incompatible(installedVersion: installed, requiredVersion: required)
        }

        switch ConfigurationValidator.validate(config, supportedSchemaMajor: environment.supportedSchemaMajor) {
        case .reject(let reasons):
            for reason in reasons {
                AppLogger.error("Rejecting fetched configuration: \(reason.code) — \(reason.message)", category: .validation)
            }
            return await fallbackAfterRemoteFailure()
        case .acceptable(let warnings):
            for warning in warnings {
                AppLogger.warning("Configuration warning: \(warning.code) — \(warning.message)", category: .validation)
            }
        }

        // Accepted: persist atomically as the new cache + last-known-good.
        // Both writes use the exact bytes received — never a re-serialized
        // copy — so a future decode is decoding the same thing the server
        // actually sent (and validated) at publish time.
        await cache.store(.recentFetch, rawData: rawData, etag: etag)
        await cache.store(.lastKnownGood, rawData: rawData, etag: nil)

        return .loaded(config: config, source: source, isStale: isStale)
    }

    private func isStale(_ config: HomeScreenConfiguration, fetchedAt: Date?) -> Bool {
        guard let fetchedAt else { return true }
        let maxAge = TimeInterval(config.cache?.maxAgeSeconds ?? 300)
        return Date().timeIntervalSince(fetchedAt) > maxAge
    }
}
