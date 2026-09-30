import Foundation

/// Native-only mock balance formatting for the Quick Actions "Check
/// Balance" reveal toggle (see `QuickActionsComponentView`).
///
/// Deliberately NOT added to `MockUserProfile`/`BindingContext`: the
/// balance figure must never become reachable through a generic
/// schema-driven binding path the way `user.userName` or
/// `user.planName` are — `check_balance` is catalogued as
/// "security-sensitive, native-gated" in
/// `frontend/src/schema/catalog/actions.ts` precisely so the server can
/// ask the client to reveal a balance without ever being able to *send*
/// one. Keeping the figure here, looked up only by the same closed
/// `userType` string every audience rule already uses, and read from only
/// this one call site, preserves that boundary
/// (docs/architecture-review.md §6).
///
/// A production client replaces `mockAmountText` with an authenticated
/// native network call triggered from the same reveal toggle.
///
/// No decimal places: confirmed against the reveal state's actual Figma
/// reference (`HANDOVER--PAY` node 4928:14800, `p` node 4928:14814 —
/// "2,00,000", not "2,00,000.00"), which didn't exist yet when this was
/// first written — that's why it previously carried ".00" out of general
/// currency-formatting habit rather than a spec.
public enum BalanceDisplay {
    public static func mockAmountText(forUserType userType: String) -> String {
        switch userType {
        case "B2B": return "₹4,85,320"
        default: return "₹2,00,000"
        }
    }
}
