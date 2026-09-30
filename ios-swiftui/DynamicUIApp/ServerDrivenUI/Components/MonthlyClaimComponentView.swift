import SwiftUI

/// Renders `type: "monthlyClaim"`. Unlike `quickActions`/`rechargeBills`,
/// this component has NO section-level card — each status row in
/// `props.items` gets its own small white/bordered card instead (Figma
/// `HANDOVER--PAY` node 5382:7195 "Approved" / node 5382:7223 "Rejected",
/// both children of node 5382:7183 — see `docs/component-catalog.md`'s
/// "Corner radius / tile shape / gradients" section).
///
/// The card chrome — border, divider, badge color/copy, checkmark,
/// "View Details" arrow — is entirely native, keyed off the item's `id`
/// ("approved"/"rejected") via `ClaimStatus`, exactly like `check_balance`
/// is keyed off `actionId` in `QuickActionsComponentView`: it's business
/// logic tied to a known, closed set of items, not a generic schema-driven
/// status field. Only the label text (`item.label`) and the live
/// amount/count figures (`dataSourceId` → `DataSourceRegistry`) are
/// schema/data-bound.
///
/// Two fixes against the full-screen reference (node 5382:7185, "This
/// month's claim"), both the same class of bug as `rewards_hub`'s earlier
/// "View more" fix — a value was being resolved but never actually put in
/// the view:
/// - The title is `text-[#0a0a0a]` in Figma — near-black, not the muted
///   gray every other section title (`quickActions`/`rechargeBills`/
///   `rewardsHub`) uses. That's not a copy/paste of the shared style here;
///   it's `text.primary`, the same near-black token `ClaimCard` already
///   uses for the ₹ amount figures — confirmed distinct from `.secondary`,
///   not a rounding-error-sized difference.
/// - "Download report" (node 5382:7189) was rendering as an icon with NO
///   visible label — `label` was resolved and handed to
///   `.accessibilityLabel` but never placed in the view itself. Figma
///   shows it as `text.link`-blue text next to the icon, not icon-only.
struct MonthlyClaimComponentView: View {
    let component: Component
    let context: RenderContext
    @Environment(\.colorScheme) private var colorScheme
    @State private var summary: MonthlyClaimSummaryResponse?

