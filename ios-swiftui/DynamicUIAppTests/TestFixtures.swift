import Foundation
@testable import DynamicUIAppCore

enum TestFixtures {
    static func data(named name: String) -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures") else {
            fatalError("Missing fixture '\(name).json' — expected at DynamicUIAppTests/Fixtures/\(name).json")
        }
        return try! Data(contentsOf: url) // swiftlint:disable:this force_try
    }

    static func validConfiguration() -> HomeScreenConfiguration {
        try! JSONDecoder().decode(HomeScreenConfiguration.self, from: data(named: "home-screen.valid"))
    }

    /// A minimal, hand-built valid configuration for tests that want to
    /// mutate one field without carrying the full seeded fixture's detail.
    static func minimalConfiguration(revision: Int = 1, schemaVersion: String = "2.0.0", minIOSVersion: String = "1.0.0") -> HomeScreenConfiguration {
        HomeScreenConfiguration(
            configurationId: "cfg_test",
            schemaVersion: schemaVersion,
            revision: revision,
            status: .published,
            environment: .development,
            publishedAt: nil,
            createdAt: nil,
            updatedAt: nil,
            cache: CacheSpec(maxAgeSeconds: 300),
            platformConstraints: PlatformConstraints(minAppVersion: MinAppVersion(ios: minIOSVersion, android: "1.0.0")),
            theme: ThemeSpec(tokens: ["surface.default": ColorPair(light: "#FFFFFF", dark: "#000000")]),
            appIcons: AppIconsSpec(defaultIconId: "ic_launcher", supportedIconIds: ["ic_launcher"], timeZone: "Asia/Kolkata", campaigns: []),
            navigation: NavigationSpec(bottom: [
                NavigationItem(id: "home", label: .literal("Home"), icon: .bundled(name: "home"), actionId: "home")
            ]),
            screens: [
                Screen(
                    screenId: "home",
                    title: "Home",
                    style: ScreenStyle(backgroundToken: "surface.default", statusBarStyle: .auto),
                    components: [
                        Component(
                            componentId: "header",
                            type: .header,
                            componentVersion: 1,
                            enabled: true,
                            style: ComponentStyle(backgroundToken: "surface.default"),
                            props: ComponentProps()
                        )
                    ]
                )
            ]
        )
    }
}
