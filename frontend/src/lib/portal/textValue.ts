import type { TextValue, AssetRef } from "@/types/homeScreen";

/** Resolve a TextValue for the portal PREVIEW only (mock runtime data — the
 * same fixture iOS's bundled mock user model would use). This is display
 * logic, not a re-implementation of the client's binding resolver. */
export const MOCK_RUNTIME_DATA: Record<string, string> = {
  "user.userName": "Priya Nair",
  "user.enterpriseName": "Nair Textiles Pvt Ltd",
  "user.planName": "Gold",
  "data.invitedUserName": "Rahul Verma",
  "data.inviteMobileNo": "+91 90000 12345",
};

export function resolveText(t: TextValue | undefined): string {
  if (!t) return "";
  if (t.kind === "literal") return t.value;
  return MOCK_RUNTIME_DATA[t.path] ?? t.fallback;
}

/** Mirrors iOS's `BundledIconCatalog` (`ios-swiftui/.../DesignSystem/BundledIconCatalog.swift`)
 * — a small, deliberately narrow map from a `bundled` AssetRef name to a
 * locally-served demo image, for names that have since gotten real
 * artwork (served from `frontend/public/icons/`, same technique as
 * `MOCK_AVATAR_URL` below). Every `bundled` name NOT in this map still
 * renders the placeholder box exactly as before — this is additive only. */
const WEB_BUNDLED_ICON_OVERRIDES: Record<string, string> = {
  add_money: "/icons/add_money.png",
  // `rechargeBills`'s Bharat Connect topItem logo (Figma node 5382:7614,
  // exported artwork at node 4928:7595 — `Group 1171276188`) — the real
  // 27×29 badge, served at its 3x (81×87) export for crisp downscaling,
  // same technique as `add_money` above. Mirrors iOS's `bharat_connect`
  // asset-catalog image (`Resources/Assets.xcassets/bharat_connect.imageset`).
  bharat_connect: "/icons/bharat_connect.png",
  // `rechargeBills`'s `plan_expired_nudge` chip illustration (Figma node
  // 5382:7740/5382:7741, exported artwork at node 4928:7719's sibling
  // illustration layer — `image 126`) — the real 22×28 phone-recharge
  // illustration, served at its 3x (66×84) export. Mirrors iOS's
  // `wallet_alert` asset-catalog image.
  wallet_alert: "/icons/wallet_alert.png",
};

export function resolveAssetUrl(a: AssetRef | undefined): string | null {
  if (!a) return null;
  if (a.kind === "remote") return a.url;
  if (a.kind === "bundled") return WEB_BUNDLED_ICON_OVERRIDES[a.name] ?? null; // no real bundle in the portal — render a placeholder unless overridden above
  if (a.kind === "pending") return null;
  if (a.kind === "binding") return resolveAssetUrl(a.fallback);
  return null;
}

/** The portal preview's stand-in for a real session's avatar URL — same
 * role as `MockUserProfile`'s (currently absent) `user.profileImage`
 * override on iOS. `HeaderPreview` has no `assetURL`-style binding
 * resolution today (`MOCK_RUNTIME_DATA` only covers text), so this is
 * used directly rather than threaded through `resolveAssetUrl`. */
export const MOCK_AVATAR_URL = "/avatars/profile-demo.png";

export function literalText(value: string): TextValue {
  return { kind: "literal", value };
}
