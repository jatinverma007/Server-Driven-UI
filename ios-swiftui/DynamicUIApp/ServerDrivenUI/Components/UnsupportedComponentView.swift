import SwiftUI

/// What renders for `.unsupported` (whether explicitly authored as
/// `"unsupported"` or an unrecognized future type — see `ComponentType`)
/// and for any `decodeFailed` placeholder. In RELEASE this is an
/// `EmptyView` — the component simply isn't there, which is the correct
/// production behavior (docs/architecture-review.md: a client must never
/// show developer-facing debug chrome to real users). In DEBUG it renders a
/// visible, labeled placeholder so this exact situation is easy to spot
/// while testing against a config with intentionally-unmapped widgets.
struct UnsupportedComponentView: View {
    let component: Component

    var body: some View {
        #if DEBUG
        VStack(alignment: .leading, spacing: 4) {
            Text("Unsupported component").font(.caption.weight(.semibold))
            Text("id: \(component.componentId) · type: \(component.type.kind)\(component.decodeFailed ? " · decode failed" : "")")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(DSSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: DSRadius.thumbnail)
                .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4]))
                .foregroundStyle(.orange)
        )
        .padding(.horizontal, DSSpacing.lg)
        #else
        EmptyView()
        #endif
    }
}
