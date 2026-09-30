import Foundation

/// The last line of defense: a configuration shipped inside the app bundle
/// itself (`Resources/fallback-home-screen.json`, kept in sync by hand with
/// `frontend/src/schema/examples/home-screen.valid.json` — see
/// `ios-swiftui/README.md`). Used only when there is no network AND no
/// usable disk cache AND no usable last-known-good revision — i.e. a
/// completely fresh install with no connectivity. Always offline-available,
/// never mutated at runtime.
public enum BundledConfigurationSource {
    public static func load() -> HomeScreenConfiguration? {
        guard let url = Bundle.module.url(forResource: "fallback-home-screen", withExtension: "json") else {
            AppLogger.error("Bundled fallback-home-screen.json is missing from the app bundle", category: .cache)
            return nil
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(HomeScreenConfiguration.self, from: data)
        } catch {
            AppLogger.error("Bundled fallback configuration failed to decode: \(error)", category: .cache)
            return nil
        }
    }
}
