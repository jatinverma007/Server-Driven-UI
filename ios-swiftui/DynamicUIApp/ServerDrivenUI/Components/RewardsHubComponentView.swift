import SwiftUI

/// Renders `type: "rewardsHub"` (B2C) — title, an optional "view more" top
/// item, and a fixed grid of reward tiles.
///
/// Brought in line with `RechargeBillsComponentView` (Figma `HANDOVER--PAY`
/// node 4908:4064, "Offers & More") — the two share the exact same visual
/// recipe, confirmed against Dev Mode: a white `DSRadius.sectionCard`-rounded
/// card with a *double* shadow (one above, one below — `0px_-1px_1px` +
/// `0px_1px_1px`, node 4908:4064 itself), circular 56pt icon tiles (not the
/// `.rounded` default — node 4908:4077 etc. are `rounded-[32px]` on a 56px
/// frame, i.e. a circle), and the "View more" top item rendered as an
/// icon+label pair, not label-only. The previous version had none of these —
/// no card, no shadow, no circular tiles, and a text-only "View more" with
/// its configured arrow icon silently dropped.
struct RewardsHubComponentView: View {
    let component: Component
    let context: RenderContext
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: DSSpacing.md) {
            HStack {
                if let title = component.props.title {
                    Text(TextResolution.resolve(title, context: context.bindingContext))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let viewMore = component.props.topItems?.first {
                    let label = TextResolution.resolve(viewMore.label, context: context.bindingContext)
                    Button { context.actionRegistry.perform(actionId: viewMore.actionId) } label: {
                        HStack(spacing: 4) {
                            if !label.isEmpty { Text(label).font(.caption) }
                            AsyncAssetImage(resolved: TextResolution.resolve(viewMore.media?.leading, context: context.bindingContext), size: 14)
                        }
                        // Node 4908:4064's "View more" hit area (label +
                        // arrow) is visually small — this pads it out to the
                        // HIG's 44x44pt minimum effective touch target
                        // without changing how it looks.
                        .padding(.vertical, 11)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(label.isEmpty ? "View more" : label)
                }
            }
            ItemGridView(
                items: component.props.items ?? [],
                // Figma reserves a 4th, invisible tile slot (node
                // 4908:4118, `opacity-0`) so 3 real items still land at the
                // same column positions/spacing as `quickActions`'
                // 4-column grid directly above — not because there are 4
                // items. `layout.columns` carries that (native-chrome,
                // not schema `items.count`) — `ItemGridView`'s
                // `.flexible()` tracks reproduce the reserved-slot look
                // for free: an unfilled 4th track just renders as blank
                // space, no placeholder view needed.
                columns: component.layout?.columns ?? 4,
                context: context,
                tileShape: .circular
            )
        }
        .padding(DSSpacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DSRadius.sectionCard)
                .fill(context.themeResolver.color(forToken: "surface.default", colorScheme: colorScheme))
                .shadow(color: .black.opacity(0.15), radius: 1, x: 0, y: -1)
                .shadow(color: .black.opacity(0.15), radius: 1, x: 0, y: 1)
        )
        .padding(.horizontal, DSSpacing.lg)
        .padding(.vertical, 3)
    }
}
