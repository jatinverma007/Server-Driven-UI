import Foundation

/// What a `TextValue.binding`/`AssetRef.binding` resolves against. Kept as
/// a protocol, separate from any concrete user model, so the renderer
/// (`ServerDrivenUI`) never has a compile-time dependency on where the data
/// actually comes from — a mock profile today, a real session/data layer
/// tomorrow (docs/architecture-review.md: "resolve bindings from a separate
/// mock user-data model", kept swappable).
public protocol BindingContext: Sendable {
    /// `user.*`/`data.*` path → its current string value, or `nil` if this
    /// context has nothing for that path (the caller falls back to the
    /// binding's own `fallback` string).
    func stringValue(forPath path: String) -> String?

    /// Same idea for `AssetRef.binding` — an https URL for that path, or
    /// `nil` to fall back to the binding's `AssetRefStatic` fallback.
    func assetURL(forPath path: String) -> String?
}
