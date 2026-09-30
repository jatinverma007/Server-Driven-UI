import SwiftUI

struct LoadingView: View {
    var body: some View {
        VStack(spacing: DSSpacing.md) {
            ProgressView()
            Text("Loading your home screen…").font(.footnote).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Shown when a screen's components all filter out (disabled, or none
/// match the current audience) — distinct from `.error`, since the fetch
/// itself succeeded and the payload is valid; there is simply nothing this
/// user is meant to see right now.
struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: DSSpacing.sm) {
            Image(systemName: "tray").font(.largeTitle).foregroundStyle(.tertiary)
            Text("Nothing to show here yet").font(.subheadline).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ErrorStateView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: DSSpacing.md) {
            Image(systemName: "wifi.exclamationmark").font(.largeTitle).foregroundStyle(.orange)
            Text("Couldn't load your home screen").font(.headline)
            Text(message).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center).padding(.horizontal, DSSpacing.xl)
            Button("Try again", action: retry).buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct IncompatibleVersionView: View {
    let installedVersion: String
    let requiredVersion: String

    var body: some View {
        VStack(spacing: DSSpacing.md) {
            Image(systemName: "arrow.up.circle").font(.largeTitle).foregroundStyle(.blue)
            Text("Update required").font(.headline)
            Text("This app version (\(installedVersion)) is older than what's needed to show the latest home screen (\(requiredVersion) or newer). Please update from the App Store.")
                .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center).padding(.horizontal, DSSpacing.xl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct StaleBanner: View {
    var body: some View {
        HStack(spacing: DSSpacing.xs) {
            Image(systemName: "clock.arrow.circlepath")
            Text("Showing a saved version — pull to refresh")
        }
        .font(.caption2)
        .foregroundStyle(.orange)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity)
        .background(Color.orange.opacity(0.1))
    }
}

#if DEBUG
/// DEBUG-only diagnostic strip: which source the active config came from,
/// plus the B2B/B2C preview toggle (the native equivalent of the portal's
/// preview audience switcher). Never compiled into a RELEASE build.
struct DebugSourceBadge: View {
    let source: ConfigurationSource
    @Binding var userProfile: MockUserProfile

    var body: some View {
        HStack {
            Text("source: \(String(describing: source))").font(.caption2).foregroundStyle(.secondary)
            Spacer()
            Picker("Audience", selection: $userProfile) {
                Text("B2C").tag(MockUserProfile.b2c)
                Text("B2B").tag(MockUserProfile.b2b)
            }
            .pickerStyle(.segmented)
            .frame(width: 120)
        }
        .padding(.horizontal, DSSpacing.md)
        .padding(.vertical, 4)
    }
}
#endif
