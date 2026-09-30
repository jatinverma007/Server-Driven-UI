import SwiftUI

/// The icon-tile's own corner treatment — deliberately **native chrome,
/// not schema-driven** (same "native chrome vs. server-driven content"
/// split as `DSRadius`/`DSSpacing` generally): it tracks which
/// *component type* is rendering, not anything the server sends per item.
/// `quickActions` tiles are `rounded-[16px]` (Figma node 5382:7498 etc.);
/// `rechargeBills` tiles are fully circular — `rounded-[32px]` on a 56pt
/// frame is >= half the size, i.e. a circle (node 5382:7639 etc.). Colors
/// and borders stay schema-driven via `ComponentItem.style` exactly as
/// before; only the corner radius this shape implies is native.
public enum TileShape {
    case rounded
    case circular

    func cornerRadius(forTileSize size: CGFloat) -> CGFloat {
        switch self {
        case .rounded: return DSRadius.card
        case .circular: return size / 2
        }
    }
}

/// Shared fixed-grid rendering for `ComponentItem` arrays — used by
/// `quickActions`, `rechargeBills`, `rewardsHub`, and `monthlyClaim`'s
/// `items` (docs/component-catalog.md's item-group semantics). One place
/// to get tap targets, accessibility labels, and safe image/text
/// resolution right instead of four near-duplicate implementations.
public struct ItemGridView: View {
    let items: [ComponentItem]
    let columns: Int
    let context: RenderContext
    let tileShape: TileShape

    public init(items: [ComponentItem], columns: Int, context: RenderContext, tileShape: TileShape = .rounded) {
        self.items = items
        self.columns = max(columns, 1)
        self.context = context
        self.tileShape = tileShape
    }

    public var body: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: DSSpacing.sm), count: columns),
            spacing: DSSpacing.md
        ) {
            ForEach(items) { item in
                ItemCell(item: item, context: context, tileShape: tileShape)
            }
        }
    }
}

