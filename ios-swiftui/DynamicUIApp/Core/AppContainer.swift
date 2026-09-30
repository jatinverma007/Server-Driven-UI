import Foundation

/// The composition root — the one place concrete implementations
/// (`APIClient`, `ConfigurationCache`, `ConfigurationRepositoryImpl`) are
/// wired together and handed to the `Presentation` layer only behind their
/// protocols (`ConfigurationRepository`). `App/DynamicUIApp.swift` — the
/// three-line `@main` entry point that lives in the thin Xcode target
/// wrapping this package (see `ios-swiftui/README.md`) — is the only other
/// place that touches this type.
@MainActor
public struct AppContainer {
    public let environment: AppEnvironment
    public let repository: ConfigurationRepository
    public let actionRegistry: ActionRegistry
    public let dataSourceRegistry: DataSourceRegistry

    public init(environment: AppEnvironment, repository: ConfigurationRepository, actionRegistry: ActionRegistry, dataSourceRegistry: DataSourceRegistry) {
        self.environment = environment
        self.repository = repository
        self.actionRegistry = actionRegistry
        self.dataSourceRegistry = dataSourceRegistry
    }

    public static func live() -> AppContainer {
        let environment = AppEnvironment.live
        let apiClient = APIClient(environment: environment)
        let cache = ConfigurationCache()
        let repository = ConfigurationRepositoryImpl(apiClient: apiClient, cache: cache, environment: environment)
        return AppContainer(
            environment: environment,
            repository: repository,
            actionRegistry: .poc(),
            dataSourceRegistry: DataSourceRegistry(fetcher: apiClient)
        )
    }

    public func makeConfigurationViewModel() -> ConfigurationViewModel {
        return ConfigurationViewModel(repository: repository, actionRegistry: actionRegistry, dataSourceRegistry: dataSourceRegistry)
    }
}
