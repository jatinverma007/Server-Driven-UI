import SwiftUI

/// Renders `type: "quickActions"`: a title row with an optional trailing
/// accessory (matching the `monthlyClaim`/`rewardsHub` title-row
/// convention — see those views — rather than a full-width card), the
/// main fixed grid (`layout.columns`, default 4), and an optional bottom
/// chip row.
///
/// The whole thing sits on a white, `DSRadius.sectionCard`-rounded card
/// with a 16pt outer margin (Figma `HANDOVER--PAY` node 5382:6285, node
/// 5382:7481 — `bg-white rounded-[24px]` inset 16px from the screen
/// edge) — this is what makes the card visually float on top of the
/// screen's hero gradient rather than the gradient and the card sharing
/// one flat background. Like `DSRadius`/`DSSpacing` generally, the card
/// chrome itself (radius, margin, shadow) is native; only its fill color
/// is a themed token, same as every other surface in this renderer.
struct QuickActionsComponentView: View {
    let component: Component
    let context: RenderContext
    @Environment(\.colorScheme) private var colorScheme

    /// Whether the `check_balance` accessory is showing the revealed
    /// amount. View-local only — never persisted, never round-tripped
    /// through the schema (see `BalanceDisplay`).
    @State private var isBalanceRevealed = false