/// A `bundled` icon whose catalog artwork (see `AsyncAssetImage.bundledImage`)
/// is a bare glyph with no tile chrome baked in — unlike `quickActions`'
/// *remote* icons (Send Money/Scan & Pay/FASTag), whose PNGs already have
/// Figma's peach gradient tile + `#FFD7B7` border pre-rendered into the
/// asset itself. `add_money` is still `<UPLOAD_PENDING:add_money>` in the
/// schema — no `item.style` for `tileFill`/`tileBackground` to draw a tile
/// from — so without this it rendered as a bare icon floating directly on
/// the section's white card, next to three siblings that all show a
/// tile (confirmed against the Mac's real, Xcode-current
/// `add_money.imageset/add_money.png`: still the same bare glyph as the
/// portal's `/icons/add_money.png` stand-in). Figma (node 5382:7522) draws
/// the exact same 56×56 `rounded-[16px]` gradient tile behind it as every
/// other `quickActions` icon.
///
/// Same "known icon, hardcoded Figma chrome" convention as
/// `QuickActionsComponentView`'s `balanceRing`/`styleQRBorderGradient` —
/// keyed off the *bundled name*, not an item id or component type, so it
/// also covers this icon anywhere else it gets reused, and stays a no-op
/// for every other bundled glyph (`balance`, `style_qr`, etc.) until they
/// need the same treatment.
private enum NativeTileFallback {
    static func gradient(forBundledName name: String) -> LinearGradient? {
        guard name == "add_money" else { return nil }
        return LinearGradient(
            colors: [ThemeResolver.parse("#FFE8D7") ?? Color.orange.opacity(0.15), ThemeResolver.parse("#FFEFE4") ?? Color.orange.opacity(0.08)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static func borderColor(forBundledName name: String) -> Color? {
        guard name == "add_money" else { return nil }
        return ThemeResolver.parse("#FFD7B7")
    }
}

struct ItemCell: View {
    let item: ComponentItem
    let context: RenderContext
    var tileShape: TileShape = .rounded
    @Environment(\.colorScheme) private var colorScheme

    /// 56×56 @ `DSRadius.card` matches the icon-tile frames measured
    /// directly off Figma dev mode (`HANDOVER--PAY` node 4908:2556's
    /// "Send  Money"/"Scan & Pay"/etc. frames, and the same 56×56 frames
    /// for the Recharge & Bills icon set) — previously this rendered at a
    /// plain 40pt with the unrelated `thumbnail` (12pt) radius.
    private static let tileSize: CGFloat = 56
    /// The glyph inside a *styled* tile (one with a `backgroundGradientToken`
    /// / `backgroundToken`) is drawn smaller than the tile and centered —
    /// Figma's own layer structure draws the tile fill/border/inner-shadow
    /// as a layer separate from a ~26pt icon glyph, not one pre-composited
    /// image, so a themed tile and its glyph are two layers here too.
    private static let inlineGlyphSize: CGFloat = 32

    var body: some View {
        let label = TextResolution.resolve(item.label, context: context.bindingContext)
        let accessibilityText = item.accessibilityLabel.map { TextResolution.resolve($0, context: context.bindingContext) } ?? label

        Button {
            context.actionRegistry.perform(actionId: item.actionId)
        } label: {
            VStack(spacing: DSSpacing.xs) {
                // `rechargeBills`' `electricity` item is this codebase's one
                // real `media.badge` consumer today (Figma `HANDOVER--PAY`
                // node 5382:7658, confirmed exactly against node
                // 5382:7608's full get_design_context export — a 29×11
                // wide "New" pill sitting at `left-[15px] top-[-5px]`
                // *within* the 56×56 tile, i.e. straddling the top edge,
                // left of center rather than corner-anchored). Since this
                // tile is already drawn at Figma's own 56pt size, those
                // pixel offsets translate directly with no scaling.
                ZStack(alignment: .topLeading) {
                    ZStack {
                        tileBackground
                        AsyncAssetImage(
                            resolved: TextResolution.resolve(item.media?.leading, context: context.bindingContext),
                            size: hasTileStyle ? Self.inlineGlyphSize : Self.tileSize,
                            cornerRadius: hasTileStyle ? 0 : tileShape.cornerRadius(forTileSize: Self.tileSize)
                        )
                    }
                    .frame(width: Self.tileSize, height: Self.tileSize)

                    if item.media?.badge != nil {
                        // `frameSize` (rather than a square `size`) keeps
                        // this genuinely wide pill from being center-cropped
                        // into a square the way a squared `AsyncAssetImage`
                        // normally, correctly, crops an icon glyph.
                        AsyncAssetImage(resolved: TextResolution.resolve(item.media?.badge, context: context.bindingContext), frameSize: CGSize(width: 29, height: 11), cornerRadius: 5.5)
                            .offset(x: 15, y: -5)
                    }
                }
                if !label.isEmpty {
                    Text(label)
                        .font(.caption2)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .foregroundStyle(.primary)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityText)
    }

    /// The bundled name behind `item.media?.leading`, when it resolves to
    /// one — the key `NativeTileFallback` looks up. `nil` for a `remote`
    /// icon, a `pending` one, or no icon at all.
    private var bundledIconName: String? {
        if case .bundled(let name) = TextResolution.resolve(item.media?.leading, context: context.bindingContext) {
            return name
        }
        return nil
    }

    /// An item without any `style` (e.g. `rewardsHub`/`monthlyClaim`
    /// today) keeps its previous look — just bigger and more-rounded —
    /// unless its icon is one `NativeTileFallback` covers, so this stays
    /// strictly opt-in per item/icon, never a global behavior change.
    private var hasTileStyle: Bool {
        item.style?.backgroundGradientToken != nil
            || item.style?.backgroundToken != nil
            || bundledIconName.flatMap(NativeTileFallback.gradient(forBundledName:)) != nil
    }

    @ViewBuilder
    private var tileBackground: some View {
        let radius = tileShape.cornerRadius(forTileSize: Self.tileSize)
        if let style = item.style, style.backgroundGradientToken != nil || style.backgroundToken != nil {
            RoundedRectangle(cornerRadius: radius)
                .fill(tileFill(style))
                .frame(width: Self.tileSize, height: Self.tileSize)
                .overlay {
                    if let borderToken = style.borderToken {
                        RoundedRectangle(cornerRadius: radius)
                            .strokeBorder(context.themeResolver.color(forToken: borderToken, colorScheme: colorScheme), lineWidth: 1)
                    }
                }
        } else if let name = bundledIconName, let gradient = NativeTileFallback.gradient(forBundledName: name) {
            RoundedRectangle(cornerRadius: radius)
                .fill(gradient)
                .frame(width: Self.tileSize, height: Self.tileSize)
                .overlay {
                    if let border = NativeTileFallback.borderColor(forBundledName: name) {
                        RoundedRectangle(cornerRadius: radius)
                            .strokeBorder(border, lineWidth: 1)
                    }
                }
        }
    }

    /// Gradient wins over flat when both are present and the gradient
    /// token actually resolves — both are themed (dynamic, light/dark
    /// -aware) reads through `ThemeResolver`, never a literal color baked
    /// into this view (see `ThemeResolver.gradient`).
    private func tileFill(_ style: ComponentItemStyle) -> AnyShapeStyle {
        if let gradientToken = style.backgroundGradientToken,
           let gradient = context.themeResolver.gradient(forToken: gradientToken, colorScheme: colorScheme) {
            return AnyShapeStyle(gradient)
        }
        if let backgroundToken = style.backgroundToken {
            return AnyShapeStyle(context.themeResolver.color(forToken: backgroundToken, colorScheme: colorScheme))
        }
        return AnyShapeStyle(Color.clear)
    }
}
