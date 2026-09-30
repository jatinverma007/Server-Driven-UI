import Foundation

/// Typed failures the repository/view-model layer branches on. Never
/// exposes raw `URLError`/decoding internals up to the UI — those are
/// logged (`AppLogger`) and collapsed into one of these cases so
/// `ConfigurationRepository` can decide remote → cache → bundled fallback
/// without string-matching error descriptions.
public enum APIError: Error, Equatable, Sendable {
    case notConnected
    case timeout
    case httpError(status: Int)
    case decodingFailed(String)
    case notModified // 304 — caller should keep using its cached copy
    case unexpected(String)
}
