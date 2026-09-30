import Foundation

/// The closed action catalog, mirroring `ACTION_CATALOG` in
/// `frontend/src/schema/catalog/actions.ts` id-for-id. This is the core
/// security boundary described in docs/architecture-review.md §6: the
/// backend can only ever reference one of these 34 ids by string; there is
/// no URL, selector, or arbitrary payload the server can send that causes
/// iOS to do something this enum doesn't already name. Adding a new action
/// requires a native code change and an app release — see
/// `ActionRegistry.swift`.
///
/// An id this build doesn't recognize (a newer server catalog talking to an
/// older client, within the same schema major) decodes to `.unknown` rather
/// than throwing — `ActionRegistry.perform` logs and no-ops for it instead
/// of crashing or, worse, attempting to interpret it as a URL or selector.
public enum AppAction: Equatable, Hashable, Sendable {
    case home, cards, scanPay, reports, rewards, history
    case openSearch, openNotifications, openPlanDetails, checkBalance
    case payAnyone, addMoney, fastag, generateCustomUpi, copyUpiId, styleQr, completeKyc
    case inviteReject, inviteApprove
    case requestAdvance
    case openBharatConnect, electricityBill, gasBill, mobileRecharge, dthRecharge, rechargeExpiredPlan
    case viewAllBills, downloadClaimReport, viewApprovedClaims, viewRejectedClaims
    case viewAllRewards, openBrandVouchers, openOmnis, openCashback
    case unknown(String)

    private static let byId: [String: AppAction] = [
        "home": .home, "cards": .cards, "scan_pay": .scanPay, "reports": .reports,
        "rewards": .rewards, "history": .history, "open_search": .openSearch,
        "open_notifications": .openNotifications, "open_plan_details": .openPlanDetails,
        "check_balance": .checkBalance, "pay_anyone": .payAnyone, "add_money": .addMoney,
        "fastag": .fastag, "generate_custom_upi": .generateCustomUpi, "copy_upi_id": .copyUpiId,
        "style_qr": .styleQr, "complete_kyc": .completeKyc, "invite_reject": .inviteReject,
        "invite_approve": .inviteApprove, "request_advance": .requestAdvance,
        "open_bharat_connect": .openBharatConnect, "electricity_bill": .electricityBill,
        "gas_bill": .gasBill, "mobile_recharge": .mobileRecharge, "dth_recharge": .dthRecharge,
        "recharge_expired_plan": .rechargeExpiredPlan, "view_all_bills": .viewAllBills,
        "download_claim_report": .downloadClaimReport, "view_approved_claims": .viewApprovedClaims,
        "view_rejected_claims": .viewRejectedClaims, "view_all_rewards": .viewAllRewards,
        "open_brand_vouchers": .openBrandVouchers, "open_omnis": .openOmnis, "open_cashback": .openCashback,
    ]

    public init(actionId: String) {
        self = Self.byId[actionId] ?? .unknown(actionId)
    }

    public var isKnown: Bool {
        if case .unknown = self { return false }
        return true
    }
}