    var body: some View {
        VStack(alignment: .leading, spacing: DSSpacing.md) {
            HStack {
                if let title = component.props.title {
                    Text(TextResolution.resolve(title, context: context.bindingContext))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let first = component.props.topItems?.first {
                    topAccessory(for: first)
                }
            }

            ItemGridView(items: component.props.items ?? [], columns: component.layout?.columns ?? 4, context: context)

            if let bottom = component.props.bottomItems, !bottom.isEmpty {
                let generateItem = bottom.first { $0.id == "generate_upi_prompt" }
                let upiItem = bottom.first { $0.id == "upi_id_chip" }
                // Figma has two designs for this section and no schema
                // condition yet to choose between them: node 4928:14877 (=
                // node 4908:2621, same design) is a single combined row —
                // the existing UPI ID plus a "Generate UPI ID" button — and
                // nodes 5503:3143 + 5503:3156 together are `upi_id_chip`
                // and `style_qr_chip` standing on their own, no button.
                // Per the current instruction, both render at once until
                // the real condition exists: the combined row on top
                // (`generateUpiIdRow`, when both its ids are present) and
                // every bottom item *except* `generate_upi_prompt` again
                // below it as its own standalone chip via `bottomChip` —
                // `upi_id_chip` deliberately appears in both places.
                // `generate_upi_prompt` is excluded from the standalone row
                // because it has no design of its own outside the combined
                // one. Swap `showCombinedRow`'s condition for the real
                // show/hide rule once one exists; nothing else here should
                // need to change.
                let showCombinedRow = generateItem != nil && upiItem != nil
                let standaloneItems = bottom.filter { $0.id != "generate_upi_prompt" }

                VStack(alignment: .leading, spacing: DSSpacing.sm) {
                    if showCombinedRow, let generateItem, let upiItem {
                        generateUpiIdRow(generateItem: generateItem, upiItem: upiItem)
                    }
                    if !standaloneItems.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: DSSpacing.sm) {
                                ForEach(standaloneItems) { item in
                                    bottomChip(for: item)
                                }
                            }
                        }
                    }
                }
            }
        }
        .padding(DSSpacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DSRadius.sectionCard)
                .fill(context.themeResolver.color(forToken: "surface.default", colorScheme: colorScheme))
                .shadow(color: .black.opacity(0.15), radius: 1, x: 0, y: 1)
        )
        .padding(.horizontal, DSSpacing.lg)
        // The reveal between the header row and this card's own top edge —
        // deliberately unpadded until now. Figma (`HANDOVER--PAY` node
        // 5382:6295) measures this card's top at y=114 against the header
        // content row's own bottom at y=104: a 10pt gap where the hero
        // gradient wash is meant to show through between the transparent
        // header and this opaque white card. `HomeScreenRenderer` stacks
        // components in a `LazyVStack(spacing: 0)`, so without this the
        // card butts straight against the header and swallows that reveal
        // entirely — the gradient reads as not fully showing over Quick
        // Actions.
        .padding(.top, 10)
        // `.shadow()` is a purely visual effect — it does NOT enlarge the
        // view's reported layout size, so without this the shadow bleeds
        // ~1-2pt past this view's own frame. `HomeScreenRenderer` stacks
        // components in a `LazyVStack(spacing: 0)`, so with zero buffer
        // that bleed lands exactly where the next sibling starts, and
        // whichever component comes next paints over it (later siblings
        // draw on top) — the shadow reads as "cropped." This reserves
        // enough extra height for the shadow to render in full before the
        // next sibling begins.
        .padding(.bottom, 3)
    }

    /// A chip's fill + optional stroke, resolved from `item.style` exactly
    /// like `ItemCell.tileFill`/`tileBackground` resolve an icon tile's —
    /// the same schema-driven styling mechanism, just applied to a pill
    /// instead of a square tile. An item with no `style` at all keeps the
    /// original neutral placeholder fill so an un-styled item (there are
    /// none in the seeded catalog today, but the schema doesn't require
    /// one) still renders instead of going invisible.
    private func chip(cornerRadius: CGFloat, style: ComponentItemStyle?) -> some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(style?.backgroundToken.map { context.themeResolver.color(forToken: $0, colorScheme: colorScheme) } ?? Color.secondary.opacity(0.08))
            .overlay {
                if let borderToken = style?.borderToken {
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .strokeBorder(context.themeResolver.color(forToken: borderToken, colorScheme: colorScheme), lineWidth: 1)
                }
            }
    }

    /// `style_qr_chip`'s border (Figma node 5503:3156) isn't the flat
    /// `#7877ED` it first looks like — Figma's dev-mode code export
    /// flattens a gradient stroke to a single representative CSS
    /// `border-color`, and that's what it returned here; the actual
    /// screenshot shows the ring cycling purple → teal → pink and back to
    /// purple around the full perimeter. Neither the design-context tool
    /// nor the variable-defs tool exposes the literal stroke paint (no
    /// bound Figma variable — `get_variable_defs` returns nothing for
    /// this node — so it's a raw multi-stop paint with no name to look
    /// up), so this reproduces it by eye from that screenshot as an
    /// `AngularGradient` rather than the flat color: closest available
    /// approximation, not a pixel-exact match. Flag to design/eng if the
    /// exact stops/angle matter and this needs tightening.
    private var styleQRBorderGradient: AngularGradient {
        AngularGradient(
            gradient: Gradient(colors: [
                ThemeResolver.parse("#7877ED") ?? .purple,
                ThemeResolver.parse("#5EEAD4") ?? .teal,
                ThemeResolver.parse("#F472B6") ?? .pink,
                ThemeResolver.parse("#7877ED") ?? .purple,
            ]),
            center: .center
        )
    }

    /// Three fixed, Figma-exact bottom chips (Figma `HANDOVER--PAY` nodes
    /// 4908:2621 "Generate UPI ID", 5503:3143 "UPI ID: …" chip, and
    /// 5503:3156 "Style Your QR") — each one visually distinct (a solid
    /// red CTA, a neutral bordered chip, an accent-bordered chip) instead
    /// of the one shared neutral pill every bottom item rendered as
    /// before. Text and colors are hardcoded, keyed off `item.id` — same
    /// pattern as `MonthlyClaimComponentView.ClaimStatus` — deliberately
    /// not schema-driven for this round; `actionId` dispatch is
    /// untouched, still read straight from the schema. An id this switch
    /// doesn't recognize falls back to the original generic chip so any
    /// other `bottomItems` entry keeps rendering exactly as before.
    ///
    /// `upi_id_chip`'s trailing (copy) icon has no slot in
    /// `ComponentItemMedia` today (only `leading`/`badge`) — rather than
    /// extend the shared schema/model for one hardcoded chip, its URL is
    /// inlined here as a literal, straight from this round's icon JSON,
    /// same as the leading icon URLs below.
    @ViewBuilder
    private func bottomChip(for item: ComponentItem) -> some View {
        switch item.id {
        case "generate_upi_prompt":
            Button { context.actionRegistry.perform(actionId: item.actionId) } label: {
                HStack(spacing: 4) {
                    AsyncAssetImage(resolved: .remote("https://uat1.omnicard.co.in/file-utils/tyk9QhPN.png"), size: 14)
                    Text("Generate UPI ID")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 8).padding(.vertical, 6)
                .background(RoundedRectangle(cornerRadius: 8).fill(ThemeResolver.parse("#E44239") ?? .red))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Generate UPI ID")

        case "upi_id_chip":
            // Figma node 5503:3143 lays the leading icon+text group and the
            // trailing copy icon out with `justify-between` across a
            // 142pt-wide inner row — the trailing icon sits at the row's
            // right edge, not 4pt from the text like the other icon gaps.
            // `Spacer(minLength:)` reproduces that: it pushes the copy icon
            // to the edge whenever there's slack, and never lets the two
            // sides collide when there isn't. `.fixedSize` on the text
            // keeps it single-line even if the frame's 142pt minimum ever
            // squeezes tighter than this exact string needs (same fix as
            // `generateUpiIdRow`'s button, same reason: the system font's
            // metrics for this string aren't Acumin Pro's).
            Button { context.actionRegistry.perform(actionId: item.actionId) } label: {
                HStack(spacing: 0) {
                    HStack(spacing: 4) {
                        AsyncAssetImage(resolved: .remote("https://uat1.omnicard.co.in/file-utils/tyk9QhPN.png"), size: 12)
                        Text("UPI ID: 812849586@omni")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(ThemeResolver.parse("#1C1C1C") ?? .primary)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                    }
                    Spacer(minLength: 4)
                    AsyncAssetImage(resolved: .remote("https://uat1.omnicard.co.in/file-utils/stebR2y1.png"), size: 12)
                }
                .frame(minWidth: 142, alignment: .leading)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(ThemeResolver.parse("#F9FAFB") ?? Color(.secondarySystemBackground))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ThemeResolver.parse("#DEDEDE") ?? Color.gray, lineWidth: 1))
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("UPI ID: 812849586 at omni. Double tap to copy.")

        case "style_qr_chip":
            Button { context.actionRegistry.perform(actionId: item.actionId) } label: {
                HStack(spacing: 4) {
                    // No real artwork for this glyph yet (the JSON's icon
                    // is still `<UPLOAD_PENDING:style_qr>`) — `.bundled`
                    // resolves it through the same sanctioned pending-icon
                    // path every other icon uses, which already maps this
                    // exact name to the "qrcode" SF Symbol
                    // (`BundledIconCatalog.swift`).
                    AsyncAssetImage(resolved: .bundled("style_qr"), size: 16)
                    Text("Style Your QR")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(ThemeResolver.parse("#1C1C1C") ?? .primary)
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(ThemeResolver.parse("#FFF6EF") ?? Color(.secondarySystemBackground))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(styleQRBorderGradient, lineWidth: 1))
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Style Your QR")

        default:
            let label = TextResolution.resolve(item.label, context: context.bindingContext)
            Button { context.actionRegistry.perform(actionId: item.actionId) } label: {
                HStack(spacing: 4) {
                    AsyncAssetImage(resolved: TextResolution.resolve(item.media?.leading, context: context.bindingContext), size: 16)
                    if !label.isEmpty { Text(label).font(.caption2) }
                }
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(chip(cornerRadius: DSRadius.chipBar, style: item.style))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(item.accessibilityLabel.map { TextResolution.resolve($0, context: context.bindingContext) } ?? label)
        }
    }

    /// Figma `HANDOVER--PAY` node 4908:2621 ("Frame 1171277480") — the
    /// complete Generate UPI ID view: one `#F9FAFB`-filled, `#DEDEDE`-
    /// bordered, 12pt-rounded row holding the current UPI ID (leading icon
    /// + 12pt `#1C1C1C` text) on the left and the "Generate UPI ID" button
    /// (fixed 92pt wide, `#E44239` fill, 10pt semibold white text) on the
    /// right — replacing the two separate stacked chips this used to
    /// render for `generate_upi_prompt`/`upi_id_chip`. Every value here is
    /// hardcoded straight from the Figma spec (node 4908:2622-4908:2635);
    /// only the two icon URLs come from this round's icon JSON, same as
    /// `bottomChip`. Each side still performs its own item's own
    /// `actionId` — tapping the UPI ID text still fires `upiItem.actionId`
    /// (`copy_upi_id`), tapping the button still fires
    /// `generateItem.actionId` (`generate_custom_upi`) — no change to
    /// action dispatch, only to layout.
    @ViewBuilder
    private func generateUpiIdRow(generateItem: ComponentItem, upiItem: ComponentItem) -> some View {
        HStack {
            Button { context.actionRegistry.perform(actionId: upiItem.actionId) } label: {
                HStack(spacing: 8) {
                    AsyncAssetImage(resolved: .remote("https://uat1.omnicard.co.in/file-utils/tyk9QhPN.png"), size: 12)
                    Text("UPI ID: 812849586@omni")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(ThemeResolver.parse("#1C1C1C") ?? .primary)
                        .lineLimit(1)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("UPI ID: 812849586 at omni. Double tap to copy.")

            Spacer(minLength: DSSpacing.sm)

            Button { context.actionRegistry.perform(actionId: generateItem.actionId) } label: {
                Text("Generate UPI ID")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.plain)
            // Figma specs a fixed 92pt-wide button (node 4908:2632) with
            // "Generate UPI ID" fitting on one line inside it — that's
            // Acumin Pro's metrics, not the system font's. A hard
            // `.frame(width: 92)` here wraps the system font's wider
            // rendering of the same 16-character string to two lines,
            // which reads as broken far more than a few points of extra
            // button width does — so this sizes to content instead
            // (`fixedSize` + `lineLimit(1)` above) and skips the fixed
            // frame, trading exact pixel width for the single-line layout
            // the design actually calls for.
            .background(RoundedRectangle(cornerRadius: 8).fill(ThemeResolver.parse("#E44239") ?? .red))
            .accessibilityLabel("Generate UPI ID")
        }
        .padding(8)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(ThemeResolver.parse("#F9FAFB") ?? Color(.secondarySystemBackground))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ThemeResolver.parse("#DEDEDE") ?? Color.gray, lineWidth: 1))
        )
    }

    /// `check_balance` gets the reveal/hide/refresh treatment below; any
    /// other `topItems` id (there is none in the seeded catalog today, but
    /// the schema doesn't forbid one) falls back to a plain inline
    /// icon+label pill so an unrecognized top item still renders instead
    /// of being silently dropped.
    @ViewBuilder
    private func topAccessory(for item: ComponentItem) -> some View {
        if AppAction(actionId: item.actionId ?? "") == .checkBalance {
            balanceAccessory(for: item)
        } else {
            let label = TextResolution.resolve(item.label, context: context.bindingContext)
            Button { context.actionRegistry.perform(actionId: item.actionId) } label: {
                HStack(spacing: 4) {
                    AsyncAssetImage(resolved: TextResolution.resolve(item.media?.leading, context: context.bindingContext), size: 18)
                    if !label.isEmpty { Text(label).font(.caption2) }
                }
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(chip(cornerRadius: DSRadius.chip, style: item.style))
            }
            .buttonStyle(.plain)
        }
    }

    /// Both states of the `check_balance` accessory share one ring shape:
    /// a `#FFEADA`-filled, `#F47C20`-bordered outer capsule with 2pt
    /// padding around an inner white capsule. Confirmed against BOTH
    /// Figma references now available — hidden (node 5382:7487, label
    /// then eye icon) and revealed (node 4928:14800, amount + eye-slash
    /// icon, plus a *separate* circular refresh button 8pt to the right,
    /// same ring colors — Figma lays these out as two independent
    /// elements, not one combined pill).
    ///
    /// Hardcoded straight from those specs rather than `item.style`
    /// tokens: `check_balance`'s `topItems` entry in the seed JSON carries
    /// no `style` object, so routing this through the shared `chip()`
    /// helper (as this used to) was silently falling back to its generic
    /// gray-no-border placeholder — same "known chip, hardcoded Figma
    /// colors" convention `bottomChip(for:)` already uses for
    /// `generate_upi_prompt`/`upi_id_chip`/`style_qr_chip`. The amount
    /// itself comes from `BalanceDisplay`, never from `component.props` —
    /// this button is the one place in the renderer allowed to show it.
    private var balanceRingFill: Color { ThemeResolver.parse("#FFEADA") ?? Color.orange.opacity(0.12) }
    private var balanceRingBorder: Color { ThemeResolver.parse("#F47C20") ?? .orange }

    @ViewBuilder
    private func balanceRing<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(.horizontal, 8).padding(.vertical, 6)
            .background(Capsule().fill(.white))
            .padding(2)
            .background(Capsule().fill(balanceRingFill).overlay(Capsule().strokeBorder(balanceRingBorder, lineWidth: 1)))
    }

    @ViewBuilder
    private func balanceAccessory(for item: ComponentItem) -> some View {
        if isBalanceRevealed {
            HStack(spacing: 8) {
                balanceRing {
                    HStack(spacing: 4) {
                        Text(BalanceDisplay.mockAmountText(forUserType: context.audienceContext.userType))
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(ThemeResolver.parse("#1C1C1C") ?? .primary)
                            .lineLimit(1)
                        Button {
                            isBalanceRevealed = false
                        } label: {
                            Image(systemName: "eye.slash")
                                .font(.system(size: 10))
                                .foregroundStyle(ThemeResolver.parse("#1C1C1C") ?? .primary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Hide balance")
                    }
                }

                // Figma's own refresh glyph (node 4928:14825, 22×22 inside
                // this 26×26 circle) reads as the accent orange, not the
                // dark text color the eye-slash icon uses — the one visual
                // difference between the two icons in this accessory.
                Button {
                    context.actionRegistry.perform(actionId: item.actionId)
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12))
                        .foregroundStyle(balanceRingBorder)
                        .frame(width: 22, height: 22)
                }
                .buttonStyle(.plain)
                .background(Circle().fill(balanceRingFill).overlay(Circle().strokeBorder(balanceRingBorder, lineWidth: 1)))
                .accessibilityLabel("Refresh balance")
            }
        } else {
            let label = TextResolution.resolve(item.label, context: context.bindingContext)
            Button {
                isBalanceRevealed = true
                context.actionRegistry.perform(actionId: item.actionId)
            } label: {
                balanceRing {
                    HStack(spacing: 6) {
                        // Figma orders label-then-icon here (node 5382:7489),
                        // the reverse of every other icon+label chip in this
                        // file — kept as-is rather than normalized, since
                        // swapping it would drift from the one reference
                        // that actually specifies this exact badge.
                        if !label.isEmpty { Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(ThemeResolver.parse("#1C1C1C") ?? .primary) }
                        AsyncAssetImage(resolved: TextResolution.resolve(item.media?.leading, context: context.bindingContext), size: 14)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(label.isEmpty ? "Check balance" : label)
        }
    }
}
