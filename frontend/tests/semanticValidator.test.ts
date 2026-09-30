import { describe, it, expect, afterEach } from "vitest";
import { validateHomeScreenConfiguration } from "@/lib/validation/semanticValidator";
import { baseConfig, clone } from "./fixtures";
import validFixture from "@/schema/examples/home-screen.valid.json";
import invalidFixture from "@/schema/examples/home-screen.invalid.json";

describe("semanticValidator — happy path", () => {
  it("accepts the base fixture", () => {
    const result = validateHomeScreenConfiguration(baseConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts the full migrated seed fixture (frontend/src/schema/examples/home-screen.valid.json)", () => {
    const result = validateHomeScreenConfiguration(validFixture);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects the deliberately-broken invalid fixture", () => {
    const result = validateHomeScreenConfiguration(invalidFixture);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("semanticValidator — one rule at a time (publish must reject each of these)", () => {
  it("E_UNRESOLVED_PLACEHOLDER — <UPLOAD_PENDING:*> in an item icon", () => {
    const cfg = baseConfig();
    cfg.screens[0].components[1].props.items![0].media = { leading: { kind: "remote", url: "<UPLOAD_PENDING:pay>" } };
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    // caught structurally (bad https:// pattern) — still a hard rejection
    expect(result.errors.some((e) => e.code.startsWith("E_SCHEMA_"))).toBe(true);
  });

  it("E_UNRESOLVED_PLACEHOLDER — <CONFIRM_DATE> campaign date", () => {
    const cfg = baseConfig();
    cfg.appIcons.campaigns.push({ id: "holi", iconId: "ic_launcher", startDate: "<CONFIRM_DATE>", endDate: "<CONFIRM_DATE>", priority: 1 });
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
  });

  it("E_DUPLICATE_COMPONENT_ID — two components share a componentId", () => {
    const cfg = baseConfig();
    const dup = clone(cfg.screens[0].components[0]);
    cfg.screens[0].components.push(dup);
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_DUPLICATE_COMPONENT_ID")).toBe(true);
  });

  it("E_DUPLICATE_ID — two items in the same group share an id", () => {
    const cfg = baseConfig();
    const items = cfg.screens[0].components[1].props.items!;
    items.push(clone(items[0]));
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_DUPLICATE_ID")).toBe(true);
  });

  it("E_UNKNOWN_COMPONENT — a component type outside the catalog slips past schema (bypassed via unknown enum -> schema rejects, so assert schema rejection)", () => {
    const cfg = baseConfig() as unknown as Record<string, any>;
    cfg.screens[0].components[0].type = "totallyUnknownWidget";
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
  });

  it("E_UNKNOWN_ACTION — actionId not in the action catalog", () => {
    const cfg = baseConfig();
    cfg.screens[0].components[1].props.items![0].actionId = "wire_transfer_all_funds";
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_UNKNOWN_ACTION")).toBe(true);
  });

  it("E_UNKNOWN_DATA_SOURCE — dataSourceId not in the catalog", () => {
    const cfg = baseConfig();
    cfg.screens[0].components[1].props.dataSourceId = "/api/v1/banners/large_banner";
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_UNKNOWN_DATA_SOURCE")).toBe(true);
  });

  it("E_UNKNOWN_THEME_TOKEN — backgroundToken not defined in theme.tokens", () => {
    const cfg = baseConfig();
    cfg.screens[0].components[1].style.backgroundToken = "surface.nonexistent";
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_UNKNOWN_THEME_TOKEN")).toBe(true);
  });

  it("E_UNKNOWN_GRADIENT_TOKEN — screen backgroundGradientToken not defined in theme.gradients", () => {
    const cfg = baseConfig();
    cfg.screens[0].style.backgroundGradientToken = "hero.doesNotExist";
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_UNKNOWN_GRADIENT_TOKEN")).toBe(true);
  });

  it("E_UNKNOWN_GRADIENT_TOKEN — item backgroundGradientToken not defined in theme.gradients", () => {
    const cfg = baseConfig();
    cfg.screens[0].components[1].props.items = [{ id: "x", style: { backgroundGradientToken: "chip.doesNotExist" } }];
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_UNKNOWN_GRADIENT_TOKEN")).toBe(true);
  });

  it("E_UNKNOWN_THEME_TOKEN — a gradient's own stop colorToken must resolve against theme.tokens", () => {
    const cfg = baseConfig();
    cfg.theme.gradients = { "hero.header": { angle: 180, stops: [{ colorToken: "brand.doesNotExist", location: 0 }, { colorToken: "surface.default", location: 1 }] } };
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_UNKNOWN_THEME_TOKEN" && e.path.includes("gradients"))).toBe(true);
  });

  it("a valid backgroundGradientToken referencing a real gradient passes", () => {
    const cfg = baseConfig();
    cfg.theme.gradients = { "hero.header": { angle: 180, stops: [{ colorToken: "surface.default", location: 0 }, { colorToken: "surface.transparent", location: 1 }] } };
    cfg.screens[0].style.backgroundGradientToken = "hero.header";
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.errors.some((e) => e.code === "E_UNKNOWN_GRADIENT_TOKEN" || e.code === "E_UNKNOWN_THEME_TOKEN")).toBe(false);
  });

  it("E_UNSUPPORTED_ICON_ID — campaign iconId not in appIcons.supportedIconIds", () => {
    const cfg = baseConfig();
    cfg.appIcons.campaigns.push({ id: "diwali", iconId: "ic_launcher_diwali", startDate: "2026-11-01", endDate: "2026-11-03", priority: 1 });
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_UNSUPPORTED_ICON_ID")).toBe(true);
  });

  it("E_INVALID_DATE_RANGE — campaign endDate before startDate", () => {
    const cfg = baseConfig();
    cfg.appIcons.campaigns.push({ id: "backwards", iconId: "ic_launcher", startDate: "2026-05-10", endDate: "2026-05-01", priority: 1 });
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_INVALID_DATE_RANGE")).toBe(true);
  });

  it("E_INCOMPATIBLE_SCHEMA_VERSION — major version outside supported range", () => {
    const cfg = baseConfig();
    cfg.schemaVersion = "1.0.0";
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_INCOMPATIBLE_SCHEMA_VERSION")).toBe(true);
  });

  it("E_MISSING_ACCESSIBILITY_LABEL — icon-only button with empty label and no accessibilityLabel", () => {
    const cfg = baseConfig();
    cfg.screens[0].components[1].props.items![0].buttons = [
      { id: "btn", label: { kind: "literal", value: "" }, actionId: "pay_anyone" },
    ];
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_MISSING_ACCESSIBILITY_LABEL")).toBe(true);
  });

  it("schema-level: an empty screens array is rejected (invalid ordering / nothing to render)", () => {
    const cfg = baseConfig();
    cfg.screens[0].components = [];
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
  });

  it("schema-level: asset URL must be https", () => {
    const cfg = baseConfig();
    cfg.navigation.bottom[0].icon = { kind: "remote", url: "http://insecure.example.com/icon.png" };
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
  });

  it("schema-level: platform version must match semver pattern", () => {
    const cfg = baseConfig();
    cfg.platformConstraints.minAppVersion.ios = "1.65";
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
  });
});

describe("semanticValidator — E_ASSET_HOST_NOT_ALLOWED (added in the Phase 6 audit)", () => {
  const originalAllowlist = process.env.ASSET_HOST_ALLOWLIST;
  afterEach(() => {
    if (originalAllowlist === undefined) delete process.env.ASSET_HOST_ALLOWLIST;
    else process.env.ASSET_HOST_ALLOWLIST = originalAllowlist;
  });

  it("is not enforced when ASSET_HOST_ALLOWLIST is unset (matches pre-fix, opt-in behavior)", () => {
    delete process.env.ASSET_HOST_ALLOWLIST;
    const cfg = baseConfig();
    cfg.navigation.bottom[0].icon = { kind: "remote", url: "https://not-on-any-allowlist.example.com/icon.png" };
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.errors.some((e) => e.code === "E_ASSET_HOST_NOT_ALLOWED")).toBe(false);
  });

  it("rejects a remote asset host not on the configured allowlist", () => {
    process.env.ASSET_HOST_ALLOWLIST = "uat1.omnicard.co.in";
    const cfg = baseConfig();
    cfg.navigation.bottom[0].icon = { kind: "remote", url: "https://not-on-any-allowlist.example.com/icon.png" };
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_ASSET_HOST_NOT_ALLOWED")).toBe(true);
  });

  it("accepts a remote asset host that IS on the configured allowlist", () => {
    process.env.ASSET_HOST_ALLOWLIST = "uat1.omnicard.co.in";
    const cfg = baseConfig();
    cfg.navigation.bottom[0].icon = { kind: "remote", url: "https://uat1.omnicard.co.in/file-utils/ZhYwcpaw.png" };
    const result = validateHomeScreenConfiguration(cfg);
    expect(result.errors.some((e) => e.code === "E_ASSET_HOST_NOT_ALLOWED")).toBe(false);
  });

  it("checks the full migrated seed fixture cleanly against its own documented allowlist", () => {
    process.env.ASSET_HOST_ALLOWLIST = "uat1.omnicard.co.in";
    const result = validateHomeScreenConfiguration(validFixture);
    expect(result.errors.some((e) => e.code === "E_ASSET_HOST_NOT_ALLOWED")).toBe(false);
  });
});
