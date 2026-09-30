import Foundation

/// iOS's own defensive re-validation pass — belt-and-suspenders on top of
/// the backend's publish-time validation (`frontend/src/lib/validation/semanticValidator.ts`).
/// Never trusts that a payload reaching `/published` was actually validated
/// (a future backend bug, a hand-edited SQLite row, a corrupted disk cache
/// — see docs/architecture-review.md "Defense in depth"). Deliberately
/// asymmetric with the backend: some backend-hard-reject conditions are
/// only *soft warnings* here, because by the time a config reaches this
/// layer the safer failure mode is "render what can be rendered" rather
/// than "discard the whole revision" — see the per-case comments below.
public enum ConfigurationValidator {
    public struct Issue: Sendable {
        public let code: String
        public let message: String
        public let severity: Severity
        public enum Severity: String, Sendable { case reject, warning }
    }

    public enum Outcome: Sendable {
        /// Safe to render as the active configuration (there may still be
        /// `warnings` worth logging).
        case acceptable(warnings: [Issue])
        /// Must NOT replace whatever is currently on screen — caller falls
        /// back to cache / bundled / last-known-good instead.
        case reject(reasons: [Issue])
    }

    public static func validate(_ config: HomeScreenConfiguration, supportedSchemaMajor: Int) -> Outcome {
        var rejects: [Issue] = []
        var warnings: [Issue] = []

        // --- Hard-reject conditions: never safe to render at all ---

        switch SchemaCompatibility.check(schemaVersion: config.schemaVersion, supportedMajor: supportedSchemaMajor) {
        case .compatible:
            break
        case .incompatibleMajorVersion(let got, let supported):
            rejects.append(Issue(code: "E_INCOMPATIBLE_SCHEMA_VERSION",
                                  message: "schemaVersion \(got) is not compatible with supported major \(supported)",
                                  severity: .reject))
        case .unparseableVersion(let raw):
            rejects.append(Issue(code: "E_INVALID_SCHEMA_VERSION",
                                  message: "schemaVersion '\(raw)' is not a valid semantic version",
                                  severity: .reject))
        }

        if config.screens.isEmpty {
            rejects.append(Issue(code: "E_NO_SCREENS", message: "screens[] is empty", severity: .reject))
        }

        var seenComponentIds = Set<String>()
        for screen in config.screens {
            if screen.components.isEmpty {
                rejects.append(Issue(code: "E_NO_COMPONENTS", message: "screen '\(screen.screenId)' has no components", severity: .reject))
            }
            for component in screen.components {
                if !seenComponentIds.insert(component.componentId).inserted {
                    // A duplicate componentId means SwiftUI's Identifiable-keyed
                    // rendering (and any per-component state) becomes ambiguous —
                    // unlike an unknown component TYPE, this is not something the
                    // renderer can locally isolate, so it's a hard reject here,
                    // matching the backend's E_DUPLICATE_COMPONENT_ID.
                    rejects.append(Issue(code: "E_DUPLICATE_COMPONENT_ID",
                                          message: "duplicate componentId '\(component.componentId)' on screen '\(screen.screenId)'",
                                          severity: .reject))
                }
            }
        }

        // --- Soft-warning conditions: log, but still render ---
        // Unlike the backend (which must refuse to PUBLISH anything
        // referencing an unknown action/component/data-source, since a bad
        // publish would be visible to every client), a config that already
        // reached this device should degrade gracefully per-component
        // rather than go dark entirely — the unknown piece renders as an
        // inert placeholder (ComponentRegistry / ActionRegistry) instead.
        for screen in config.screens {
            for component in screen.components {
                if component.decodeFailed {
                    warnings.append(Issue(code: "W_COMPONENT_DECODE_FAILED",
                                           message: "component '\(component.componentId)' on screen '\(screen.screenId)' did not decode fully",
                                           severity: .warning))
                }
                if case .unsupported(let rawType) = component.type, !component.decodeFailed {
                    warnings.append(Issue(code: "W_UNSUPPORTED_COMPONENT_TYPE",
                                           message: "component '\(component.componentId)' has unrecognized type '\(rawType)'",
                                           severity: .warning))
                }
            }
        }

        if !rejects.isEmpty {
            return .reject(reasons: rejects)
        }
        return .acceptable(warnings: warnings)
    }
}
