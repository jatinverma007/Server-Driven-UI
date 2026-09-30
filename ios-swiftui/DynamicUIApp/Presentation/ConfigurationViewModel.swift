import SwiftUI

/// MVVM view-model for the home screen. Owns the load/refresh lifecycle and
/// exposes exactly one `ConfigurationLoadState` for `RootView` to switch
/// on — it never exposes the repository, the network layer, or raw
/// decoding errors to the view layer directly.
@MainActor
public final class ConfigurationViewModel: ObservableObject {
    @Published public private(set) var state: ConfigurationLoadState = .loading
    @Published public var userProfile: MockUserProfile

    private let repository: ConfigurationRepository
    public let actionRegistry: ActionRegistry
    public let dataSourceRegistry: DataSourceRegistry
    private var didLoadOnce = false

    public init(
        repository: ConfigurationRepository,
        actionRegistry: ActionRegistry,
        dataSourceRegistry: DataSourceRegistry,
        initialProfile: MockUserProfile = .b2c
    ) {
        self.repository = repository
        self.actionRegistry = actionRegistry
        self.dataSourceRegistry = dataSourceRegistry
        self.userProfile = initialProfile
    }

    /// Called from `RootView`'s `.task` — safe to call on every appearance;
    /// only triggers the initial load once per view-model lifetime.
    public func onAppear() {
        guard !didLoadOnce else { return }
        didLoadOnce = true
        Task { await load() }
    }

    public func load() async {
        state = .loading
        let result = await repository.loadInitial()
        AppLogger.info("Initial load resolved to \(describe(result))", category: .lifecycle)
        state = result
    }

    /// Pull-to-refresh and the DEBUG refresh button both call this.
    ///
    /// Deliberately does NOT publish any `@Published` change before
    /// `await repository.refresh()` returns. This method runs inside the
    /// `Task` that SwiftUI's own `.refreshable { await viewModel.refresh() }`
    /// creates and owns (`RootView`'s `HomeScreenRenderer.refreshable`); this
    /// view model is held by `RootView` as a `@StateObject`, so mutating
    /// *any* `@Published` property here — including a would-be
    /// `isRefreshing` flag set at the very top of this method — fires
    /// `objectWillChange` and forces `RootView.body` to re-evaluate while
    /// that same refreshable `Task` is still in flight. That rebuilds the
    /// `HomeScreenRenderer`/`.refreshable` subtree out from under its own
    /// in-progress `Task`, and SwiftUI cancels it — surfacing as
    /// `URLError(.cancelled)` (-999) from `APIClient`, with pull-to-refresh
    /// failing and silently falling back to a stale/bundled configuration
    /// even when the backend is perfectly reachable. (This is exactly what
    /// an earlier `isRefreshing` flag here — unused by any view — was
    /// doing.) `state = result` below is safe because it happens *after*
    /// the network call has already completed, when there's no longer an
    /// in-flight `Task` left to cancel.
    public func refresh() async {
        let result = await repository.refresh()
        AppLogger.info("Refresh resolved to \(describe(result))", category: .lifecycle)
        // A refresh that regresses to .error while something was already on
        // screen would be a worse experience than just leaving the stale
        // content up with a failed-refresh log line — atomic update means
        // "only ever replace with something at least as good," so a
        // regression to .error is swallowed here rather than applied.
        if case .error = result, case .loaded = state {
            AppLogger.warning("Refresh failed with nothing usable; keeping current state on screen", category: .lifecycle)
        } else {
            state = result
        }
    }

    public func setUserType(_ userType: String) {
        userProfile = userType == "B2B" ? .b2b : .b2c
    }

    public func renderContext() -> RenderContext? {
        guard case .loaded(let config, _, _) = state else { return nil }
        return RenderContext(
            themeResolver: ThemeResolver(theme: config.theme),
            bindingContext: userProfile,
            audienceContext: AudienceContext(userType: userProfile.userType),
            actionRegistry: actionRegistry,
            dataSourceRegistry: dataSourceRegistry
        )
    }

    private func describe(_ state: ConfigurationLoadState) -> String {
        switch state {
        case .loading: return "loading"
        case .loaded(let config, let source, let stale): return "loaded(revision=\(config.revision), source=\(source), stale=\(stale))"
        case .incompatible(let installed, let required): return "incompatible(installed=\(installed), required=\(required))"
        case .error(let message): return "error(\(message))"
        }
    }
}
