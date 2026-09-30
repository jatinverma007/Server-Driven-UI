import SwiftUI

/// Renders `type: "actionCenter"`: a horizontally scrolling row of cards.
/// One card (`invite`, in the seeded configuration) is data-bound via
/// `dataSourceId: "invites.pending"` — its label/subtitle/meta come from
/// `TextValue.binding` paths (`data.invitedUserName` etc.) that
/// `ConfigurationViewModel` refreshes from `DataSourceRegistry` and folds
/// into the active `BindingContext`, so this view stays purely declarative
/// and doesn't know or care that one particular item is data-bound.
struct ActionCenterComponentView: View {
    let component: Component
    let context: RenderContext

    var body: some View {
        VStack(alignment: .leading, spacing: DSSpacing.sm) {
            if let title = component.props.title {
                Text(TextResolution.resolve(title, context: context.bindingContext))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, DSSpacing.lg)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: DSSpacing.md) {
                    ForEach(component.props.items ?? []) { item in
                        ActionCenterCard(item: item, context: context)
                    }
                }
                .padding(.horizontal, DSSpacing.lg)
            }
        }
        .padding(.vertical, DSSpacing.sm)
    }
}

private struct ActionCenterCard: View {
    let item: ComponentItem
    let context: RenderContext
    @Environment(\.colorScheme) private var colorScheme

    /// Figma's KycStrip variants render at 321pt (KYC) / 361pt (360°
    /// Request, Invite) — used as a **minimum**, not an exact width (see
    /// `body`'s `.frame(minWidth:)`, not `.frame(width:)`). A hard exact
    /// width previously reproduced Figma's own numbers pixel-for-pixel and
    /// broke the `complete_kyc` card: Figma's text/button are set in 8-11.5px
    /// Inter/Acumin Pro, appreciably smaller than this build's SF Pro sizes
    /// (13pt/10pt/12pt), so the same 321pt budget that fits Figma's own tiny
    /// "Complete KYC" button left this build's larger rendering of that same
    /// button too little room and SwiftUI wrapped it to two lines ("Complete"
    /// / "KYC") instead of shrinking gracefully. A minimum keeps every card
    /// visually anchored to Figma's own width when content fits (the normal
    /// case), while letting a card whose *actual* rendered content — at this
    /// build's real font sizes — needs more room simply grow past it rather
    /// than compressing/wrapping its label or getting clipped by the corner
    /// mask below.
    private var cardWidth: CGFloat {
        item.id == "quick_request_360" || item.id == "invite" ? 361 : 321
    }

    private var textColumnWidth: CGFloat {
        if item.id == "complete_kyc" { return 121 }
        if item.id == "invite" { return 130 }
        return 180
    }

