import Foundation

/// Mirrors `AudienceCondition`. The five allowed fields and six allowed
/// operators are a closed set on both ends of the wire — this is a
/// constrained matcher, never an expression evaluator
/// (docs/architecture-review.md §6, "no eval, no JS, no arbitrary predicate
/// language").
public enum AudienceField: String, Codable, Sendable {
    case userType = "user.type"
    case userRole = "user.role"
    case userPlanType = "user.planType"
    case appVersion = "app.version"
    case featureFlag = "feature.flag"
}

public enum AudienceOperator: String, Codable, Sendable {
    case eq, neq, in_ = "in", notIn, gte, lte
}

/// `value` is `string | string[]` on the wire; modeled as an enum instead of
/// `[String]` everywhere to preserve that distinction without silently
/// coercing (matches `lib/portal/audience.ts`'s `Array.isArray` branch).
public enum AudienceValue: Equatable, Sendable {
    case single(String)
    case list([String])

    public var asList: [String] {
        switch self {
        case .single(let s): return [s]
        case .list(let l): return l
        }
    }
}

extension AudienceValue: Codable {
    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) { self = .single(s); return }
        self = .list(try c.decode([String].self))
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .single(let s): try c.encode(s)
        case .list(let l): try c.encode(l)
        }
    }
}

public struct AudienceCondition: Codable, Equatable, Sendable {
    public let field: AudienceField
    public let `operator`: AudienceOperator
    public let value: AudienceValue
}

/// Mirrors `AudienceRule`: `all`/`any`/`none` groups of conditions, ANDed
/// together when more than one group is present (same semantics as
/// `lib/validation/semanticValidator.ts` and `lib/portal/audience.ts` — see
/// `ServerDrivenUI/Validation/AudienceEvaluator.swift` for the shared
/// evaluation logic all three implementations agree on).
public struct AudienceRule: Codable, Equatable, Sendable {
    public let all: [AudienceCondition]?
    public let any: [AudienceCondition]?
    public let none: [AudienceCondition]?
}
