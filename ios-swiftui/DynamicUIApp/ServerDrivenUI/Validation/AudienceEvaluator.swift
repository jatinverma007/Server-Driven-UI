import Foundation

/// The runtime context an `AudienceRule` is evaluated against — the native
/// equivalent of the portal's `PreviewContext` (`lib/portal/audience.ts`)
/// and the backend's evaluation inputs. Built once per render pass by
/// `ConfigurationViewModel` from `Domain/UserProfile.swift` plus
/// `AppEnvironment`; never influenced by anything the server sent.
public struct AudienceContext: Sendable {
    public var userType: String
    public var userRole: String?
    public var userPlanType: String?
    public var appVersion: String?
    public var featureFlag: String?

    public init(userType: String, userRole: String? = nil, userPlanType: String? = nil, appVersion: String? = nil, featureFlag: String? = nil) {
        self.userType = userType; self.userRole = userRole; self.userPlanType = userPlanType
        self.appVersion = appVersion; self.featureFlag = featureFlag
    }

    fileprivate func value(for field: AudienceField) -> String? {
        switch field {
        case .userType: return userType
        case .userRole: return userRole
        case .userPlanType: return userPlanType
        case .appVersion: return appVersion
        case .featureFlag: return featureFlag
        }
    }
}

/// Evaluates the same constrained, non-executable audience-rule shape as
/// `frontend/src/lib/validation/semanticValidator.ts` and
/// `frontend/src/lib/portal/audience.ts` — deliberately just a closed
/// field/operator matcher, never an expression evaluator
/// (docs/architecture-review.md §6). All three implementations (backend,
/// portal preview, iOS) MUST agree; `AudienceEvaluatorTests.swift` checks
/// this enum-by-enum against the same cases `portalLogic.test.ts` covers.
public enum AudienceEvaluator {
    public static func matches(_ rule: AudienceRule?, context: AudienceContext) -> Bool {
        guard let rule else { return true } // absent rule = everyone (docs/json-analysis.md A-03)
        if let all = rule.all, !all.allSatisfy({ evaluate($0, context: context) }) { return false }
        if let any = rule.any, !any.contains(where: { evaluate($0, context: context) }) { return false }
        if let none = rule.none, none.contains(where: { evaluate($0, context: context) }) { return false }
        return true
    }

    private static func evaluate(_ condition: AudienceCondition, context: AudienceContext) -> Bool {
        let actual = context.value(for: condition.field)
        switch condition.operator {
        case .eq:
            return actual == condition.value.asList.first && condition.value.asList.count == 1
        case .neq:
            return !(actual == condition.value.asList.first && condition.value.asList.count == 1)
        case .in_:
            guard let actual else { return false }
            return condition.value.asList.contains(actual)
        case .notIn:
            guard let actual else { return true }
            return !condition.value.asList.contains(actual)
        case .gte:
            return (actual ?? "") >= (condition.value.asList.first ?? "")
        case .lte:
            return (actual ?? "") <= (condition.value.asList.first ?? "")
        }
    }
}
