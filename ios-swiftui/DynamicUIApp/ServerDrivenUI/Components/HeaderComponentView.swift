import SwiftUI
import UIKit

/// Renders `type: "header"`. Does not support `audience`/`dataSourceId`/
/// `layout` (docs/component-catalog.md) — its one dynamic piece is
/// `subDetails.variants`, which picks the first variant whose own
/// `audience` rule matches the current context (that's a second, narrower
/// audience check *inside* the component, distinct from the component-level
/// one every other type uses).
struct HeaderComponentView: View {
    let component: Component
    let context: RenderContext

    var body: some View {
        HStack(spacing: DSSpacing.md) {
            avatarImage

            VStack(alignment: .leading, spacing: 2) {
                Text(userName)
                    .font(.headline)
                    .lineLimit(1)
                if let variant = activeSubDetailVariant {
                    subDetailView(variant)
                }
            }

            Spacer(minLength: DSSpacing.sm)

            HStack(spacing: DSSpacing.md) {
                ForEach(component.props.rightActions ?? []) { action in
                    Button {
                        context.actionRegistry.perform(actionId: action.actionId)
                    } label: {
                        AsyncAssetImage(resolved: TextResolution.resolve(action.icon, context: context.bindingContext), size: 22, cornerRadius: 4)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(DSSpacing.lg)
    }

    /// `nameField`/`profileImageField` name *which* binding path to read —
    /// this PoC's `MockUserProfile` always exposes the user's name at
    /// `user.userName` regardless of what `nameField` says, since there is
    /// no generic "read this arbitrary field name" capability in
    /// `BindingContext` (deliberately: that would reopen the "server names
    /// an arbitrary field" door docs/architecture-review.md §6 closes for
    /// actions/data-sources).
    private var userName: String {
        context.bindingContext.stringValue(forPath: "user.userName") ?? "—"
    }

    /// A real session/auth override always wins (`.remote`, subject to
    /// `AsyncAssetImage`'s https-only trust boundary, same as every other
    /// remote asset). With no override — the only case this PoC's
    /// `MockUserProfile.assetURL` ever produces, since it seeds no mock
    /// avatar URL — this used to fall through to `AsyncAssetImage`'s
    /// neutral gray-circle placeholder. Now it falls back to a bundled
    /// demo photo instead, rendered directly below (not through
    /// `AsyncAssetImage`'s generic `.bundled` path, which insets/pads a
    /// glyph for icon tiles — wrong treatment for a face photo, which
    /// wants to fill the circle edge-to-edge like a real avatar does).
    @ViewBuilder
    private var avatarImage: some View {
        if let override = context.bindingContext.assetURL(forPath: "user.profileImage") {
            AsyncAssetImage(resolved: .remote(override), size: 44, cornerRadius: 22)
        } else if let demo = UIImage(named: "profile_avatar_demo", in: .module, compatibleWith: nil) {
            Image(uiImage: demo)
                .resizable()
                .scaledToFill()
                .frame(width: 44, height: 44)
                .clipShape(Circle())
        } else {
            AsyncAssetImage(resolved: nil, size: 44, cornerRadius: 22)
        }
    }

    private var activeSubDetailVariant: HeaderSubDetailVariant? {
        component.props.subDetails?.variants.first { AudienceEvaluator.matches($0.audience, context: context.audienceContext) }
    }

    @ViewBuilder
    private func subDetailView(_ variant: HeaderSubDetailVariant) -> some View {
        let text = TextResolution.resolve(variant.valueBinding, context: context.bindingContext)
        if !text.isEmpty {
            HStack(spacing: 4) {
                if variant.textType == .badge {
                    Text(text)
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(Capsule().fill(Color.accentColor.opacity(0.15)))
                } else {
                    Text(text).font(.subheadline).foregroundStyle(.secondary)
                }
            }
            .onTapGesture { context.actionRegistry.perform(actionId: variant.actionId) }
        }
    }
}
