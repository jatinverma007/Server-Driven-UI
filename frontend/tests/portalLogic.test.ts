import { describe, it, expect } from "vitest";
import { matchesAudience } from "@/lib/portal/audience";
import { resolveText, resolveAssetUrl } from "@/lib/portal/textValue";
import { resolveGradientCss, resolveTileStyle } from "@/lib/portal/gradient";
import validFixture from "@/schema/examples/home-screen.valid.json";
import type { HomeScreenConfiguration } from "@/types/homeScreen";

describe("portal audience matching (mirrors the backend/iOS AudienceRule semantics)", () => {
  it("absent rule matches everyone", () => {
    expect(matchesAudience(undefined, { "user.type": "B2B" })).toBe(true);
    expect(matchesAudience(undefined, { "user.type": "B2C" })).toBe(true);
  });

  it("`all` with `in` restricts to the listed audience", () => {
    const rule = { all: [{ field: "user.type" as const, operator: "in" as const, value: ["B2B"] }] };
    expect(matchesAudience(rule, { "user.type": "B2B" })).toBe(true);
    expect(matchesAudience(rule, { "user.type": "B2C" })).toBe(false);
  });

  it("`none` excludes the listed audience", () => {
    const rule = { none: [{ field: "user.type" as const, operator: "in" as const, value: ["B2C"] }] };
    expect(matchesAudience(rule, { "user.type": "B2B" })).toBe(true);
    expect(matchesAudience(rule, { "user.type": "B2C" })).toBe(false);
  });
});

describe("portal TextValue/AssetRef resolution (preview-only, mock runtime data)", () => {
  it("resolves a literal as-is", () => {
    expect(resolveText({ kind: "literal", value: "Hello" })).toBe("Hello");
  });

  it("resolves a known binding path from mock data", () => {
    expect(resolveText({ kind: "binding", path: "user.userName", fallback: "User" })).toBe("Priya Nair");
  });

  it("falls back for an unknown binding path", () => {
    expect(resolveText({ kind: "binding", path: "user.unknownField", fallback: "Fallback" })).toBe("Fallback");
  });

  it("resolves a remote AssetRef to its URL and a bundled/pending one to null (preview placeholder)", () => {
    expect(resolveAssetUrl({ kind: "remote", url: "https://example.com/a.png" })).toBe("https://example.com/a.png");
    expect(resolveAssetUrl({ kind: "bundled", name: "icon" })).toBeNull();
    expect(resolveAssetUrl({ kind: "pending", ref: "icon" })).toBeNull();
  });
});

describe("portal gradient resolution (mirrors the iOS ThemeResolver.gradient precedence)", () => {
  const tokens = {
    "brand.primary": { light: "#E44239", dark: "#E44239" },
    "surface.default": { light: "#FFFFFF", dark: "#1D1B18" },
  };
  const gradients = {
    "hero.header": { angle: 180, stops: [{ colorToken: "brand.primary", location: 0.25 }, { colorToken: "surface.default", location: 0.86 }] },
  };

  it("resolves a known gradient token to a CSS linear-gradient string, per light/dark mode", () => {
    expect(resolveGradientCss(gradients, tokens, "hero.header", "light")).toBe("linear-gradient(180deg, #E44239 25%, #FFFFFF 86%)");
    expect(resolveGradientCss(gradients, tokens, "hero.header", "dark")).toBe("linear-gradient(180deg, #E44239 25%, #1D1B18 86%)");
  });

  it("returns undefined (never a fallback gradient) for an unknown token", () => {
    expect(resolveGradientCss(gradients, tokens, "hero.doesNotExist", "light")).toBeUndefined();
    expect(resolveGradientCss(gradients, tokens, undefined, "light")).toBeUndefined();
  });

  it("returns undefined when a stop's colorToken doesn't resolve", () => {
    const broken = { broken: { angle: 180, stops: [{ colorToken: "brand.doesNotExist", location: 0 }, { colorToken: "surface.default", location: 1 }] } };
    expect(resolveGradientCss(broken, tokens, "broken", "light")).toBeUndefined();
  });

  it("resolveTileStyle prefers a resolvable gradient over a flat backgroundToken", () => {
    const style = { backgroundToken: "surface.default", backgroundGradientToken: "hero.header", borderToken: "brand.primary" };
    const result = resolveTileStyle(style, gradients, tokens, "light");
    expect(result.background).toBe("linear-gradient(180deg, #E44239 25%, #FFFFFF 86%)");
    expect(result.borderColor).toBe("#E44239");
  });

  it("resolveTileStyle falls back to the flat backgroundToken when the gradient token is unresolvable", () => {
    const style = { backgroundToken: "surface.default", backgroundGradientToken: "hero.doesNotExist" };
    expect(resolveTileStyle(style, gradients, tokens, "light").background).toBe("#FFFFFF");
  });

  it("resolveTileStyle returns nothing for an item with no style at all", () => {
    expect(resolveTileStyle(undefined, gradients, tokens, "light")).toEqual({});
  });
});

describe("seed fixture's hero gradient matches the Figma reference exactly (HANDOVER--PAY node 5382:6295)", () => {
  const cfg = validFixture as unknown as HomeScreenConfiguration;
  const seedTokens = cfg.theme.tokens;
  const seedGradients = cfg.theme.gradients ?? {};

  it("resolves to the exact 4-stop CSS Figma's dev-mode export gives for the hero band", () => {
    // Figma: linear-gradient(180deg, rgb(228,66,57) 0%, rgb(228,66,57)
    // 27.404%, rgb(243,174,170) 65.865%, rgb(255,255,255) 85.096%) — a flat
    // red band that only starts fading around a quarter of the way down,
    // through an intermediate salmon tone, to white. Not the naive 2-stop
    // red-to-white approximation seeded before this was checked against
    // the full-screen reference.
    expect(resolveGradientCss(seedGradients, seedTokens, "hero.header", "light")).toBe(
      "linear-gradient(180deg, #E44239 0%, #E44239 27%, #F3AEAA 66%, #FFFFFF 85%)"
    );
  });

  it("every seeded chip/hero token pair has both a light and a dark value", () => {
    for (const [name, pair] of Object.entries(seedTokens)) {
      expect(pair.light, `${name}.light`).toBeTruthy();
      expect(pair.dark, `${name}.dark`).toBeTruthy();
    }
  });
});
