import Foundation

/// The compatibility policy from docs/architecture-review.md §5
/// ("Backward-compatibility risk") and docs/api-contract.md's compatibility
/// table, implemented natively:
///
/// - Same **major** as `AppEnvironment.supportedSchemaMajor` → compatible.
///   Additive minor/patch changes (new optional fields, new enum cases this
///   build doesn't recognize) must always be safe to ignore — that's the
///   whole point of `ComponentType.unsupported` and `AppAction.unknown`.
/// - Different major → incompatible. A major bump is defined (by policy,
///   not enforced by the schema itself) as reserved for changes this
///   client's model layer cannot safely degrade through, so it must not
///   attempt to render at all.
/// - Unparseable `schemaVersion` → incompatible (fail closed).
public enum SchemaCompatibility {
    public enum Result: Equatable, Sendable {
        case compatible
        case incompatibleMajorVersion(got: String, supportedMajor: Int)
        case unparseableVersion(String)
    }

    public static func check(schemaVersion: String, supportedMajor: Int) -> Result {
        guard let version = SemVer(schemaVersion) else {
            return .unparseableVersion(schemaVersion)
        }
        guard version.major == supportedMajor else {
            return .incompatibleMajorVersion(got: schemaVersion, supportedMajor: supportedMajor)
        }
        return .compatible
    }

    public static func isCompatible(schemaVersion: String, supportedMajor: Int) -> Bool {
        check(schemaVersion: schemaVersion, supportedMajor: supportedMajor) == .compatible
    }
}
