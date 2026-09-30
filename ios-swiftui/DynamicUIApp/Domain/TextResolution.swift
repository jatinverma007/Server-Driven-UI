import Foundation

/// What an `AssetRef` resolves down to for rendering — deliberately not a
/// `URL`, so `.bundled` (an asset-catalog name) and `.remote` (an https URL
/// loaded over the network) stay visibly distinct all the way to
/// `AsyncAssetImage`.
public enum ResolvedAsset: Equatable, Sendable {
    case remote(String)
    case bundled(String)
}

/// Pure resolution functions mirroring `frontend/src/lib/portal/textValue.ts`'s
/// `resolveText`/`resolveAssetUrl` — same semantics, same fallback rules,
/// deliberately kept in lockstep so the portal preview and the real iOS
/// renderer never silently disagree about what a binding displays
/// (docs/architecture-review.md's "no business-decision duplication"
/// requirement).
public enum TextResolution {
    public static func resolve(_ value: TextValue?, context: BindingContext) -> String {
        guard let value else { return "" }
        switch value {
        case .literal(let string):
            return string
        case .binding(let path, let fallback):
            return context.stringValue(forPath: path) ?? fallback
        }
    }

    public static func resolve(_ ref: AssetRef?, context: BindingContext) -> ResolvedAsset? {
        guard let ref else { return nil }
        switch ref {
        case .remote(let url):
            return .remote(url)
        case .bundled(let name):
            return .bundled(name)
        case .pending:
            return nil // unresolved-upload placeholder — render neutral, not an error
        case .binding(let path, let fallback):
            if let overrideURL = context.assetURL(forPath: path) {
                return .remote(overrideURL)
            }
            switch fallback {
            case .remote(let url): return .remote(url)
            case .bundled(let name): return .bundled(name)
            }
        }
    }
}
