import type { ColorPair, GradientValue } from "@/types/homeScreen";

/**
 * Resolves a `theme.gradients` entry to a CSS `linear-gradient()` string,
 * the same way the iOS `ThemeResolver.gradient` resolves it to a SwiftUI
 * `LinearGradient` — every stop is a `colorToken` looked up in
 * `theme.tokens` for the active light/dark mode, never a literal color
 * carried on the gradient itself. Returns `undefined` (never a fallback
 * gradient) when the token is unknown, has fewer than 2 stops, or any stop
 * references a `colorToken` that isn't in `tokens` — callers fall back to
 * a flat `backgroundToken` in that case, matching iOS.
 *
 * `angle` already uses the CSS `linear-gradient()` convention (see
 * `GradientValue` in `types/homeScreen.ts`), so it passes straight through
 * with no conversion — unlike the iOS side, which has to translate it into
 * SwiftUI's `UnitPoint` space.
 */
export function resolveGradientCss(
  gradients: Record<string, GradientValue> | undefined,
  tokens: Record<string, ColorPair>,
  token: string | undefined,
  mode: "light" | "dark"
): string | undefined {
  if (!token) return undefined;
  const spec = gradients?.[token];
  if (!spec || spec.stops.length < 2) return undefined;
  const stops: string[] = [];
  for (const stop of spec.stops) {
    const pair = tokens[stop.colorToken];
    if (!pair) return undefined; // an unresolvable stop makes the whole gradient unresolvable, same as iOS's per-stop `color(forToken:)` — never render a gradient with a missing/wrong stop
    stops.push(`${pair[mode]} ${Math.round(stop.location * 100)}%`);
  }
  return `linear-gradient(${spec.angle}deg, ${stops.join(", ")})`;
}

/** The fill (and optional border color) for an item's icon tile —
 * mirrors the iOS `ItemCell.tileFill`/`tileBackground` precedence exactly:
 * a resolvable gradient wins, then a flat `backgroundToken`, then no tile
 * at all (the item just isn't styled, same as before this feature). */
export function resolveTileStyle(
  itemStyle: { backgroundToken?: string; backgroundGradientToken?: string; borderToken?: string } | undefined,
  gradients: Record<string, GradientValue> | undefined,
  tokens: Record<string, ColorPair>,
  mode: "light" | "dark"
): { background?: string; borderColor?: string } {
  if (!itemStyle) return {};
  const gradientCss = resolveGradientCss(gradients, tokens, itemStyle.backgroundGradientToken, mode);
  const background = gradientCss ?? (itemStyle.backgroundToken ? tokens[itemStyle.backgroundToken]?.[mode] : undefined);
  const borderColor = itemStyle.borderToken ? tokens[itemStyle.borderToken]?.[mode] : undefined;
  return { background, borderColor };
}