    var body: some View {
        VStack(alignment: .leading, spacing: DSSpacing.md) {
            HStack {
                if let title = component.props.title {
                    Text(TextResolution.resolve(title, context: context.bindingContext))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(context.themeResolver.color(forToken: "text.primary", colorScheme: colorScheme))
                }
                Spacer()
                if let download = component.props.topItems?.first {
                    let label = TextResolution.resolve(download.label, context: context.bindingContext)
                    Button { context.actionRegistry.perform(actionId: download.actionId) } label: {
                        // Figma (node 5382:7189) has an 8pt gap between
                        // "Download report" and its icon — `spacing: 4`
                        // was half that, cramping the icon against the
                        // text.
                        HStack(spacing: DSSpacing.sm) {
                            if !label.isEmpty { Text(label).font(.system(size: 12, weight: .medium)) }
                            AsyncAssetImage(resolved: TextResolution.resolve(download.media?.leading, context: context.bindingContext), size: 14)
                        }
                        .foregroundStyle(context.themeResolver.color(forToken: "text.link", colorScheme: colorScheme, fallbackHex: "#336DFF"))
                        .frame(height: 24)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(download.accessibilityLabel.map { TextResolution.resolve($0, context: context.bindingContext) } ?? label)
                }
            }
            .padding(.horizontal, DSSpacing.lg)
            .frame(height: 24)
            HStack(alignment: .top, spacing: 19) {
                ForEach(component.props.items ?? []) { item in
                    if let status = ClaimStatus(itemId: item.id) {
                        ClaimCard(
                            item: item,
                            status: status,
                            amountText: amountText(for: status),
                            countText: countText(for: status),
                            context: context
                        )
                    }
                }
            }
            .frame(width: 359, height: 117, alignment: .leading)
        }
        .padding(.horizontal, DSSpacing.lg)
        .task(id: component.props.dataSourceId) {
            guard component.props.dataSourceId != nil else { return }
            summary = await context.dataSourceRegistry.fetchMonthlyClaimSummary()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func amountText(for status: ClaimStatus) -> String {
        guard let summary else { return "—" }
        let raw = status == .approved ? summary.approvedAmount : summary.rejectedAmount
        return "\(CurrencySymbol.symbol(forCode: summary.currency))\(CurrencySymbol.formatAmount(raw))"
    }

    private func countText(for status: ClaimStatus) -> String {
        guard let summary else { return "" }
        let count = status == .approved ? summary.approvedCount : summary.rejectedCount
        return "\(count) claim\(count == 1 ? "" : "s")"
    }
}

/// Keyed off `ComponentItem.id` — the two ids the seeded catalog's
/// `monthlyClaim.props.items` actually uses ("approved"/"rejected"). An
/// item with any other id (none exist in the seeded catalog today, but the
/// schema doesn't forbid one) is skipped rather than guessed at, matching
/// `ItemGridView`'s general "don't render what you can't identify" stance.
private enum ClaimStatus {
    case approved
    case rejected

    init?(itemId: String) {
        switch itemId {
        case "approved": self = .approved
        case "rejected": self = .rejected
        default: return nil
        }
    }

    var accentTextToken: String { self == .approved ? "status.success.text" : "status.critical.text" }
    var badgeBackgroundToken: String { self == .approved ? "status.success.background" : "status.critical.background" }
    var badgeLabel: String { self == .approved ? "Cleared" : "Action needed" }
    var showsCheckmark: Bool { self == .approved }
}

/// Maps the ISO currency code `MonthlyClaimSummaryResponse.currency` may
/// carry to its display symbol. Native, not schema-driven — this is
/// presentation of already-fetched data (like `TileShape`), not new
/// content from the server. An unrecognized code falls back to the code
/// itself plus a space (e.g. "USD 100") rather than silently dropping it.
private enum CurrencySymbol {
    static func symbol(forCode code: String) -> String {
        switch code {
        case "INR": return "₹"
        case "USD": return "$"
        case "EUR": return "€"
        case "GBP": return "£"
        default: return "\(code) "
        }
    }

    static func formatAmount(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return trimmed }
        guard !trimmed.contains(","), let value = Int(trimmed) else { return trimmed }
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_IN")
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? trimmed
    }
}

/// One status card (node 5382:7195 / 5382:7223) — white
/// (`surface.default`), 1pt `surface.border`-stroked, and
/// `DSRadius.claimCard`-rounded, with a
/// hairline-divided header (status label + amount + count/badge row) and
/// a "View Details" footer row. The whole card is tappable (same
/// `actionId` as the item — `view_approved_claims`/`view_rejected_claims`
/// — not just the "View Details" text), matching how the full card reads
/// as a single tap target in the Figma reference.
///
/// The card's OWN fill is always `surface.default`, never
/// `item.style?.backgroundToken` — both Figma references are `bg-white`
/// (confirmed via `get_design_context` on both nodes), not tinted green/
/// pink. Only the small status badge (see `badge` below) gets the
/// success/critical color; a whole-card tint was a regression against
/// that spec, not a deliberate design choice.
private struct ClaimCard: View {
    let item: ComponentItem
    let status: ClaimStatus
    let amountText: String
    let countText: String
    let context: RenderContext
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let label = TextResolution.resolve(item.label, context: context.bindingContext)
        Button {
            context.actionRegistry.perform(actionId: item.actionId)
        } label: {
            VStack(spacing: DSSpacing.xs) {
                VStack(spacing: DSSpacing.sm) {
                    HStack(spacing: DSSpacing.xs) {
                        flourish
                        Text(label)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(accentColor)
                        flourish
                    }
                    Text(amountText)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(context.themeResolver.color(forToken: "text.primary", colorScheme: colorScheme))
                        .frame(height: 30)
                    HStack {
                        Text(countText)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Spacer()
                        badge
                    }
                }
                .frame(width: 138, height: 74, alignment: .top)
                .overlay(alignment: .bottom) {
                    // Figma specs this hairline at a specific `#e8e8e8`
                    // (node 5382:7196/5382:7224), not the platform's
                    // semantic separator — the system separator resolves
                    // to a noticeably darker gray (~#c6c6c8 in light
                    // mode), which was a real color drift, not a
                    // deliberate "let the system adapt it" choice. No
                    // schema token covers this (it's the only hairline
                    // divider in the app), so it goes through the same
                    // fallback-hex path as `surface.border` above.
                    Rectangle()
                        .fill(context.themeResolver.color(forToken: "surface.divider", colorScheme: colorScheme, fallbackHex: "#E8E8E8"))
                        .frame(height: 0.5)
                }
                // Figma (node 5382:7218/5382:7244) hugs this row's own
                // content — no fixed width. The previous `.frame(width: 72,
                // height: 15)` was narrower than "View Details" (10pt
                // medium) + its 4pt horizontal padding + the 2pt gap + the
                // 12pt arrow actually need, so SwiftUI compressed the text
                // down to "View De…" instead of the button growing to fit —
                // same class of bug as `ActionCenterComponentView`'s
                // "Complete KYC" wrap (an exact width proposed to a flexible
                // `Text` gets honored by shrinking it, not by the text
                // asking for more room). `.fixedSize` + `.lineLimit(1)` make
                // the text always report its true single-line width, and
                // dropping the fixed width lets the row size to that
                // instead of clipping it.
                HStack(spacing: 2) {
                    Text("View Details")
                        .font(.system(size: 10, weight: .medium))
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .padding(.horizontal, 4)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 9, weight: .medium))
                        .frame(width: 12, height: 10)
                }
                .foregroundStyle(context.themeResolver.color(forToken: "text.link", colorScheme: colorScheme, fallbackHex: "#336DFF"))
                .frame(height: 15)
            }
        }
        .buttonStyle(.plain)
        .padding(.horizontal, DSSpacing.lg)
        .padding(.vertical, DSSpacing.md)
        .frame(width: 170, height: 117)
        .background(
            RoundedRectangle(cornerRadius: DSRadius.claimCard)
                .fill(context.themeResolver.color(forToken: "surface.default", colorScheme: colorScheme))
                .overlay(
                    RoundedRectangle(cornerRadius: DSRadius.claimCard)
                        .strokeBorder(context.themeResolver.color(forToken: "surface.border", colorScheme: colorScheme, fallbackHex: "#DEDEDE"), lineWidth: 1)
                )
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(amountText), \(countText), \(status.badgeLabel)")
    }

