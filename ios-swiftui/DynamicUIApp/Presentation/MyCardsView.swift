import SwiftUI

/// Native destination for the `cards` bottom-nav tab ("My Cards" — see
/// `AppAction.cards` / `ActionRegistry`). This screen is NOT a `screens[]`
/// entry in the SDUI schema — like every other bottom-nav destination in
/// this PoC (`scan_pay`, `reports`, `history`, …), the backend only ever
/// emits the `cards` actionId as an opaque identifier, and what happens for
/// it is 100% native, compiled-in navigation
/// (docs/architecture-review.md §6 — the server describes UI, it never
/// executes navigation).
///
/// It hosts the B2B/B2C preview toggle as a first-class, always-available
/// control — the same `MockUserProfile` stand-in the portal's own preview
/// dropdown exercises (see `Domain/MockUserProfile.swift`), so this app can
/// demo both audience experiences without a real backend session or two
/// separate builds. This is deliberately a *different* surface from
/// `StateViews.swift`'s `DebugSourceBadge`, which is the same idea but
/// gated behind `#if DEBUG` + a hardcoded flag for ad-hoc engineering
/// debugging — this one is reachable by anyone who taps "My Cards".
///
/// The toggle is bound directly to the shared `userProfile`, so flipping it
/// here is reflected immediately (the segmented control itself updates).
/// Going back to Home re-derives `RenderContext` from that same
/// `@Published` value (`ConfigurationViewModel.renderContext()`), which is
/// what actually flips Quick Actions/the bottom tabs/the
/// rewards_hub-vs-monthly_claim swap — `onDone` additionally triggers a
/// real `refresh()` so Home re-fetches the latest config too, not just
/// re-evaluates audience rules against whatever was already in memory.
struct MyCardsView: View {
    @Binding var userProfile: MockUserProfile
    let onDone: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: DSSpacing.xl) {
                VStack(alignment: .leading, spacing: DSSpacing.sm) {
                    Text("Preview audience")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("Switch who this app pretends to be signed in as. Quick Actions, the bottom tabs, and the Offers/Claims card below Recharge & Bills all update to match once you're back on Home.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Picker("Audience", selection: $userProfile) {
                    Text("B2C").tag(MockUserProfile.b2c)
                    Text("B2B").tag(MockUserProfile.b2b)
                }
                .pickerStyle(.segmented)

                cardsPlaceholder

                Spacer()
            }
            .padding(DSSpacing.lg)
            .navigationTitle("My Cards")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onDone)
                }
            }
        }
    }

    /// A stand-in for the actual card-management UI this PoC doesn't build
    /// out — this screen's job here is to host the audience toggle, not to
    /// be a finished "My Cards" feature.
    private var cardsPlaceholder: some View {
        VStack(spacing: DSSpacing.sm) {
            Image(systemName: "creditcard")
                .font(.largeTitle)
                .foregroundStyle(.tertiary)
            Text("Card management isn't built out in this PoC yet.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(DSSpacing.xl)
        .background(
            RoundedRectangle(cornerRadius: DSRadius.sectionCard)
                .fill(Color(.secondarySystemBackground))
        )
    }
}
