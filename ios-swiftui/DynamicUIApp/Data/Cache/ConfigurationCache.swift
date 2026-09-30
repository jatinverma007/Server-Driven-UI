import Foundation

/// Disk persistence for the two protective slots the repository needs
/// beyond "whatever's in memory right now":
///
/// - `.recentFetch` — the raw bytes of the last *validated* `/published`
///   response, used so a remote failure can still show something more
///   current than the bundled fallback, and so app relaunch doesn't start
///   from a blank slate.
/// - `.lastKnownGood` — the raw bytes of the last configuration that was
///   actually accepted and rendered. In this PoC it is written at the same
///   moment as `.recentFetch` (every accepted fetch immediately becomes the
///   active render), but is kept as its own slot/API on purpose: a future
///   increment that gates "rendered" on something more (e.g. render-success
///   telemetry, a user dismissing a broken layout) only has to change
///   *when* this slot is written, not add a new storage mechanism.
///
/// Both slots are written ONLY by the repository, and only after
/// `ConfigurationValidator` accepts the payload — never with a rejected
/// revision (docs/architecture-review.md, "never replace working UI with an
/// invalid revision").
public actor ConfigurationCache {
    public enum Slot: String {
        case recentFetch = "home-screen-cache"
        case lastKnownGood = "home-screen-last-known-good"
    }

    private struct Metadata: Codable {
        let etag: String?
        let fetchedAt: Date
    }

    private let fileManager = FileManager.default
    private let directory: URL

    public init(directory: URL? = nil) {
        let base = directory
            ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        self.directory = base
        try? fileManager.createDirectory(at: base, withIntermediateDirectories: true)
    }

    private func dataURL(_ slot: Slot) -> URL { directory.appendingPathComponent("\(slot.rawValue).json") }
    private func metaURL(_ slot: Slot) -> URL { directory.appendingPathComponent("\(slot.rawValue).meta.json") }

    public func store(_ slot: Slot, rawData: Data, etag: String?, fetchedAt: Date = Date()) {
        do {
            try rawData.write(to: dataURL(slot), options: .atomic)
            let meta = Metadata(etag: etag, fetchedAt: fetchedAt)
            let metaData = try JSONEncoder.iso8601.encode(meta)
            try metaData.write(to: metaURL(slot), options: .atomic)
        } catch {
            AppLogger.warning("Failed to write cache slot \(slot.rawValue): \(error)", category: .cache)
        }
    }

    public func loadRaw(_ slot: Slot) -> Data? {
        try? Data(contentsOf: dataURL(slot))
    }

    public func loadETag(_ slot: Slot) -> String? {
        guard let data = try? Data(contentsOf: metaURL(slot)),
              let meta = try? JSONDecoder.iso8601.decode(Metadata.self, from: data) else { return nil }
        return meta.etag
    }

    public func loadFetchedAt(_ slot: Slot) -> Date? {
        guard let data = try? Data(contentsOf: metaURL(slot)),
              let meta = try? JSONDecoder.iso8601.decode(Metadata.self, from: data) else { return nil }
        return meta.fetchedAt
    }

    public func clear(_ slot: Slot) {
        try? fileManager.removeItem(at: dataURL(slot))
        try? fileManager.removeItem(at: metaURL(slot))
    }
}

private extension JSONEncoder {
    static var iso8601: JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }
}

private extension JSONDecoder {
    static var iso8601: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }
}
