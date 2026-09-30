import Foundation

/// Checks `platformConstraints.minAppVersion.ios` against the running app's
/// own version (`AppEnvironment.appVersion`). A configuration that requires
/// a newer app than what's installed must show the "please update" state,
/// never attempt to render (a config revision authored for a newer schema
/// or newer native components is not safe to interpret with older code —
/// docs/architecture-review.md §7.3).
public enum MinAppVersionValidator {
    public enum Result: Equatable, Sendable {
        case satisfied
        case tooOld(installed: String, required: String)
        case unparseable(installed: String, required: String)
    }

    public static func check(installedVersion: String, requiredVersion: String) -> Result {
        guard let installed = SemVer(installedVersion), let required = SemVer(requiredVersion) else {
            return .unparseable(installed: installedVersion, required: requiredVersion)
        }
        return installed >= required ? .satisfied : .tooOld(installed: installedVersion, required: requiredVersion)
    }
}