    /// A short decorative rule flanking the status label (Figma's thin
    /// flourish lines either side of "Approved"/"Rejected" — node
    /// 5382:7199/5382:7226). Purely visual chrome in the same status
    /// color as the label, so it's a native shape rather than a bundled
    /// asset (nothing here is content that a server payload could vary).
    private var flourish: some View {
        Rectangle()
            .fill(accentColor.opacity(0.5))
            .frame(width: 33, height: 1)
    }

    private var accentColor: Color {
        context.themeResolver.color(
            forToken: status.accentTextToken,
            colorScheme: colorScheme,
            fallbackHex: status == .approved ? "#17A24E" : "#E44239"
        )
    }

    @ViewBuilder
    private var badge: some View {
        HStack(spacing: 2) {
            Text(status.badgeLabel)
                .font(.system(size: 10))
            if status.showsCheckmark {
                Image(systemName: "checkmark")
                    .font(.system(size: 7, weight: .bold))
            }
        }
        .foregroundStyle(context.themeResolver.color(forToken: status.accentTextToken, colorScheme: colorScheme, fallbackHex: status == .approved ? "#17A24E" : "#E44239"))
        .padding(.horizontal, 4)
        .padding(.vertical, 2)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(context.themeResolver.color(forToken: status.badgeBackgroundToken, colorScheme: colorScheme, fallbackHex: status == .approved ? "#E6F9EE" : "#FFEBEA"))
        )
    }
}
