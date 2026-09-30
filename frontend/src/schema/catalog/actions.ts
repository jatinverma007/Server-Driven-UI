/**
 * The action allowlist. This IS the security boundary described in
 * docs/architecture-review.md §6: the server may only ever reference an
 * `actionId` from this list. `POST /publish` rejects anything else
 * (E_UNKNOWN_ACTION); iOS decodes `actionId` into a closed `AppAction` enum
 * with an `.unknown(String)` fallback that is logged and never invoked.
 *
 * Adding a new action requires an app release on iOS (the native closure it
 * maps to has to exist in the compiled binary) — that tradeoff is
 * intentional, not an oversight; see architecture-review.md §6.
 */
export interface ActionCatalogEntry {
  id: string;
  label: string;
  description: string;
  category: "navigation" | "payment" | "content" | "account" | "system";
}

export const ACTION_CATALOG: ActionCatalogEntry[] = [
  { id: "home", label: "Home tab", description: "Navigate to the Home tab.", category: "navigation" },
  { id: "cards", label: "My Cards tab", description: "Navigate to the My Cards tab.", category: "navigation" },
  { id: "scan_pay", label: "Scan & Pay", description: "Open the Scan & Pay flow.", category: "payment" },
  { id: "reports", label: "Reports tab", description: "Navigate to the Reports tab (B2B).", category: "navigation" },
  { id: "rewards", label: "Rewards tab", description: "Navigate to the Rewards tab (B2C).", category: "navigation" },
  { id: "history", label: "History tab", description: "Navigate to the History tab.", category: "navigation" },
  { id: "open_search", label: "Open search", description: "Open the global search screen.", category: "navigation" },
  { id: "open_notifications", label: "Open notifications", description: "Open the notification center.", category: "navigation" },
  { id: "open_plan_details", label: "Open plan details", description: "Open the current plan/upgrade screen.", category: "account" },
  { id: "check_balance", label: "Check balance", description: "Reveal the current balance (security-sensitive, native-gated).", category: "account" },
  { id: "pay_anyone", label: "Send money", description: "Open the send-money flow.", category: "payment" },
  { id: "add_money", label: "Add money", description: "Open the add-money flow.", category: "payment" },
  { id: "fastag", label: "FASTag", description: "Open the FASTag flow.", category: "payment" },
  { id: "generate_custom_upi", label: "Generate UPI ID", description: "Open the custom UPI ID generator.", category: "payment" },
  { id: "copy_upi_id", label: "Copy UPI ID", description: "Copy the user's UPI ID to the clipboard.", category: "account" },
  { id: "style_qr", label: "Style your QR", description: "Open the QR customization flow.", category: "account" },
  { id: "complete_kyc", label: "Complete KYC", description: "Open the KYC completion flow.", category: "account" },
  { id: "invite_reject", label: "Reject invite", description: "Reject a pending card-activation invite.", category: "account" },
  { id: "invite_approve", label: "Approve invite", description: "Approve a pending card-activation invite.", category: "account" },
  { id: "request_advance", label: "360° request", description: "Open the advance / add-expense request flow (B2B).", category: "payment" },
  { id: "open_bharat_connect", label: "Open Bharat Connect", description: "Open the Bharat Connect bill hub.", category: "payment" },
  { id: "electricity_bill", label: "Electricity bill", description: "Open the electricity bill payment flow.", category: "payment" },
  { id: "gas_bill", label: "Gas bill", description: "Open the piped-gas bill payment flow.", category: "payment" },
  { id: "mobile_recharge", label: "Mobile recharge", description: "Open the mobile recharge flow.", category: "payment" },
  { id: "dth_recharge", label: "DTH recharge", description: "Open the DTH recharge flow.", category: "payment" },
  { id: "recharge_expired_plan", label: "Recharge expired plan", description: "Open recharge for an expired plan.", category: "payment" },
  { id: "view_all_bills", label: "View all bills", description: "Open the full bills list.", category: "content" },
  { id: "download_claim_report", label: "Download claim report", description: "Download the monthly claim report (B2B).", category: "content" },
  { id: "view_approved_claims", label: "View approved claims", description: "Open the approved-claims list (B2B).", category: "content" },
  { id: "view_rejected_claims", label: "View rejected claims", description: "Open the rejected-claims list (B2B).", category: "content" },
  { id: "view_all_rewards", label: "View all rewards", description: "Open the full rewards list (B2C).", category: "content" },
  { id: "open_brand_vouchers", label: "Brand vouchers", description: "Open the brand vouchers screen (B2C).", category: "content" },
  { id: "open_omnis", label: "Omnis", description: "Open the Omnis rewards screen (B2C).", category: "content" },
  { id: "open_cashback", label: "Cashback", description: "Open the cashback screen (B2C).", category: "content" },
];

export const ACTION_IDS = new Set(ACTION_CATALOG.map((a) => a.id));
export function isKnownAction(id: string): boolean {
  return ACTION_IDS.has(id);
}
