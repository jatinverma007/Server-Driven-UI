import SwiftUI

/// The client-side resolution table for `AssetRef.bundled(name:)`.
///
/// `bundled` is deliberately a **closed set of names the client already
/// ships** (docs/architecture-review.md §6/§11: the server names a thing
/// from an agreed catalog, it never hands the client a drawable). Until
/// now nothing actually resolved those names — the app carries no asset
/// catalog, so every `Image(name, bundle: .module)` lookup silently
/// produced nothing and `AsyncAssetImage` fell through to its grey
/// placeholder. That is why the Quick Actions "Add Money" tile rendered
/// as an empty grey square while its neighbours (which use `remote`
/// URLs) rendered fine, and the same was true of every other `bundled`
/// glyph in the payload — the Check Balance eye, Style Your QR, the
/// Action Center's KYC/approve/reject marks, the bottom nav's Reports
/// and Rewards tabs.
///
/// Each name maps to an SF Symbol: resolution-independent, themable via
/// `foregroundStyle`, light/dark-correct for free, and shipped with the
/// OS rather than added to the bundle. A name that is later given a real
/// vector in an asset catalog still wins — `AsyncAssetImage` prefers a
/// catalog hit and only falls back here — so swapping in the exact Figma
/// artwork per icon is a drop-in change that needs no edit to this file
/// or to any call site.
///
/// Unknown name → `nil`, and `AsyncAssetImage` keeps its existing
/// placeholder behaviour: a server naming a glyph this build has never
/// heard of is a layout no-op, never a crash and never a broken-image
/// glyph (same contract as `ThemeResolver`'s unknown-token fallback).
public enum BundledIconCatalog {
    public static func symbolName(for name: String) -> String? {
        symbols[name]
    }

    /// Chosen to read correctly at the two sizes these actually render
    /// at — a ~32pt tile glyph and a ~11-16pt inline chip glyph — and to
    /// stay legible in both colour schemes.
    private static let symbols: [String: String] = [
        // Quick Actions
        "add_money": "indianrupeesign.square",
        "balance": "eye",
        "style_qr": "qrcode",

        // Action Center
        "kyc": "person.text.rectangle",
        "invite_approve": "checkmark",
        "invite_reject": "xmark",
        "quick_request": "bolt.badge.clock",
        "user_avatar_placeholder": "person.crop.circle",

        // Recharge & Bills
        "bharat_connect": "building.columns",
        "wallet_alert": "exclamationmark.circle",

        // Monthly claim / rewards
        "download": "arrow.down.circle",

        // Header + bottom navigation
        "upgrade_badge": "sparkles",
        "reports": "chart.bar.doc.horizontal",
        "rewards": "gift",

        // Shared affordances
        //
        // `arrow` used to map to `chevron.right` (a bare angle-bracket,
        // no shaft) — visibly thinner/shorter than Figma's actual glyph.
        // Confirmed against node 5382:6439 (the 360° Request card's
        // `request_advance_cta` button, `icon: "arrow"`): Figma renders a
        // full horizontal arrow with a shaft, identical to `arrow_right`'s
        // `arrow.right` elsewhere (e.g. the recharge/rewards "View more"
        // chips) — the two names were never meant to look different, so
        // they now share the same symbol. The portal's `BUNDLED_GLYPH_FALLBACK`
        // already maps both `arrow` and `arrow_right` to the same "→"
        // glyph, which is why this mismatch was iOS-only.
        "arrow": "arrow.right",
        "arrow_right": "arrow.right",
    ]
}
