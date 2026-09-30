import Foundation

/// Mirrors `TextValue` in `frontend/src/schema/home-screen.schema.json` /
/// `frontend/src/types/homeScreen.ts` 1:1: a piece of user-facing text is
/// either a literal string the backend authored, or a binding into local
/// client-side data (`user.*`/`data.*`) with a mandatory fallback. There is
/// no third option and no expression syntax — this is the entire "dynamic
/// text" surface the backend is allowed to describe (docs/architecture-review.md §6).
public enum TextValue: Equatable, Sendable {
    case literal(String)
    case binding(path: String, fallback: String)
}

extension TextValue: Codable {
    private enum CodingKeys: String, CodingKey { case kind, value, path, fallback }
    private enum Kind: String, Codable { case literal, binding }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decode(Kind.self, forKey: .kind) {
        case .literal:
            self = .literal(try c.decode(String.self, forKey: .value))
        case .binding:
            self = .binding(path: try c.decode(String.self, forKey: .path),
                             fallback: try c.decode(String.self, forKey: .fallback))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .literal(let value):
            try c.encode(Kind.literal, forKey: .kind)
            try c.encode(value, forKey: .value)
        case .binding(let path, let fallback):
            try c.encode(Kind.binding, forKey: .kind)
            try c.encode(path, forKey: .path)
            try c.encode(fallback, forKey: .fallback)
        }
    }
}
