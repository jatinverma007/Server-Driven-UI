"use client";

import { usePortal } from "@/components/editor/PortalProvider";
import { matchesAudience } from "@/lib/portal/audience";
import { resolveGradientCss } from "@/lib/portal/gradient";
import { Select } from "@/components/common/ui";
import {
  HeaderPreview,
  QuickActionsPreview,
  ActionCenterPreview,
  BannerCarouselPreview,
  RechargeBillsPreview,
  MonthlyClaimPreview,
  RewardsHubPreview,
  UnsupportedPreview,
} from "./PreviewComponents";

// Sorted narrowest → widest on purpose: the <Select> below renders these in
// insertion order, and that ordering doubles as the "small screen ... large
// screen" mental model for whoever's picking a device to stress-test against.
//
// Widths are each device's logical point width (Apple's published HIG
// device tables), not pixels — same unit the SwiftUI renderer lays out in.
// `iphone-14` was previously mislabeled at 375pt, which is actually the
// iPhone 6/7/8 and 12/13 mini width, not the 14's true 390pt — fixed here
// while expanding the set, since a wrong width defeats the point of using
// this picker to predict the native layout.
const DEVICE_WIDTHS: Record<string, { width: number; label: string }> = {
  "iphone-se": { width: 320, label: "iPhone SE (1st gen)" },
  "iphone-13-mini": { width: 375, label: "iPhone 13 mini" },
  "iphone-14": { width: 390, label: "iPhone 14" },
  "iphone-14-pro": { width: 393, label: "iPhone 14 Pro" },
  "iphone-14-plus": { width: 428, label: "iPhone 14 Plus" },
  "iphone-14-pro-max": { width: 430, label: "iPhone 14 Pro Max" },
  "iphone-16-pro-max": { width: 440, label: "iPhone 16 Pro Max" },
};

export function PhonePreview() {
  const p = usePortal();
  const screen = p.draft?.screens[0];
  const device = DEVICE_WIDTHS[p.previewDevice] ?? DEVICE_WIDTHS["iphone-14"]!;
  const dark = p.previewTheme === "dark";

  const bg = screen ? p.draft?.theme.tokens[screen.style.backgroundToken]?.[p.previewTheme] : "#fff";
  // The hero-band gradient (e.g. the red-to-white wash behind the header,
  // `HANDOVER--PAY` node 4908:2503) layered over `bg` — same precedence
  // and token resolution as the iOS `HomeScreenRenderer`/`ThemeResolver`:
  // an unresolvable token just falls back to the flat `bg` above.
  const heroGradient = screen ? resolveGradientCss(p.draft?.theme.gradients, p.draft?.theme.tokens ?? {}, screen.style.backgroundGradientToken, p.previewTheme) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2">
        <Select value={p.previewAudience} onChange={(e) => p.setPreviewAudience(e.target.value as "B2B" | "B2C")} className="!w-28">
          <option value="B2C">B2C view</option>
          <option value="B2B">B2B view</option>
        </Select>
        <Select value={p.previewTheme} onChange={(e) => p.setPreviewTheme(e.target.value as "light" | "dark")} className="!w-24">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </Select>
        <Select value={p.previewDevice} onChange={(e) => p.setPreviewDevice(e.target.value as typeof p.previewDevice)} className="!w-40">
          {Object.entries(DEVICE_WIDTHS).map(([id, d]) => (
            <option key={id} value={id}>
              {d.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-auto bg-slate-100 p-6">
        <div
          className="overflow-hidden rounded-[2.25rem] border-[10px] border-slate-900 shadow-2xl"
          style={{ width: device.width, backgroundColor: bg ?? "#fff" }}
        >
          <div className={`h-6 ${dark ? "bg-black" : "bg-white"}`} />
          <div
            className={`min-h-[600px] overflow-y-auto ${dark ? "text-white" : "text-slate-900"}`}
            style={{
              backgroundColor: bg ?? undefined,
              backgroundImage: heroGradient,
              backgroundRepeat: "no-repeat",
              // 355px matches the iOS `HomeScreenRenderer.heroGradientHeight`
              // band — the exact height of the gradient's own container in
              // the full-screen reference (`HANDOVER--PAY` node 5382:6295),
              // not an estimate. The gradient's own last stop already
              // resolves to `bg`, so painting it as a fixed-height top band
              // (rather than stretching it across the whole scroll height)
              // reads the same as the on-device renderer: a hero wash
              // behind the header that settles into the flat page
              // background.
              backgroundSize: heroGradient ? "100% 355px" : undefined,
            }}
          >
            {!screen && <p className="p-6 text-center text-sm text-slate-400">Loading…</p>}
            {screen?.components
              .filter((c) => c.enabled && matchesAudience(c.audience, { "user.type": p.previewAudience }))
              .map((c) => {
                switch (c.type) {
                  case "header":
                    return <HeaderPreview key={c.componentId} component={c} audience={p.previewAudience} />;
                  case "quickActions":
                    return <QuickActionsPreview key={c.componentId} component={c} />;
                  case "actionCenter":
                    return <ActionCenterPreview key={c.componentId} component={c} />;
                  case "bannerCarousel":
                    return <BannerCarouselPreview key={c.componentId} component={c} />;
                  case "rechargeBills":
                    return <RechargeBillsPreview key={c.componentId} component={c} />;
                  case "monthlyClaim":
                    return <MonthlyClaimPreview key={c.componentId} component={c} />;
                  case "rewardsHub":
                    return <RewardsHubPreview key={c.componentId} component={c} />;
                  default:
                    return <UnsupportedPreview key={c.componentId} component={c} />;
                }
              })}

            {screen && (
              <div className={`flex justify-around border-t ${dark ? "border-slate-700 bg-black" : "border-slate-200 bg-white"} px-1 py-2`}>
                {p.draft?.navigation.bottom
                  .filter((n) => matchesAudience(n.audience, { "user.type": p.previewAudience }))
                  .map((n) => (
                    <div key={n.id} className={`flex flex-col items-center gap-0.5 text-[9px] ${n.variant === "elevatedCenter" ? "-mt-4" : ""}`}>
                      <div
                        className={`flex items-center justify-center rounded-full ${
                          n.variant === "elevatedCenter" ? "h-11 w-11 bg-slate-900 text-white" : "h-6 w-6 bg-slate-200"
                        }`}
                      >
                        •
                      </div>
                      {n.variant !== "elevatedCenter" && <span>{n.label.kind === "literal" ? n.label.value : n.label.fallback}</span>}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="border-t border-slate-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] text-amber-700">
        Web approximation for editing convenience — the native iOS SwiftUI renderer is the final source of truth for layout, spacing, Dynamic Type and
        accessibility.
      </p>
    </div>
  );
}
