import Foundation

/// Dispatches a validated `AppAction` to a compiled-in closure. There is no
/// reflection, no dynamic selector lookup, and no code path that turns a
/// server-provided string directly into executed behavior — every branch is
/// a literal case in `AppAction`, decided at compile time
/// (docs/architecture-review.md §6, "unsafe action/API handling").
///
/// `.unknown` actions (and any action with no handler registered) are
/// logged and safely ignored — never a crash, never a fallback attempt to
/// "guess" what the server meant.
@MainActor
public final class ActionRegistry {
    public typealias Handler = () -> Void

    private var handlers: [AppAction: Handler] = [:]

    public init() {}

    public func register(_ action: AppAction, handler: @escaping Handler) {
        handlers[action] = handler
    }

    /// Entry point used by every tappable element in the renderer
    /// (buttons, item taps, nav bar taps, header icons). Always safe to
    /// call with an arbitrary, possibly-server-supplied string.
    public func perform(actionId: String?) {
        guard let actionId else { return }
        let action = AppAction(actionId: actionId)
        guard action.isKnown else {
            AppLogger.warning("Ignoring unknown actionId '\(actionId)'", category: .action)
            return
        }
        guard let handler = handlers[action] else {
            AppLogger.warning("No handler registered for known action '\(actionId)' — ignoring", category: .action)
            return
        }
        AppLogger.info("Performing action '\(actionId)'", category: .action)
        handler()
    }

    /// Registers no-op-but-visible-in-logs stand-ins for every catalog
    /// action this PoC doesn't implement a real destination for yet — so
    /// every button in the seeded configuration is tappable and traceable
    /// in the console, without pretending any of them navigate somewhere
    /// real. A production app would replace each with an actual
    /// coordinator/navigation call.
    public static func poc(logger: @escaping (String) -> Void = { AppLogger.info($0, category: .action) }) -> ActionRegistry {
        let registry = ActionRegistry()
        let allKnownIds = [
            "home", "cards", "scan_pay", "reports", "rewards", "history", "open_search",
            "open_notifications", "open_plan_details", "check_balance", "pay_anyone", "add_money",
            "fastag", "generate_custom_upi", "copy_upi_id", "style_qr", "complete_kyc",
            "invite_reject", "invite_approve", "request_advance", "open_bharat_connect",
            "electricity_bill", "gas_bill", "mobile_recharge", "dth_recharge", "recharge_expired_plan",
            "view_all_bills", "download_claim_report", "view_approved_claims", "view_rejected_claims",
            "view_all_rewards", "open_brand_vouchers", "open_omnis", "open_cashback",
        ]
        for id in allKnownIds {
            let action = AppAction(actionId: id)
            registry.register(action) { logger("[PoC] would navigate for action '\(id)'") }
        }
        return registry
    }
}
