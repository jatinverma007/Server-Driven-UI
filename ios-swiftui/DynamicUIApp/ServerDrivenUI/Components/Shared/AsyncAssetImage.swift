import SwiftUI
import UIKit

/// Renders a `ResolvedAsset` (see `Domain/TextResolution.swift`). This is
/// the asset trust boundary from docs/architecture-review.md §7.4: a
/// `.remote` case is only ever loaded as opaque image bytes via
/// `AsyncImage`, and only when its URL scheme is literally `https` — never
/// interpreted as HTML, never used to construct any other request. A
/// missing bundled asset or an unresolved/pending reference renders a
/// neutral placeholder, never a crash or a broken-image glyph.
public struct AsyncAssetImage: View {
    let resolved: ResolvedAsset?
    var size: CGFloat = 40
    /// Overrides `size` for an asset this call site knows is genuinely
    /// non-square — e.g. `rechargeBills`' `electricity` item's "New"
    /// badge (Figma `HANDOVER--PAY` node 5382:7658, a 29×11 wide pill,
    /// not a square glyph). Every other case here squares off both the
    /// frame and (for a `.remote` image) the crop via `.scaledToFill()`,
    /// which is correct for an icon meant to fill a square tile but would
    /// crop the sides off a wide pill — a non-nil `frameSize` switches the
    /// `.remote` path to `.scaledToFit()` instead so the whole badge
    /// stays visible. Left `nil`, behavior is identical to before this
    /// existed.
    var frameSize: CGSize?
    var cornerRadius: CGFloat = DSRadius.thumbnail

    public init(resolved: ResolvedAsset?, size: CGFloat = 40, frameSize: CGSize? = nil, cornerRadius: CGFloat = DSRadius.thumbnail) {
        self.resolved = resolved
        self.size = size
        self.frameSize = frameSize
        self.cornerRadius = cornerRadius
    }

    private var effectiveSize: CGSize { frameSize ?? CGSize(width: size, height: size) }

    // NOTE: this body is intentionally split into small, separately-typed
    // helper views (`remoteImage`, `bundledImage`, `remoteImagePhase`)
    // rather than one deeply-nested switch/if-else/switch expression.
    // The single-expression version type-checks correctly but can push the
    // compiler into pathological inference time, and when it gives up it
    // reports a misleading, unrelated diagnostic (observed: a `TableColumn`
    // generic-inference error that has nothing to do with this view).
    // Breaking it up keeps each piece trivial to infer on its own.
    public var body: some View {
        content
            .frame(width: effectiveSize.width, height: effectiveSize.height)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
    }

    @ViewBuilder
    private var content: some View {
        switch resolved {
        case .remote(let urlString):
            remoteImage(urlString: urlString)
        case .bundled(let name):
            bundledImage(name: name)
        case .none:
            placeholder
        }
    }

    @ViewBuilder
    private func remoteImage(urlString: String) -> some View {
        if let url = URL(string: urlString), url.scheme == "https" {
            AsyncImage(url: url) { phase in
                remoteImagePhase(phase)
            }
        } else {
            let _ = AppLogger.warning("Refusing non-https asset URL '\(urlString)'", category: .renderer)
            placeholder
        }
    }

    @ViewBuilder
    private func remoteImagePhase(_ phase: AsyncImagePhase) -> some View {
        switch phase {
        case .success(let image):
            if frameSize != nil {
                image.resizable().scaledToFit()
            } else {
                image.resizable().scaledToFill()
            }
        case .empty:
            ProgressView().frame(width: effectiveSize.width, height: effectiveSize.height)
        case .failure:
            placeholder
        @unknown default:
            placeholder
        }
    }

    /// Prefers a real asset-catalog image under this exact name, and falls
    /// back to `BundledIconCatalog`'s SF Symbol for it. The app ships no
    /// asset catalog today, so in practice every `bundled` glyph resolves
    /// through the symbol table — see `BundledIconCatalog` for why, and
    /// for what used to happen instead (a grey placeholder, e.g. the empty
    /// Quick Actions "Add Money" tile). `UIImage(named:in:with:)` is the
    /// lookup rather than `Image(_:bundle:)` because only the former
    /// reports *whether* the name resolved; `Image(_:bundle:)` renders
    /// nothing and reports nothing, which is exactly how this failure
    /// stayed invisible. (`compatibleWith:` rather than `with:` —
    /// `nil` is ambiguous across the two overloads otherwise.)
    ///
    /// A real catalog image and the SF Symbol fallback get *different*
    /// treatment, deliberately: the `padding(size * 0.18)` +
    /// `scaledToFit()` below exists to keep an abstract system glyph
    /// (drawn edge-to-edge in its own bounding box) from looking
    /// oversized next to hand-drawn icon art. A real supplied asset (e.g.
    /// `add_money`) is already composed and margined by its own artwork —
    /// putting it through that same inset made it visibly smaller than
    /// its `remote`-icon siblings in Quick Actions (Send Money/Scan &
    /// Pay/FASTag, which render via `remoteImagePhase`'s plain
    /// `.scaledToFill()`, no extra inset). This matches that sibling
    /// treatment instead.
    @ViewBuilder
    private func bundledImage(name: String) -> some View {
        if let uiImage = UIImage(named: name, in: .module, compatibleWith: nil) {
            Image(uiImage: uiImage)
                .resizable()
                .scaledToFill()
        } else if let symbol = BundledIconCatalog.symbolName(for: name) {
            Image(systemName: symbol)
                .resizable()
                .scaledToFit()
                .fontWeight(.medium)
                .padding(size * 0.18)
        } else {
            let _ = AppLogger.warning("No bundled asset or symbol for icon name '\(name)'", category: .renderer)
            placeholder
        }
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Color.gray.opacity(0.15))
    }
}
