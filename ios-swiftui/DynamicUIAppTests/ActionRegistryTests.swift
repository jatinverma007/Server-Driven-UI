import XCTest
@testable import DynamicUIAppCore

@MainActor
final class ActionRegistryTests: XCTestCase {
    func testKnownActionInvokesItsRegisteredHandler() {
        let registry = ActionRegistry()
        var invoked = false
        registry.register(.checkBalance) { invoked = true }

        registry.perform(actionId: "check_balance")

        XCTAssertTrue(invoked)
    }

    func testUnknownActionIdNeverThrowsAndNeverInvokesAnything() {
        let registry = ActionRegistry()
        var invoked = false
        registry.register(.checkBalance) { invoked = true }

        registry.perform(actionId: "some_future_action_this_build_has_never_heard_of")

        XCTAssertFalse(invoked)
    }

    func testKnownActionWithNoRegisteredHandlerDoesNotCrash() {
        let registry = ActionRegistry()
        registry.perform(actionId: "check_balance") // no handler registered at all
        // Reaching this line without a trap/crash is the assertion.
    }

    func testNilActionIdIsANoOp() {
        let registry = ActionRegistry()
        registry.perform(actionId: nil)
    }

    func testAppActionInitializerMapsAllCatalogIdsToKnownCases() {
        let ids = [
            "home", "cards", "scan_pay", "reports", "rewards", "history", "open_search",
            "open_notifications", "open_plan_details", "check_balance", "pay_anyone", "add_money",
            "fastag", "generate_custom_upi", "copy_upi_id", "style_qr", "complete_kyc",
            "invite_reject", "invite_approve", "request_advance", "open_bharat_connect",
            "electricity_bill", "gas_bill", "mobile_recharge", "dth_recharge", "recharge_expired_plan",
            "view_all_bills", "download_claim_report", "view_approved_claims", "view_rejected_claims",
            "view_all_rewards", "open_brand_vouchers", "open_omnis", "open_cashback",
        ]
        for id in ids {
            XCTAssertTrue(AppAction(actionId: id).isKnown, "expected '\(id)' to map to a known AppAction case")
        }
        XCTAssertFalse(AppAction(actionId: "totally_made_up").isKnown)
    }
}
