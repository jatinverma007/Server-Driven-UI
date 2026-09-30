import Foundation

/// Decodes `T` if possible, swallowing the error instead of propagating it.
/// The trick that makes per-element array isolation possible: an
/// `UnkeyedDecodingContainer`'s cursor only advances correctly when the
/// *wrapper's* `init(from:)` itself never throws — so decoding
/// `[FailableWrapper<T>]` always consumes every element of the JSON array,
/// even when some individual elements fail to decode as `T`, and the
/// caller gets back exactly which ones survived via `.value`.
struct FailableWrapper<T: Decodable>: Decodable {
    let value: T?
    init(from decoder: Decoder) throws {
        value = try? T(from: decoder)
    }
}

extension KeyedDecodingContainer {
    /// `decodeIfPresent([T].self, forKey:)`, but a malformed element is
    /// dropped instead of failing the whole array (and, transitively, the
    /// whole screen). Used for item groups (`topItems`/`items`/`bottomItems`)
    /// and header `rightActions` — see docs/architecture-review.md, "crash
    /// or blank screen" mitigation table.
    func decodeFailableArrayIfPresent<T: Decodable>(_ type: [T].Type, forKey key: Key) throws -> [T]? {
        guard let wrappers = try decodeIfPresent([FailableWrapper<T>].self, forKey: key) else { return nil }
        return wrappers.compactMap { $0.value }
    }
}
