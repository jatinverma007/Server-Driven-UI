import SwiftUI

/// Shared background/padding wrapper every native component view applies
/// around its content, resolving `style.backgroundToken` through
/// `ThemeResolver` so every component gets the same theme-handling and
/// unknown-token fallback behavior for free instead of each view
/// reimplementing it.
public struct ComponentContainer<Content: View>: View {
    let backgroundToken: String
    let themeResolver: ThemeResolver
    @Environment(\.colorScheme) private var colorScheme
    @ViewBuilder let content: () -> Content

    public init(backgroundToken: String, themeResolver: ThemeResolver, @ViewBuilder content: @escaping () -> Content) {
        self.backgroundToken = backgroundToken
        self.themeResolver = themeResolver
        self.content = content
    }

    public var body: some View {
        content()
            .background(themeResolver.color(forToken: backgroundToken, colorScheme: colorScheme))
    }
}
