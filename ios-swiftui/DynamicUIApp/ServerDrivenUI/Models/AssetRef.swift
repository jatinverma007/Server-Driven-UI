import Foundation

/// The non-binding subset of `AssetRef` — what a `binding` case's
/// `fallback` must resolve to if the bound path is missing. Mirrors
/// `AssetRefStatic` in the shared schema.
public enum AssetRefStatic: Equatable, Sendable {
    case remote(url: String)
    case bundled(name: String)
}

extension AssetRefStatic: Codable {
    private enum CodingKeys: String, CodingKey { case kind, url, name }
    private enum Kind: String, Codable { case remote, bundled }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decode(Kind.self, forKey: .kind) {
        case .remote: self = .remote(url: try c.decode(String.self, forKey: .url))
        case .bundled: self = .bundled(name: try c.decode(String.self, forKey: .name))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .remote(let url):
            try c.encode(Kind.remote, forKey: .kind)
            try c.encode(url, forKey: .url)
        case .bundled(let name):
            try c.encode(Kind.bundled, forKey: .kind)
            try c.encode(name, forKey: .name)
        }
    }
}

/// Mirrors `AssetRef` in the shared schema exactly: four closed kinds, never
/// an arbitrary URL string on its own and never executable content. `.pending`
/// exists because the original OmniCard JSON contained un-uploaded asset
/// placeholders (docs/json-analysis.md F-09) — the client renders a neutral
/// placeholder for it rather than treating it as an error.
public enum AssetRef: Equatable, Sendable {
    case remote(url: String)
    case bundled(name: String)
    case pending(ref: String)
    case binding(path: String, fallback: AssetRefStatic)
}

extension AssetRef: Codable {
    private enum CodingKeys: String, CodingKey { case kind, url, name, ref, path, fallback }
    private enum Kind: String, Codable { case remote, bundled, pending, binding }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decode(Kind.self, forKey: .kind) {
        case .remote: self = .remote(url: try c.decode(String.self, forKey: .url))
        case .bundled: self = .bundled(name: try c.decode(String.self, forKey: .name))
        case .pending: self = .pending(ref: try c.decode(String.self, forKey: .ref))
        case .binding:
            self = .binding(path: try c.decode(String.self, forKey: .path),
                             fallback: try c.decode(AssetRefStatic.self, forKey: .fallback))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .remote(let url):
            try c.encode(Kind.remote, forKey: .kind); try c.encode(url, forKey: .url)
        case .bundled(let name):
            try c.encode(Kind.bundled, forKey: .kind); try c.encode(name, forKey: .name)
        case .pending(let ref):
            try c.encode(Kind.pending, forKey: .kind); try c.encode(ref, forKey: .ref)
        case .binding(let path, let fallback):
            try c.encode(Kind.binding, forKey: .kind)
            try c.encode(path, forKey: .path)
            try c.encode(fallback, forKey: .fallback)
        }
    }
}
