import Foundation

/// Minimal `major.minor.patch` semantic version, parsed from the same
/// `^[0-9]+\.[0-9]+\.[0-9]+$` strings the JSON Schema enforces for
/// `schemaVersion` and `platformConstraints.minAppVersion.ios`
/// (frontend/src/schema/home-screen.schema.json). No pre-release/build
/// metadata support — the contract doesn't use it.
public struct SemVer: Comparable, Sendable, CustomStringConvertible {
    public let major: Int
    public let minor: Int
    public let patch: Int

    public init(major: Int, minor: Int, patch: Int) {
        self.major = major
        self.minor = minor
        self.patch = patch
    }

    /// `nil` for anything that doesn't match `\d+\.\d+\.\d+` — callers must
    /// treat a parse failure as "incompatible", never as "compatible by
    /// default" (docs/architecture-review.md: fail closed on malformed
    /// version strings).
    public init?(_ string: String) {
        let parts = string.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3,
              let major = Int(parts[0]), let minor = Int(parts[1]), let patch = Int(parts[2]),
              major >= 0, minor >= 0, patch >= 0
        else { return nil }
        self.major = major
        self.minor = minor
        self.patch = patch
    }

    public var description: String { "\(major).\(minor).\(patch)" }

    public static func < (lhs: SemVer, rhs: SemVer) -> Bool {
        (lhs.major, lhs.minor, lhs.patch) < (rhs.major, rhs.minor, rhs.patch)
    }
}
