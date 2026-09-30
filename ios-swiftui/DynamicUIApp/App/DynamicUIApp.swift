import SwiftUI
import DynamicUIAppCore

// This file is deliberately the ONLY thing outside the `DynamicUIAppCore`
// Swift package — see `ios-swiftui/README.md`, "Wiring this into an Xcode
// project", for why SPM alone can't produce a runnable iOS app bundle and
// what the three lines below are standing in for. Everything with actual
// behavior (networking, validation, rendering, every SwiftUI view) lives in
// the package and is covered by `DynamicUIAppTests`.
@main
struct DynamicUIApp: App {
    private let container = AppContainer.live()

    var body: some Scene {
        WindowGroup {
            RootView(viewModel: container.makeConfigurationViewModel())
        }
    }
}
