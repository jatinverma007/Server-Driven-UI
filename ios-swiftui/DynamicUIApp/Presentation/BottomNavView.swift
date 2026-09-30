import SwiftUI

/// Dynamic bottom tab bar driven by `navigation.bottom`, filtered by
/// audience exactly like screen components. Not a real SwiftUI `TabView`
/// (which expects statically-declared tab content views) — a purely visual
/// bar whose taps go through `ActionRegistry`, matching how the portal's
/// `PhonePreview` renders it and how a true server-driven nav bar has to
/// work when the set of tabs itself is dynamic.
public struct BottomNavView: View {
    let navigation: NavigationSpec
    let context: RenderContext
    @Environment(\.colorScheme) private var colorScheme

    public init(navigation: NavigationSpec, context: RenderContext) {
        self.navigation = navigation
        self.context = context
    }

    private var visibleItems: [NavigationItem] {
        navigation.bottom.filter { AudienceEvaluator.matches($0.audience, context: context.audienceContext) }
    }

    public var body: some View {
        HStack {
            ForEach(visibleItems, id: \.id) { item in
                Button {
                    context.actionRegistry.perform(actionId: item.actionId)
                } label: {
                    VStack(spacing: 2) {
                        AsyncAssetImage(
                            resolved: TextResolution.resolve(item.icon, context: context.bindingContext),
                            size: item.variant == .elevatedCenter ? 44 : 24,
                            cornerRadius: item.variant == .elevatedCenter ? 22 : 6
                        )
                        .offset(y: item.variant == .elevatedCenter ? -14 : 0)
                        if item.variant != .elevatedCenter {
                            Text(TextResolution.resolve(item.label, context: context.bindingContext))
                                .font(.system(size: 10))
                        }
                    }
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
                .accessibilityLabel(TextResolution.resolve(item.label, context: context.bindingContext))
            }
        }
        .padding(.top, DSSpacing.sm)
        .padding(.bottom, DSSpacing.xs)
        .background(.bar)
    }
}
