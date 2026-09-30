import SwiftUI

/// Renders `type: "rechargeBills"` — same title/main-grid/bottom shape as
/// `quickActions` but its own type, so the two can diverge in native
/// treatment later without a shared-type migration
/// (docs/architecture-review.md keeps every component type's native view
/// independent on purpose). The title row's trailing accessory follows
/// the same `monthlyClaim`/`rewardsHub` convention: an inline icon next to
/// the title (the "Bharat Connect" logo in the seeded catalog), not a
/// full-width row.
///
/// Two things deliberately diverge from `quickActions` despite the shared
/// grid/chip building blocks, both confirmed against the full-screen
/// reference (Figma `HANDOVER--PAY` node 5382:6285):
/// - The section card (white, `DSRadius.sectionCard`, 16pt outer margin)
///   is the same treatment as `quickActions` (node 5382:7608 is
///   `rounded-[24px]` too) — not every component gets it (`monthlyClaim`
///   doesn't), so it's opted into per-view rather than made a renderer
///   default.
/// - The icon tiles are **circular**, not `DSRadius.card`-rounded (node
///   5382:7639 etc. — `rounded-[32px]` on a 56pt frame), with a flat
///   cream fill instead of `quickActions`' gradient — see `TileShape`.
struct RechargeBillsComponentView: View {
    let component: Component
    let context: RenderContext
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        // Figma (node 5382:7608, confirmed via full `get_design_context`)
        // splits this card's vertical rhythm into two different gaps —
        // 16pt between the title row and the icon grid (`gap-[16px]` on
        // 5382:7610), 12pt between that group and the bottom chip row
        // (`gap-[12px]` on 5382:7609) — not one uniform spacing, so this
        // is two nested `VStack`s rather than a single one.
        VStack(alignment: .leading, spacing: DSSpacing.md) {
            VStack(alignment: .leading, spacing: DSSpacing.lg) {
                HStack {
                    if let title = component.props.title {
                        Text(TextResolution.resolve(title, context: context.bindingContext))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if let top = component.props.topItems, !top.isEmpty {
                        HStack(spacing: DSSpacing.sm) {
                            ForEach(top) { item in
                                let label = TextResolution.resolve(item.label, context: context.bindingContext)
                                Button { context.actionRegistry.perform(actionId: item.actionId) } label: {
                                    if label.isEmpty {
                                        // Figma's Bharat Connect logo (node
                                        // 5382:7614, confirmed against the
                                        // real exported artwork at node
                                        // 4928:7595 — `Group 1171276188`,
                                        // now shipped as the `bharat_connect`
                                        // asset-catalog image, 1x/2x/3x)
                                        // renders at exactly 27×29 — a touch
                                        // TALLER than it is wide, not square.
                                        // `frameSize` (rather than a square
                                        // `size`) keeps `.scaledToFit()` on
                                        // the real artwork so it isn't
                                        // corner-cropped into a square the
                                        // way a squared `size:` would;
                                        // before this asset existed, this
                                        // was a square placeholder, so the
                                        // crop never showed.
                                        AsyncAssetImage(resolved: TextResolution.resolve(item.media?.leading, context: context.bindingContext), frameSize: CGSize(width: 27, height: 29))
                                    } else {
                                        HStack(spacing: 4) {
                                            AsyncAssetImage(resolved: TextResolution.resolve(item.media?.leading, context: context.bindingContext), size: 18)
                                            Text(label).font(.caption2)
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(item.accessibilityLabel.map { TextResolution.resolve($0, context: context.bindingContext) } ?? label)
                            }
                        }
                    }
                }
                ItemGridView(items: component.props.items ?? [], columns: component.layout?.columns ?? 4, context: context, tileShape: .circular)
            }
            if let bottom = component.props.bottomItems, !bottom.isEmpty {
                HStack(spacing: DSSpacing.sm) {
                    ForEach(bottom) { item in
                        bottomChip(item)
                    }
                }
            }
        }
        .padding(DSSpacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DSRadius.sectionCard)
                .fill(context.themeResolver.color(forToken: "surface.default", colorScheme: colorScheme))
                // Figma (node 5382:7608) specs *two* shadows here — one
                // above, one below (`0px_-1px_1px` + `0px_1px_1px`) —
                // unlike `quickActions`' single bottom-only shadow
                // (node 5382:7481). Chaining `.shadow()` twice stacks both,
                // the same way CSS's comma-separated `box-shadow` would.
                .shadow(color: .black.opacity(0.15), radius: 1, x: 0, y: -1)
                .shadow(color: .black.opacity(0.15), radius: 1, x: 0, y: 1)
        )
        .padding(.horizontal, DSSpacing.lg)
        // Same reasoning as `QuickActionsComponentView`'s matching
        // `.padding(.bottom, 3)`: `.shadow()` doesn't enlarge this view's
        // reported layout size, and `HomeScreenRenderer` stacks components
        // in a `LazyVStack(spacing: 0)`, so with no reserved buffer the
        // shadow bleed lands exactly where a neighboring sibling starts
        // and gets painted over — it reads as "cropped." This component
        // has a shadow on *both* edges, so it needs the buffer on both.
        .padding(.vertical, 3)
    }

    /// Same schema-driven chip fill/stroke as `QuickActionsComponentView`'s
    /// bottom row (node 5382:7737/5382:7742 — `rounded-[8px]`, same
    /// `#f9fafb`/`#dedede` colors as `quickActions`' UPI chip, hence the
    /// shared `chip.upi.*` tokens in the seed data rather than a
    /// duplicate pair).
    private func chip(style: ComponentItemStyle?) -> some View {
        RoundedRectangle(cornerRadius: DSRadius.miniBar)
            .fill(style?.backgroundToken.map { context.themeResolver.color(forToken: $0, colorScheme: colorScheme) } ?? Color.secondary.opacity(0.08))
            .overlay {
                if let borderToken = style?.borderToken {
                    RoundedRectangle(cornerRadius: DSRadius.miniBar)
                        .strokeBorder(context.themeResolver.color(forToken: borderToken, colorScheme: colorScheme), lineWidth: 1)
                }
            }
    }

    /// Both `bottomItems` share the same `chip.upi.*` background/border
    /// tokens in the seed data, but Figma (node 4908:3211) gives them two
    /// different content treatments: `plan_expired_nudge` is a
    /// leading-icon, gray-text nudge; `view_more` is bold brand-red text
    /// with a *trailing* arrow, sized to its own ~94pt minimum width
    /// rather than hugging its sibling. `id` switches the native layout,
    /// exactly the same "id picks the shape, `style` tokens still drive
    /// color" split `QuickActionsComponentView.bottomChip(for:)` uses for
    /// its own row of differently-shaped chips.
    @ViewBuilder
    private func bottomChip(_ item: ComponentItem) -> some View {
        let label = TextResolution.resolve(item.label, context: context.bindingContext)
        switch item.id {
        case "view_more":
            Button { context.actionRegistry.perform(actionId: item.actionId) } label: {
                HStack(spacing: 4) {
                    if !label.isEmpty {
                        Text(label)
                            .font(.system(size: 10, weight: .bold))
                            // Figma's fixed 94px width wraps "View More" at
                            // system-font metrics (same Acumin-Pro-vs-system
                            // mismatch as the UPI/Style-QR chips) — sized to
                            // content and given a matching `minWidth` below
                            // instead, so it never wraps.
                            .fixedSize(horizontal: true, vertical: false)
                            .lineLimit(1)
                    }
                    AsyncAssetImage(resolved: TextResolution.resolve(item.media?.leading, context: context.bindingContext), size: 12)
                }
                // `brand.primary` turned out to be missing from the theme
                // payload this app actually receives on device (see
                // `ThemeResolver.color(forToken:colorScheme:fallbackHex:)`'s
                // doc comment — same gap that grayed out Action Center's
                // 360° Request accent), so this falls back to the exact
                // same red Figma specifies rather than the generic
                // neutral-gray fallback.
                .foregroundStyle(context.themeResolver.color(forToken: "brand.primary", colorScheme: colorScheme, fallbackHex: "#E44239"))
                .padding(.horizontal, 12).padding(.vertical, 6)
                .frame(minWidth: 94)
                .background(chip(style: item.style))
            }
            .buttonStyle(.plain)
        default:
            Button { context.actionRegistry.perform(actionId: item.actionId) } label: {
                HStack(spacing: 12) {
                    if !label.isEmpty {
                        Text(label)
                            .font(.system(size: 12))
                            // Figma's nudge text (`#727272`) is a middling
                            // gray this theme has no matching token for —
                            // hardcoded straight from the Figma spec rather
                            // than approximating with `.secondary`.
                            .foregroundStyle(ThemeResolver.parse("#727272") ?? .secondary)
                    }
                    // Figma (node 5382:7740/5382:7741, confirmed against the
                    // real exported artwork at node 4928:7719's sibling
                    // illustration layer — `image 126`, now shipped as the
                    // `wallet_alert` asset-catalog image, 1x/2x/3x) puts
                    // this phone-recharge illustration AFTER the text, not
                    // before it, and it's a genuinely tall 22×28
                    // illustration rather than a square glyph — `frameSize`
                    // keeps it from being center-cropped into a square the
                    // way the leading icon on `view_more` (a real square
                    // glyph) correctly is.
                    AsyncAssetImage(resolved: TextResolution.resolve(item.media?.leading, context: context.bindingContext), frameSize: CGSize(width: 22, height: 28))
                }
                .padding(.leading, 12).padding(.trailing, 8).padding(.vertical, 6)
                .background(chip(style: item.style))
            }
            .buttonStyle(.plain)
        }
    }
}