    /// Figma's actual reference for this card (`HANDOVER--PAY` node
    /// 4908:2642 "Complete your KYC" *and* 5382:6439 "360° Request" — both
    /// literally named `KycStrip` in the file, i.e. the same reusable
    /// component) is a **68pt-tall horizontal strip**: icon on the left,
    /// title/subtitle-or-meta stacked in the middle, one or more buttons
    /// trailing — not the taller vertical, icon-on-top card this used to
    /// draw.
    var body: some View {
        let label = TextResolution.resolve(item.label, context: context.bindingContext)
        let subtitle = item.subtitle.map { TextResolution.resolve($0, context: context.bindingContext) }
        let meta = item.meta.map { TextResolution.resolve($0, context: context.bindingContext) }

        HStack(alignment: .center, spacing: 8) {
            accentIcon
            // Figma's own text column (the "Container" frame, node
            // 4908:2646) is a fixed 121pt wide, which is exactly why
            // "Update your details to keep your account active &
            // compliant." breaks into the two lines node 4908:2650 shows
            // ("...keep your" / "account active & compliant.") instead of
            // running on as one long line. `invite`/other cards get a wider
            // 130pt/180pt column instead — this build's larger fonts (13pt
            // bold title vs. Figma's 11.5px, 10pt body vs. Figma's 8px) need
            // more room to keep the *title* on one line the way Figma's
            // does, while still narrow enough that a long subtitle wraps to
            // two.
            VStack(alignment: .leading, spacing: 2) {
                if !label.isEmpty {
                    Text(label)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(context.themeResolver.color(forToken: "text.primary", colorScheme: colorScheme))
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                }
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let meta, !meta.isEmpty {
                    Text(meta).font(.system(size: 10, weight: .semibold)).foregroundStyle(accentColor).lineLimit(1)
                }
            }
            .frame(width: textColumnWidth, alignment: .leading)
            if let buttons = item.buttons, !buttons.isEmpty {
                if item.id == "quick_request_360" { Spacer(minLength: 8) }
                HStack(spacing: DSSpacing.sm) {
                    ForEach(buttons) { button in
                        ActionButtonView(button: button, context: context, defaultColor: accentColor)
                    }
                }
            }
        }
        // Figma's own padding (`pl-[15px] pr-[12.5px] py-[10.5px]` on the
        // KYC strip, `pl-[27px] pr-[12.2px] py-[10.2px]` on the 360°
        // strip — the extra left inset there is the wider icon-ring's own
        // footprint, not extra card padding) rounds to this uniform
        // 15/12/11 rather than a shared `DSSpacing` token, since no
        // existing token lands this close.
        .padding(.leading, 15)
        .padding(.trailing, 12)
        .padding(.vertical, 11)
        // `minWidth`, not `width` — see `cardWidth`'s doc comment. This is
        // what actually fixed the "Complete KYC" 2-line wrap: with an exact
        // width the button had a hard ~121pt ceiling that its own true
        // (unwrapped) content needed more than, so SwiftUI wrapped the label
        // to fit; a minimum lets the card grow those few extra points
        // instead, and `ActionButtonView`'s `.fixedSize` (see there) is what
        // makes sure it asks for exactly the room its label actually needs.
        .frame(minWidth: cardWidth, alignment: .leading)
        .frame(height: 68)
        .background(cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: DSRadius.card))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(item.accessibilityLabel.map { TextResolution.resolve($0, context: context.bindingContext) } ?? label)
    }

    /// Figma (`HANDOVER--PAY` nodes 4908:2642 "Complete your KYC" and
    /// 5382:6439 "360° Request") gives every Action Center card a themed
    /// left accent stripe — a 3pt-wide bar in the card's accent color,
    /// flush with the rounded corners — rather than a uniform-width
    /// border (the ~0.5pt tint on the other three edges is close enough
    /// to invisible at this size that it's skipped rather than modeled).
    /// SwiftUI has no per-edge stroke width, so this draws it the same
    /// way `QuickActionsComponentView.balanceAccessory` draws its ring:
    /// an outer shape filled with the accent color, with an inner shape
    /// of the same corner radius — filled with the card's own background
    /// and inset unevenly (3pt left, 1pt elsewhere) — sitting on top of
    /// it. The accent only shows through the sliver the inner shape
    /// doesn't cover.
    @ViewBuilder
    private var cardBackground: some View {
        ZStack {
            RoundedRectangle(cornerRadius: DSRadius.card).fill(accentColor)
            RoundedRectangle(cornerRadius: DSRadius.card)
                .fill(context.themeResolver.color(forToken: item.style?.backgroundToken ?? "surface.default", colorScheme: colorScheme))
                .padding(EdgeInsets(top: 1, leading: 3, bottom: 1, trailing: 1))
        }
        .shadow(color: .black.opacity(0.07), radius: 3, x: 0, y: 1)
    }

    /// A themed ring around the item's icon — Figma's `quick_request_360`
    /// card (node 5382:6441) draws its icon exactly this way (a circular
    /// accent-colored ring around the glyph). `complete_kyc` uses a
    /// larger illustrated image this build has no artwork for yet, so
    /// this same ring stands in for it too — the sanctioned "no real art
    /// yet" placeholder convention already used for `style_qr`, kept as
    /// one consistent icon treatment across every Action Center card
    /// rather than a per-card special case.
    private var accentIcon: some View {
        ZStack {
            Circle().stroke(accentColor, lineWidth: 1)
            AsyncAssetImage(resolved: TextResolution.resolve(item.media?.leading, context: context.bindingContext), size: 18)
        }
        .frame(width: 36, height: 36)
    }

    /// The one color driving this card's stripe, ring, and (for the
    /// critical/accent theme) its meta text — keyed off the same
    /// `style.backgroundToken` the card's fill already reads, so a themed
    /// card stays visually consistent without adding a second schema
    /// field just for the accent. `surface.accent`/`surface.success` map
    /// to real color TOKENS (`status.critical.text` — the same red
    /// Figma's `quick_request_360` border and button both use, an exact
    /// match — and `status.success.text`), but both — along with
    /// `surface.border` in the `default` case — turned out to be missing
    /// from the theme payload this app actually receives on device (the
    /// currently-published revision, and the bundled fallback, both
    /// predate these tokens), which silently grayed out the 360° Request
    /// card's ring/meta/button entirely. `color(forToken:colorScheme
    /// :fallbackHex:)` covers that gap with the same literal Figma value
    /// the web portal preview's own `tokens[...] ?? "#hex"` fallback
    /// already uses for this exact case, so both platforms degrade the
    /// same way instead of iOS alone going flat gray. `surface.info`/
    /// `surface.warning` have no matching token at all yet (not even a
    /// stale one), so `info` is hardcoded straight from the Figma
    /// `complete_kyc` spec (`#356FFF`) and `warning` is a same-family
    /// amber approximation — there's no Figma reference for the `invite`
    /// card's own design this round, so that one isn't a measured value.
    private var accentColor: Color {
        switch item.style?.backgroundToken {
        case "surface.accent":
            return context.themeResolver.color(forToken: "status.critical.text", colorScheme: colorScheme, fallbackHex: "#E44239")
        case "surface.info":
            return ThemeResolver.parse("#356FFF") ?? .blue
        case "surface.warning":
            return ThemeResolver.parse("#F2994A") ?? .orange
        case "surface.success":
            return context.themeResolver.color(forToken: "status.success.text", colorScheme: colorScheme, fallbackHex: "#17A24E")
        default:
            return context.themeResolver.color(forToken: "surface.border", colorScheme: colorScheme, fallbackHex: "#DEDEDE")
        }
    }
}

