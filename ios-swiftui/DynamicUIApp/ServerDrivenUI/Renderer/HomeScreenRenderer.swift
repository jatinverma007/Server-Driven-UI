import SwiftUI

private struct HomeScrollOffsetPreferenceKey: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

/// The top-level SDUI renderer: one `Screen`, filtered to its
/// enabled + audience-matching components, laid out in a vertical scroll.
/// This — plus `ComponentRegistry` and each component view — is the entire
/// "interpreter" half of the system; everything upstream of this
/// (`ConfigurationViewModel`/`ConfigurationRepository`) is just concerned
/// with getting a trustworthy `HomeScreenConfiguration` here in the first
/// place.
public struct HomeScreenRenderer: View {
    let screen: Screen
    let context: RenderContext
    private let onScrollOffsetChange: (CGFloat) -> Void
    @State private var initialScrollOffset: CGFloat?

    public init(screen: Screen, context: RenderContext, onScrollOffsetChange: @escaping (CGFloat) -> Void = { _ in }) {
        self.screen = screen
        self.context = context
        self.onScrollOffsetChange = onScrollOffsetChange
    }

    private var visibleComponents: [Component] {
        screen.components.filter { $0.enabled && AudienceEvaluator.matches($0.audience, context: context.audienceContext) }
    }

    /// Height of the optional `backgroundGradientToken` hero band. Native
    /// chrome, not schema-driven — like `DSRadius`/`DSSpacing`, this is a
    /// sizing constant the appearance itself doesn't come from
    /// (docs/architecture-review.md's "native chrome vs. server-driven
    /// content" split). 355pt is the original Figma header-band height and is
    /// kept unchanged at the top of the screen; scroll state only translates
    /// and fades this existing band.
    ///
    /// `public` (not `private`) and painted by `RootView`, not here: the
    /// band has to sit behind everything at the very top of the screen —
    /// including the `#if DEBUG` diagnostic strip and the stale banner,
    /// both of which are `RootView`'s children, not this view's. Painting
    /// it here instead left it nested under those siblings in a DEBUG
    /// build, where `.ignoresSafeArea` had nothing to reach: this view's
    /// own top edge no longer touched the actual screen edge once the
    /// debug strip pushed it down, so the gradient never got behind the
    /// status bar in a build anyone actually runs from Xcode.
    public static let heroGradientHeight: CGFloat = 355

    public var body: some View {
        ScrollView {
            // Keep the offset probe as a direct child of the ScrollView.
            // A zero-height GeometryReader inside LazyVStack can be lazily
            // recycled and stop publishing frame changes, which leaves the
            // root header gradient permanently at its initial opacity.
            GeometryReader { proxy in
                Color.clear
                    .preference(
                        key: HomeScrollOffsetPreferenceKey.self,
                        value: proxy.frame(in: .named("homeScroll")).minY
                    )
            }
            .frame(height: 0)

            LazyVStack(spacing: 0) {
                ForEach(visibleComponents) { component in
                    ComponentRegistry.view(for: component, context: context)
                }
            }
        }
        .coordinateSpace(name: "homeScroll")
        .onPreferenceChange(HomeScrollOffsetPreferenceKey.self) { offset in
            // Establish the top-of-content baseline once. Measuring the
            // delta from that baseline removes any safe-area or refresh
            // content inset, so callers receive the actual Home scroll
            // distance rather than a screen-space position.
            let baseline = initialScrollOffset ?? offset
            if initialScrollOffset == nil {
                initialScrollOffset = offset
            }
            onScrollOffsetChange(offset - baseline)
        }
    }

    /// Whether this screen, after the same filtering `body` applies, has
    /// anything to show — the "empty" state `RootView` checks for.
    public var isEmpty: Bool { visibleComponents.isEmpty }
}
