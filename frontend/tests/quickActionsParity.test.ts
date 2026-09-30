import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import frontendFixture from "@/schema/examples/home-screen.valid.json";

type QuickActionItem = {
  id: string;
  label?: { kind: "literal"; value: string };
  actionId?: string;
  media?: { leading?: { kind: string; url?: string; name?: string }; trailing?: { kind: string; url?: string; name?: string } };
};

function quickActions(configuration: typeof frontendFixture) {
  const component = configuration.screens[0]?.components.find((candidate) => candidate.componentId === "quick_actions");
  if (!component || component.type !== "quickActions") throw new Error("Quick Actions component is missing");
  return component;
}

function actionCenter(configuration: typeof frontendFixture) {
  const component = configuration.screens[0]?.components.find((candidate) => candidate.componentId === "action_center");
  if (!component || component.type !== "actionCenter") throw new Error("Action Center component is missing");
  return component;
}

function largeBanner(configuration: typeof frontendFixture) {
  const component = configuration.screens[0]?.components.find((candidate) => candidate.componentId === "large_banner");
  if (!component || component.type !== "bannerCarousel") throw new Error("Large banner component is missing");
  return component;
}

function rechargeBills(configuration: typeof frontendFixture) {
  const component = configuration.screens[0]?.components.find((candidate) => candidate.componentId === "recharge_bills");
  if (!component || component.type !== "rechargeBills") throw new Error("Recharge & Bills component is missing");
  return component;
}

function smallBanner(configuration: typeof frontendFixture) {
  const component = configuration.screens[0]?.components.find((candidate) => candidate.componentId === "small_banner");
  if (!component || component.type !== "bannerCarousel") throw new Error("Small Banner component is missing");
  return component;
}

function contract(items: QuickActionItem[] | undefined) {
  return (items ?? []).map(({ id, label, actionId, media }) => ({ id, label, actionId, media }));
}

describe("Quick Actions frontend/iOS configuration parity", () => {
  const iosFixturePath = path.resolve(process.cwd(), "..", "ios-swiftui", "Fixtures", "home-screen.valid.json");
  const iosFixture = JSON.parse(readFileSync(iosFixturePath, "utf8")) as typeof frontendFixture;
  const frontendQuickActions = quickActions(frontendFixture);
  const iosQuickActions = quickActions(iosFixture);

  it("keeps the source-defined widget metadata and 4-column fixed layout", () => {
    expect(frontendQuickActions.type).toBe("quickActions");
    expect(frontendQuickActions.props.title).toEqual({ kind: "literal", value: "Quick Actions" });
    expect(frontendQuickActions.style.backgroundToken).toBe("surface.default");
    expect(frontendQuickActions.layout).toMatchObject({ orientation: "horizontal", viewType: "fixed", columns: 4 });
  });

  it("preserves top, main, and bottom section order, labels, media, and action IDs on iOS", () => {
    for (const section of ["topItems", "items", "bottomItems"] as const) {
      expect(contract(frontendQuickActions.props[section] as QuickActionItem[] | undefined)).toEqual(
        contract(iosQuickActions.props[section] as QuickActionItem[] | undefined)
      );
    }
  });

  it("keeps the three source-defined sections intact", () => {
    expect(contract(frontendQuickActions.props.topItems as QuickActionItem[] | undefined).map((item) => item.id)).toEqual(["check_balance"]);
    expect(contract(frontendQuickActions.props.items as QuickActionItem[] | undefined).map((item) => item.id)).toEqual(["pay_anyone", "scan_pay", "add_money", "fastag"]);
    expect(contract(frontendQuickActions.props.bottomItems as QuickActionItem[] | undefined).map((item) => item.id)).toEqual(["generate_upi_prompt", "upi_id_chip", "style_qr_chip"]);
  });
});

describe("Action Center frontend/iOS configuration parity", () => {
  const iosFixturePath = path.resolve(process.cwd(), "..", "ios-swiftui", "Fixtures", "home-screen.valid.json");
  const iosFixture = JSON.parse(readFileSync(iosFixturePath, "utf8")) as typeof frontendFixture;
  const frontendActionCenter = actionCenter(frontendFixture);
  const iosActionCenter = actionCenter(iosFixture);

  it("keeps the Figma strip layout and configured items in sync", () => {
    expect(frontendActionCenter.layout).toMatchObject({ orientation: "horizontal", viewType: "scroll", itemSizing: "fillViewport" });
    expect(frontendActionCenter.props.items).toEqual(iosActionCenter.props.items);
  });

  it("uses literal development placeholders until the Action Center API is implemented", () => {
    const invite = frontendActionCenter.props.items?.find((item) => item.id === "invite");
    expect(invite?.label).toEqual({ kind: "literal", value: "Ananya Sharma" });
    expect(invite?.meta).toEqual({ kind: "literal", value: "+91 98765 43210" });
    expect(invite?.dataSourceId).toBeUndefined();
  });

  it("defines the KYC strip colors and primary CTA through the configuration", () => {
    const kyc = frontendActionCenter.props.items?.find((item) => item.id === "complete_kyc");
    expect(kyc?.style).toEqual({ backgroundToken: "actioncenter.kyc.background", borderToken: "actioncenter.kyc.border" });
    expect(kyc?.buttons?.[0]?.buttonStyle).toEqual({ variant: "solid", role: "primary" });
  });
});

