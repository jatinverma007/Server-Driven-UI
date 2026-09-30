import Foundation

/// Everything a native component view needs to render itself, bundled so
/// each `ServerDrivenUI/Components/*View` takes exactly one extra
/// parameter instead of five. Built once per render pass by
/// `ConfigurationViewModel` and threaded down through
/// `HomeScreenRenderer` → `ComponentRegistry` → each component view.
public struct RenderContext {
    public let themeResolver: ThemeResolver
    public let bindingContext: BindingContext
    public let audienceContext: AudienceContext
    public let actionRegistry: ActionRegistry
    public let dataSourceRegistry: DataSourceRegistry

    public init(
        themeResolver: ThemeResolver,
        bindingContext: BindingContext,
        audienceContext: AudienceContext,
        actionRegistry: ActionRegistry,
        dataSourceRegistry: DataSourceRegistry
    ) {
        self.themeResolver = themeResolver
        self.bindingContext = bindingContext
        self.audienceContext = audienceContext
        self.actionRegistry = actionRegistry
        self.dataSourceRegistry = dataSourceRegistry
    }
}
