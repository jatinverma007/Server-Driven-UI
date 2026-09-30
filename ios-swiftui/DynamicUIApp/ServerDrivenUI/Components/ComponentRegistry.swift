import SwiftUI

/// The closed dispatch table from `ComponentType` to an actual native
/// SwiftUI view — the component-side twin of `ActionRegistry`/
/// `DataSourceRegistry`. There is no generic "build a view from arbitrary
/// JSON layout description" path anywhere in this app (deliberately — see
/// docs/architecture-review.md §11): every case here is a real, dedicated,
/// hand-written view. `default` (any `.unsupported` type, known or not) and
/// `decodeFailed` both route to the same safe placeholder — this switch is
/// exhaustive over `ComponentType.kind`'s known cases plus one catch-all,
/// so a schema change that adds a new type this build doesn't recognize can
/// never fail to match a case here.
public enum ComponentRegistry {
    // Split into two small @ViewBuilder functions rather than one
    // if/else-wrapping-a-switch expression passed straight into
    // ComponentContainer's generic trailing closure. The single-expression
    // version type-checks, but nesting a boolean branch and an 8-case
    // switch inside a generic `Content: View` closure parameter is exactly
    // the shape that has pushed the compiler into pathological inference
    // time elsewhere in this app (see AsyncAssetImage.swift) — resolving
    // `dispatch(...)` to `some View` first keeps `ComponentContainer`'s
    // `Content` a single opaque type instead of a deep `_ConditionalContent`
    // chain.
    @ViewBuilder
    public static func view(for component: Component, context: RenderContext) -> some View {
        ComponentContainer(backgroundToken: component.style.backgroundToken, themeResolver: context.themeResolver) {
            dispatch(component: component, context: context)
        }
    }

    @ViewBuilder
    private static func dispatch(component: Component, context: RenderContext) -> some View {
        if component.decodeFailed {
            UnsupportedComponentView(component: component)
        } else {
            typedView(component: component, context: context)
        }
    }

    @ViewBuilder
    private static func typedView(component: Component, context: RenderContext) -> some View {
        switch component.type {
        case .header:
            HeaderComponentView(component: component, context: context)
        case .quickActions:
            QuickActionsComponentView(component: component, context: context)
        case .actionCenter:
            ActionCenterComponentView(component: component, context: context)
        case .bannerCarousel:
            BannerCarouselComponentView(component: component, context: context)
        case .rechargeBills:
            RechargeBillsComponentView(component: component, context: context)
        case .monthlyClaim:
            MonthlyClaimComponentView(component: component, context: context)
        case .rewardsHub:
            RewardsHubComponentView(component: component, context: context)
        case .unsupported:
            UnsupportedComponentView(component: component)
        }
    }
}
