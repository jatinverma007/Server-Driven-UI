import SwiftUI

/// The single top-level view the app entry point shows. Switches on
/// `ConfigurationViewModel.state` to cover every state the spec asks for:
/// loading, loaded (+ stale banner), empty, incompatible, error — see
/// `Domain/ConfigurationLoadState.swift` for why "empty" is computed here
/// rather than being its own repository-level case.
public struct RootView: View {
    @StateObject private var viewModel: ConfigurationViewModel
    @Environment(\.colorScheme) private var colorScheme

    /// Shows/hides the `#if DEBUG`-only config-source strip
    /// (`DebugSourceBadge` — the "source: remote" text + B2C/B2B toggle).
    /// Flip back to `true` to bring it back for debugging; it never
    /// compiles into Release builds either way (see the `#if DEBUG` below).
    private static let showDebugSourceBadge = false

    /// Drives the "My Cards" destination (see `MyCardsView`). Native,
    /// view-local navigation state — never derived from anything the
    /// server sends; the `cards` actionId only ever tells us *that* a known
    /// button was tapped, never what should happen next
    /// (docs/architecture-review.md §6).
    @State private var showingMyCards = false
    @State private var headerGradientProgress: CGFloat = 0
    @State private var headerGradientOffset: CGFloat = 0
    private static let headerGradientFadeDistance: CGFloat = 120
    private static let headerGradientTravel: CGFloat = 36

    public init(viewModel: @autoclosure @escaping () -> ConfigurationViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                LoadingView()
            case .incompatible(let installed, let required):
                IncompatibleVersionView(installedVersion: installed, requiredVersion: required)
            case .error(let message):
                ErrorStateView(message: message) {
                    Task { await viewModel.load() }
                }
            case .loaded(let config, let source, let isStale):
                loadedContent(config: config, source: source, isStale: isStale)
            }
        }
        .task {
            viewModel.onAppear()
            // Gives the `cards` bottom-nav tab (previously a PoC no-op —
            // see `ActionRegistry.poc()`) a real native destination,
            // exactly the way that method's own doc comment anticipates:
            // "a production app would replace each with an actual
            // coordinator/navigation call." Every other seeded actionId is
            // untouched — still a logged no-op.
            viewModel.actionRegistry.register(.cards) {
                showingMyCards = true
            }
        }
        .fullScreenCover(isPresented: $showingMyCards) {
            MyCardsView(userProfile: $viewModel.userProfile) {
                showingMyCards = false
                // The toggle itself already updated `userProfile` live
                // (it's a direct `@Binding`), and `renderContext()` recomputes
                // from that on every `body` evaluation — so Home's audience
                // filtering (tabs, Quick Actions, the rewards_hub/
                // monthly_claim swap) is already correct the instant this
                // dismisses. This `refresh()` goes one step further and
                // actually re-fetches from the backend too, so "coming back
                // to Home" also picks up anything published there in the
                // meantime, not just the audience re-evaluation.
                Task { await viewModel.refresh() }
            }
        }
    }

    @ViewBuilder
    private func loadedContent(config: HomeScreenConfiguration, source: ConfigurationSource, isStale: Bool) -> some View {
        if let screen = config.screens.first, let context = viewModel.renderContext() {
            // A real `ZStack` with the hero wash as the bottom sibling,
            // NOT a `.background(alignment:content:)` modifier on the
            // VStack. Both are supposed to be equivalent for a
            // `.ignoresSafeArea()` full-bleed background, but in practice
            // the `.background` form kept losing the top-safe-area bleed
            // here across two separate placements (nested in
            // `HomeScreenRenderer`, then hoisted to this VStack) — so
            // this drops the `.background` indirection entirely in favor
            // of the more literal, more commonly-used pattern: paint the
            // background as its own view, sized/positioned by the
            // ZStack, ignoring the top safe area directly on itself.
            ZStack(alignment: .top) {
                heroBackground(
                    screen: screen,
                    context: context,
                    gradientProgress: headerGradientProgress,
                    gradientOffset: headerGradientOffset
                )
                    .ignoresSafeArea(edges: .top)

                VStack(spacing: 0) {
                    #if DEBUG
                    if Self.showDebugSourceBadge {
                        DebugSourceBadge(source: source, userProfile: $viewModel.userProfile)
                    }
                    #endif
                    if isStale {
                        StaleBanner()
                    }

                    let renderer = HomeScreenRenderer(
                        screen: screen,
                        context: context,
                        onScrollOffsetChange: { offset in
                            // The probe moves into negative coordinates as the
                            // content scrolls up. Ignore bounce in the other
                            // direction, then clamp the normalized distance so
                            // the gradient reaches white smoothly and stays
                            // there until the user returns to the top.
                            let scrollDistance = max(0, -offset)
                            let progress = min(scrollDistance / Self.headerGradientFadeDistance, 1)
                            let travel = min(
                                scrollDistance / Self.headerGradientFadeDistance * Self.headerGradientTravel,
                                Self.headerGradientTravel
                            )
                            guard abs(progress - headerGradientProgress) > 0.001
                                || abs(travel - headerGradientOffset) > 0.1 else { return }
                            var transaction = Transaction()
                            transaction.animation = nil
                            withTransaction(transaction) {
                                headerGradientProgress = progress
                                headerGradientOffset = travel
                            }
                        }
                    )
                    if renderer.isEmpty {
                        EmptyStateView()
                    } else {
                        renderer
                            .refreshable { await viewModel.refresh() }
                    }

                    BottomNavView(navigation: config.navigation, context: context)
                }
            }
            .statusBarStyle(StatusBarStyleResolver.resolve(
                screen.style.statusBarStyle,
                hasHeroGradient: screen.style.backgroundGradientToken != nil,
                colorScheme: colorScheme
            ))
        } else {
            EmptyStateView()
        }
    }

    /// The screen's flat `backgroundToken` with the optional hero-band
    /// gradient (`backgroundGradientToken`) layered on top, clipped to
    /// `HomeScreenRenderer.heroGradientHeight`. Pulled out of
    /// `loadedContent` only so the `ZStack` above reads as "background,
    /// then content" at a glance.
    @ViewBuilder
    private func heroBackground(
        screen: Screen,
        context: RenderContext,
        gradientProgress: CGFloat,
        gradientOffset: CGFloat
    ) -> some View {
        let clampedProgress = min(max(gradientProgress, 0), 1)

        ZStack(alignment: .top) {
            context.themeResolver.color(forToken: screen.style.backgroundToken, colorScheme: colorScheme)
            if let gradientToken = screen.style.backgroundGradientToken,
               let gradient = context.themeResolver.gradient(forToken: gradientToken, colorScheme: colorScheme) {
                // The white screen background remains full-screen, while the
                // gradient is constrained to the native header band. Moving
                // it inside this clipped region prevents a dark strip from
                // following later server-driven widgets.
                ZStack(alignment: .top) {
                    gradient
                        .opacity(1.0 - clampedProgress)
                        .frame(height: HomeScreenRenderer.heroGradientHeight)
                        .offset(y: -gradientOffset)

                    // Keep the destination explicitly white. This prevents
                    // any dark gradient stop from tinting the header while
                    // it is transitioning out.
                    Color.white.opacity(clampedProgress)
                }
                .frame(maxWidth: .infinity)
                .frame(height: HomeScreenRenderer.heroGradientHeight, alignment: .top)
                .clipped()
            }
        }
    }
}