describe("Large Banner frontend/iOS configuration parity", () => {
  const iosFixturePath = path.resolve(process.cwd(), "..", "ios-swiftui", "Fixtures", "home-screen.valid.json");
  const iosFixture = JSON.parse(readFileSync(iosFixturePath, "utf8")) as typeof frontendFixture;
  const frontendLargeBanner = largeBanner(frontendFixture);
  const iosLargeBanner = largeBanner(iosFixture);

  it("keeps the Figma 340×112 static banner payload identical on both clients", () => {
    expect(frontendLargeBanner.layout).toMatchObject({ orientation: "horizontal", viewType: "scroll", itemSizing: "fillViewport" });
    expect(frontendLargeBanner.props.items).toEqual(iosLargeBanner.props.items);
  });

  it("ships three local banners until the future data source is connected", () => {
    const banners = frontendLargeBanner.props.items;
    expect(frontendLargeBanner.props.dataSourceId).toBeUndefined();
    expect(banners?.map(({ id, actionId, media }) => ({ id, actionId, asset: media?.leading }))).toEqual([
      { id: "fastag_recharge", actionId: "fastag", asset: { kind: "bundled", name: "banner_fastag" } },
      { id: "rewards_offer", actionId: "open_omnis", asset: { kind: "bundled", name: "banner_rewards" } },
      { id: "recharge_reminder", actionId: "mobile_recharge", asset: { kind: "bundled", name: "banner_recharge" } },
    ]);
  });
});

describe("Recharge & Bills frontend/iOS configuration parity", () => {
  const iosFixturePath = path.resolve(process.cwd(), "..", "ios-swiftui", "Fixtures", "home-screen.valid.json");
  const iosFixture = JSON.parse(readFileSync(iosFixturePath, "utf8")) as typeof frontendFixture;
  const frontendRechargeBills = rechargeBills(frontendFixture);
  const iosRechargeBills = rechargeBills(iosFixture);

  it("keeps the fixed four-column widget, section order, and action IDs in sync", () => {
    expect(frontendRechargeBills.layout).toMatchObject({ orientation: "horizontal", viewType: "fixed", columns: 4 });
    expect(contract(frontendRechargeBills.props.topItems as QuickActionItem[] | undefined)).toEqual(
      contract(iosRechargeBills.props.topItems as QuickActionItem[] | undefined)
    );
    expect(contract(frontendRechargeBills.props.items as QuickActionItem[] | undefined)).toEqual(
      contract(iosRechargeBills.props.items as QuickActionItem[] | undefined)
    );
    expect(contract(frontendRechargeBills.props.bottomItems as QuickActionItem[] | undefined)).toEqual(
      contract(iosRechargeBills.props.bottomItems as QuickActionItem[] | undefined)
    );
  });

  it("preserves the optional electricity badge and the two distinct bottom controls", () => {
    const electricity = frontendRechargeBills.props.items?.find((item) => item.id === "electricity");
    expect(electricity?.media?.badge).toEqual({ kind: "remote", url: "https://uat1.omnicard.co.in/file-utils/RBeK1AJK.png" });
    expect(frontendRechargeBills.props.bottomItems?.map(({ id, actionId }) => ({ id, actionId }))).toEqual([
      { id: "plan_expired_nudge", actionId: "recharge_expired_plan" },
      { id: "view_more", actionId: "view_all_bills" },
    ]);
  });
});

describe("Small Banner frontend/iOS configuration parity", () => {
  const iosFixturePath = path.resolve(process.cwd(), "..", "ios-swiftui", "Fixtures", "home-screen.valid.json");
  const iosFixture = JSON.parse(readFileSync(iosFixturePath, "utf8")) as typeof frontendFixture;
  const frontendSmallBanner = smallBanner(frontendFixture);
  const iosSmallBanner = smallBanner(iosFixture);

  it("keeps the transparent, horizontally scrolling API-backed slot aligned", () => {
    expect(frontendSmallBanner.style.backgroundToken).toBe("surface.transparent");
    expect(frontendSmallBanner.layout).toMatchObject({ orientation: "horizontal", viewType: "scroll", itemSizing: "fillViewport" });
    expect(frontendSmallBanner.props.dataSourceId).toBe("banners.small");
    expect(frontendSmallBanner.props).toEqual(iosSmallBanner.props);
  });
});