struct ActionButtonView: View {
    let button: ButtonSpec
    let context: RenderContext
    /// The color an unstyled button (no `buttonStyle` at all, e.g.
    /// `request_advance_cta`) falls back to — Figma's two reference
    /// buttons for this exact gap (`complete_kyc_cta`, 4908:2651,
    /// `#3D6BE4`; `request_advance_cta`'s own button, 5382:6452,
    /// `#E44239`) turn out to each match their *own card's* accent color,
    /// not one shared brand blue, so `ActionCenterCard` passes its own
    /// `accentColor` through here instead of this hardcoding one value
    /// for every card. Defaults to the KYC blue for any caller that
    /// doesn't have a card accent to pass (there are none today, but this
    /// keeps the type usable standalone).
    var defaultColor: Color = ThemeResolver.parse("#3D6BE4") ?? .accentColor

    var body: some View {
        let label = TextResolution.resolve(button.label, context: context.bindingContext)
        Button {
            context.actionRegistry.perform(actionId: button.actionId)
        } label: {
            HStack(spacing: 4) {
                if button.iconPosition != .end {
                    AsyncAssetImage(resolved: TextResolution.resolve(button.icon, context: context.bindingContext), size: 16)
                }
                if !label.isEmpty {
                    // Figma's own button text (node 4908:2654, "Complete
                    // KYC") is `whitespace-nowrap` — never wrapping. This
                    // button hugs its own content (no fixed width of its
                    // own), and its parent `ActionCenterCard` now gives the
                    // whole card room to grow past its Figma-baseline width
                    // when needed (see `cardWidth`'s doc comment) — but
                    // without `.fixedSize` here, a plain `Text` still asks
                    // for less than its true single-line width whenever an
                    // ancestor's layout math proposes anything tighter,
                    // wrapping "Complete KYC" into "Complete" / "KYC"
                    // instead of asking the card to grow. `.fixedSize` makes
                    // this label always report its true ideal single-line
                    // width as a hard requirement, which is what actually
                    // drives the card wider; `.lineLimit(1)` is the
                    // belt-and-suspenders backstop (truncate, never wrap, in
                    // case something still squeezes it tighter regardless).
                    // Mirrors `RechargeBillsComponentView.bottomChip(_:)`'s
                    // `view_more` label, which guards the same way.
                    Text(label)
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                }
                if button.iconPosition == .end {
                    AsyncAssetImage(resolved: TextResolution.resolve(button.icon, context: context.bindingContext), size: 16)
                }
            }
            // Figma's Action Center buttons (nodes 4908:2651 "Complete
            // KYC" — `rounded-[8px]`, 5382:6452 the arrow-only button —
            // `rounded-[4px]`) are rectangles, not the full pill this used
            // to clip to; both specs use the same `py-[4px]` vertical
            // padding, and an icon-only button (empty `label`, e.g.
            // `request_advance_cta`) gets tighter horizontal padding to
            // match the near-square button Figma shows for it.
            .padding(.horizontal, label.isEmpty ? 10 : 12).padding(.vertical, 4)
            .background(buttonBackground)
            .foregroundStyle(buttonForeground)
            .clipShape(RoundedRectangle(cornerRadius: label.isEmpty ? 4 : 8))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(button.accessibilityLabel.map { TextResolution.resolve($0, context: context.bindingContext) } ?? label)
    }

    private var buttonBackground: some ShapeStyle {
        switch button.buttonStyle?.variant {
        case .outline, .ghost: return AnyShapeStyle(Color.clear)
        default: return AnyShapeStyle(roleColor.opacity(0.9))
        }
    }

    private var buttonForeground: Color {
        switch button.buttonStyle?.variant {
        case .outline, .ghost: return roleColor
        default: return .white
        }
    }

    private var roleColor: Color {
        switch button.buttonStyle?.role {
        case .success: return .green
        case .critical: return .red
        case .neutral: return .gray
        default: return defaultColor
        }
    }
}
