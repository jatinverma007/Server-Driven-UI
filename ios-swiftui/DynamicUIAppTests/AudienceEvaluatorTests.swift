import XCTest
@testable import DynamicUIAppCore

/// Mirrors the exact cases `frontend/tests/portalLogic.test.ts` exercises
/// against `lib/portal/audience.ts` — the three implementations of this
/// matcher (backend, portal preview, iOS) must agree bit-for-bit.
final class AudienceEvaluatorTests: XCTestCase {
    func testAbsentRuleMatchesEveryone() {
        let b2b = AudienceContext(userType: "B2B")
        let b2c = AudienceContext(userType: "B2C")
        XCTAssertTrue(AudienceEvaluator.matches(nil, context: b2b))
        XCTAssertTrue(AudienceEvaluator.matches(nil, context: b2c))
    }

    func testAllWithInRestrictsToTheListedAudience() {
        let rule = AudienceRule(all: [AudienceCondition(field: .userType, operator: .in_, value: .list(["B2B"]))], any: nil, none: nil)
        XCTAssertTrue(AudienceEvaluator.matches(rule, context: AudienceContext(userType: "B2B")))
        XCTAssertFalse(AudienceEvaluator.matches(rule, context: AudienceContext(userType: "B2C")))
    }

    func testNoneExcludesTheListedAudience() {
        let rule = AudienceRule(all: nil, any: nil, none: [AudienceCondition(field: .userType, operator: .in_, value: .list(["B2C"]))])
        XCTAssertTrue(AudienceEvaluator.matches(rule, context: AudienceContext(userType: "B2B")))
        XCTAssertFalse(AudienceEvaluator.matches(rule, context: AudienceContext(userType: "B2C")))
    }

    func testEqAndNeq() {
        let eq = AudienceCondition(field: .userRole, operator: .eq, value: .single("admin"))
        XCTAssertTrue(AudienceEvaluator.matches(AudienceRule(all: [eq], any: nil, none: nil), context: AudienceContext(userType: "B2C", userRole: "admin")))
        XCTAssertFalse(AudienceEvaluator.matches(AudienceRule(all: [eq], any: nil, none: nil), context: AudienceContext(userType: "B2C", userRole: "viewer")))
    }

    func testNotInWithMissingFieldIsTreatedAsPassing() {
        // Mirrors semanticValidator.ts: notIn with no actual value can't be
        // "in" the excluded list, so it passes.
        let cond = AudienceCondition(field: .featureFlag, operator: .notIn, value: .list(["beta"]))
        XCTAssertTrue(AudienceEvaluator.matches(AudienceRule(all: [cond], any: nil, none: nil), context: AudienceContext(userType: "B2C")))
    }

    func testGteLteStringCompare() {
        let gte = AudienceCondition(field: .appVersion, operator: .gte, value: .single("1.5.0"))
        XCTAssertTrue(AudienceEvaluator.matches(AudienceRule(all: [gte], any: nil, none: nil), context: AudienceContext(userType: "B2C", appVersion: "1.6.0")))
        XCTAssertFalse(AudienceEvaluator.matches(AudienceRule(all: [gte], any: nil, none: nil), context: AudienceContext(userType: "B2C", appVersion: "1.2.0")))
    }
}
