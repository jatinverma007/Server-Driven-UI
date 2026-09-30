import XCTest
@testable import DynamicUIAppCore

final class BalanceDisplayTests: XCTestCase {
    func testB2BGetsTheB2BMockAmount() {
        XCTAssertEqual(BalanceDisplay.mockAmountText(forUserType: "B2B"), "₹4,85,320")
    }

    func testB2CGetsTheB2CMockAmount() {
        XCTAssertEqual(BalanceDisplay.mockAmountText(forUserType: "B2C"), "₹2,00,000")
    }

    /// An unrecognized userType (a future audience the client hasn't seen
    /// yet) falls back to the B2C figure rather than crashing or
    /// returning an empty string — same "never trust the server string,
    /// always have a safe default" posture as `AppAction.unknown`.
    func testUnknownUserTypeFallsBackToTheDefaultAmount() {
        XCTAssertEqual(BalanceDisplay.mockAmountText(forUserType: "some_future_segment"), "₹2,00,000")
    }
}
