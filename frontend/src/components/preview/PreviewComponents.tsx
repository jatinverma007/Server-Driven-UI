"use client";

import { useState, type ReactNode } from "react";
import type { AssetRef, ButtonSpec, Component, ComponentItem, TextValue } from "@/types/homeScreen";
import { resolveText, resolveAssetUrl, MOCK_AVATAR_URL } from "@/lib/portal/textValue";
import { resolveTileStyle } from "@/lib/portal/gradient";
import { usePortal } from "@/components/editor/PortalProvider";

/** 56px @ 16px radius matches the icon-tile frames measured off Figma dev
 * mode (`HANDOVER--PAY` node 4908:2556) — the iOS `ItemCell` uses the same
 * two constants (`tileSize`/`DSRadius.card`) for the same reason. */
const TILE_SIZE = 56;
const TILE_RADIUS = 16;

/** Icon-tile shape — mirrors iOS `TileShape` (`ItemGridView.swift`):
 * native chrome, not schema-driven. `quickActions` tiles are
 * `rounded-[16px]`; `rechargeBills` tiles are fully circular (Figma node
 * 5382:7639 etc. — `rounded-[32px]` on a 56px frame). Colors/borders stay
 * schema-driven via `resolveTileStyle` exactly as before; only the corner
 * radius this shape implies is native. */
type TileShape = "rounded" | "circle";

/** A `bundled` icon whose override artwork (`WEB_BUNDLED_ICON_OVERRIDES`)
 * is a bare glyph with no tile chrome baked in — unlike `quickActions`'
 * *remote* icons (Send Money/Scan & Pay/FASTag), whose PNGs already have
 * Figma's peach gradient tile + `#FFD7B7` border pre-rendered into the
 * asset itself. `add_money` is still `<UPLOAD_PENDING:add_money>` in the
 * schema — no `item.style` for `resolveTileStyle` to draw a tile from —
 * so without this it rendered as a bare icon floating directly on the
 * section's white card, next to three siblings that all show a tile
 * (confirmed the same gap exists on iOS's real, Xcode-current
 * `add_money.imageset/add_money.png` — same bare glyph). Figma (node
 * 5382:7522) draws the exact same 56×56 `rounded-[16px]` gradient tile
 * behind it as every other `quickActions` icon.
 *
 * Mirrors iOS's `ItemGridView.NativeTileFallback` — same "known icon,
 * hardcoded Figma chrome" convention as `QuickActionsPreview`'s balance
 * ring / `style_qr_chip` border — keyed off the *bundled name*, not an
 * item id, so it also covers this icon anywhere else it's reused, and
 * stays a no-op for every other bundled glyph until they need the same
 * treatment. */
const NATIVE_TILE_FALLBACK: Record<string, { background: string; borderColor: string }> = {
  add_money: { background: "linear-gradient(133deg, #FFE8D7 2.15%, #FFEFE4 104.96%)", borderColor: "#FFD7B7" },
};

function ItemIcon({ item, size = TILE_SIZE, shape = "rounded" }: { item: ComponentItem; size?: number; shape?: TileShape }) {
  const p = usePortal();
  const url = resolveAssetUrl(item.media?.leading);
  const badgeUrl = resolveAssetUrl(item.media?.badge);
  const tile = resolveTileStyle(item.style, p.draft?.theme.gradients, p.draft?.theme.tokens ?? {}, p.previewTheme);
  const bundledName = item.media?.leading?.kind === "bundled" ? item.media.leading.name : undefined;
  const nativeTile = !tile.background && bundledName ? NATIVE_TILE_FALLBACK[bundledName] : undefined;
  const tileBackground = tile.background ?? nativeTile?.background;
  const tileBorderColor = tile.borderColor ?? nativeTile?.borderColor;
  const hasTile = Boolean(tileBackground);
  const radius = shape === "circle" ? size / 2 : TILE_RADIUS;
  // Mirrors iOS: a styled tile draws its glyph smaller and centered inside
  // the tile rather than stretched to fill it (Figma's own layers keep the
  // tile fill/border and the ~26px icon glyph separate).
  const glyphSize = hasTile ? Math.round(size * 0.57) : size;

  // `bundledGlyph` covers a `bundled` asset with a known stand-in (e.g.
  // `rechargeBills`'s Bharat Connect logo topItem, `bharat_connect` —
  // confirmed via live DOM inspection to render as a bare empty gray box
  // without this, the same gap `wallet_alert` had) — mirrors iOS's
  // `BundledIconCatalog`, which already resolves both names to real SF
  // Symbols. An unrecognized bundled name, or any other unresolved
  // reference, still falls through to the original neutral placeholder.
  const bundled = bundledGlyph(item.media?.leading);
  const glyph = url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={glyphSize} height={glyphSize} className={hasTile ? "object-contain" : "rounded-lg object-cover"} style={{ width: glyphSize, height: glyphSize }} />
  ) : bundled ? (
    <div className="flex items-center justify-center" style={{ width: glyphSize, height: glyphSize, fontSize: Math.round(glyphSize * 0.6) }}>
      {bundled}
    </div>
  ) : (
    <div
      className={`flex items-center justify-center text-[10px] text-slate-400 ${hasTile ? "" : "rounded-lg bg-slate-200"}`}
      style={{ width: glyphSize, height: glyphSize }}
      title={item.media?.leading ? JSON.stringify(item.media.leading) : "no icon"}
    >
      {item.media?.leading?.kind === "pending" ? "⏳" : "▢"}
    </div>
  );

  // `rechargeBills`' `electricity` item is this preview's one real
  // `media.badge` consumer (Figma `HANDOVER--PAY` node 4908:3211 — a small
  // "New" pill overlapping the tile's top-left corner), mirroring iOS
  // `ItemCell`'s `.topLeading`-anchored badge.
  // Figma (`HANDOVER--PAY` node 5382:7658, confirmed via full
  // `get_design_context` on node 5382:7608) draws this "New" badge as a
  // 29×11 wide pill sitting at `left-[15px] top-[-5px]` within the 56×56
  // tile — not a square glyph pinned to the corner — so it's sized/placed
  // to match exactly rather than forced into a square (which would crop
  // a wide pill image down to its center) at the tile's actual corner.
  const badge = badgeUrl && (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={badgeUrl} alt="" className="absolute h-[11px] w-[29px] object-contain" style={{ left: 15, top: -5 }} />
  );

  if (!hasTile) {
    return badge ? (
      <div className="relative" style={{ width: size, height: size }}>
        {glyph}
        {badge}
      </div>
    ) : (
      glyph
    );
  }

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: radius, background: tileBackground, border: tileBorderColor ? `1px solid ${tileBorderColor}` : undefined }}
    >
      {glyph}
      {badge}
    </div>
  );
}

function GridItems({ items, columns, tileShape = "rounded" }: { items: ComponentItem[]; columns: number; tileShape?: TileShape }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
      {items.map((item) => (
        <div key={item.id} className="flex flex-col items-center gap-1 text-center">
          <ItemIcon item={item} shape={tileShape} />
          <span className="line-clamp-2 text-[11px] leading-tight">{resolveText(item.label)}</span>
        </div>
      ))}
    </div>
  );
}

/// A schema-styled pill for a `topItems`/`bottomItems` entry — the portal
/// equivalent of iOS's `QuickActionsComponentView.chip`. `item.style`
/// (background/border tokens) resolves through the exact same
/// `resolveTileStyle` used for icon tiles; an item with no `style` keeps a
/// neutral gray placeholder fill so it still renders instead of going
/// invisible. `check_balance` used to share this via a `doubleRing` mode,
/// but that always resolved to the same gray placeholder (its seed JSON
/// has no `style` object) — it's now its own `CheckBalanceAccessory`
/// component above, hardcoded to the real Figma ring colors.
function StyledChip({
  item,
  iconSize = 16,
  radius = 999,
  variant = "chip",
}: {
  item: ComponentItem;
  iconSize?: number;
  radius?: number;
  /// "chip": the existing pill treatment (gray/tinted background,
  /// optional border) — unchanged default, still what `rechargeBills`'s
  /// Bharat Connect icon uses.
  /// "link": plain text.link-colored text+icon with no background/border
  /// at all — `monthlyClaim`'s "Download report" (Figma node 5382:7189)
  /// is a text link, not a chip; forcing it through the pill treatment
  /// was rendering a gray badge Figma doesn't show.
  variant?: "chip" | "link";
}) {
  const p = usePortal();
  const tile = resolveTileStyle(item.style, p.draft?.theme.gradients, p.draft?.theme.tokens ?? {}, p.previewTheme);
  const label = resolveText(item.label);
  const linkColor = p.draft?.theme.tokens["text.link"]?.[p.previewTheme] ?? "#336DFF";
  const inner = (
    <>
      <ItemIcon item={item} size={iconSize} />
      {label && <span>{label}</span>}
    </>
  );

  if (variant === "link") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium" style={{ color: linkColor }}>
        {inner}
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[10px] text-slate-700"
      style={{ borderRadius: radius, background: tile.background ?? "#f1f5f9", border: tile.borderColor ? `1px solid ${tile.borderColor}` : undefined }}
    >
      {inner}
    </span>
  );
}

/// Preview-only mock amounts for the `check_balance` reveal toggle below —
/// mirrors iOS's `BalanceDisplay.mockAmountText(forUserType:)` exactly
/// (same figures, same no-decimals format). Kept here rather than in
/// `textValue.ts`'s `MOCK_RUNTIME_DATA`: `check_balance` is catalogued
/// "security-sensitive, native-gated" in `schema/catalog/actions.ts` on
/// purpose, so this stays a display-only stand-in read from exactly one
/// call site, never a generic binding any other component could reach.
const MOCK_BALANCE_TEXT: Record<"B2B" | "B2C", string> = {
  B2B: "₹4,85,320",
  B2C: "₹2,00,000",
};

/// Small inline icon set for the `check_balance` accessory below — eye,
/// eye-slash, and a clockwise refresh arrow — standing in for iOS's SF
/// Symbols (`eye`, `eye.slash`, `arrow.clockwise`) the same way
/// `BottomChip`'s `style_qr_chip` case already draws its own glyph inline
/// rather than shipping a Figma-exported asset for a simple line icon.
function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeSlashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.24 4.24" />
      <path d="M9.9 4.24A11 11 0 0 1 12 4c7 0 11 7 11 7a13.4 13.4 0 0 1-3.4 4.3M6.1 6.1A13.4 13.4 0 0 0 1 11s4 7 11 7a11 11 0 0 0 3.4-.56" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

/// Both states of `quickActions`' `check_balance` topItem share one ring
/// shape: a `#FFEADA`-filled, `#F47C20`-bordered outer capsule with 2px
/// padding around an inner white capsule — confirmed against BOTH Figma
/// references (hidden, node 5382:7487, label-then-eye-icon; revealed,
/// node 4928:14800, amount + eye-slash icon, plus a *separate* circular
/// refresh button 8px to the right in the same ring colors — Figma draws
/// these as two independent elements, not one combined pill). Hardcoded
/// straight from those specs rather than `item.style`/`StyledChip`'s
/// `doubleRing` path: `check_balance`'s seed JSON carries no `style`
/// object, so that path was silently falling back to its generic
/// `#f1f5f9`-no-border placeholder — same "known chip, hardcoded Figma
/// colors" convention `BottomChip` already uses for its three cases.
/// Mirrors iOS's `QuickActionsComponentView.balanceAccessory`, including
/// its local, preview-only reveal toggle (`useState`, never persisted to
/// `draft`) and mock amount.
function CheckBalanceAccessory({ item }: { item: ComponentItem }) {
  const p = usePortal();
  const [revealed, setRevealed] = useState(false);
  const label = resolveText(item.label);
  const ringStyle = { background: "#FFEADA", border: "1px solid #F47C20" };

  if (revealed) {
    return (
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full p-[2px]" style={ringStyle}>
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1.5 text-[10px] font-semibold text-[#1C1C1C]"
        >
          {MOCK_BALANCE_TEXT[p.previewAudience]}
          <EyeSlashIcon />
        </button>
        <button
          type="button"
          onClick={() => {}}
          aria-label="Refresh balance"
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[#F47C20]"
        >
          <RefreshIcon />
        </button>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => setRevealed(true)} className="inline-flex shrink-0 items-center gap-2 rounded-full p-[2px]" style={ringStyle}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1.5 text-[10px] font-semibold text-[#1C1C1C]">
        {/* Figma orders label-then-icon here (node 5382:7489), the reverse
            of every other icon+label chip in this file — kept as-is rather
            than normalized, since swapping it would drift from the one
            reference that actually specifies this exact badge. */}
        {label && <span>{label}</span>}
        <EyeIcon />
      </span>
    </button>
  );
}

/// A `topItems[0]` accessory (Figma: `HANDOVER--PAY` node 4908:4290) —
/// icon-only when the item has no label (e.g. `rechargeBills`'s Bharat
/// Connect entry), icon+label pill otherwise (e.g. `quickActions`'s
/// "Check Balance", `rewardsHub`'s "View more"), or a plain text link for
/// `monthlyClaim`'s "Download report" (`variant="link"`, node 5382:7189 —
/// see `StyledChip`'s doc comment). Mirrors the iOS
/// `QuickActionsComponentView.topAccessory` convention so the portal
/// preview and the on-device renderer agree on where this content goes.
function TopAccessory({ item, variant = "chip" }: { item: ComponentItem; variant?: "chip" | "link" }) {
  if (item.actionId === "check_balance") {
    return <CheckBalanceAccessory item={item} />;
  }
  // `rechargeBills`' Bharat Connect logo (Figma node 5382:7614) renders at
  // ~27×29 — bigger than every other icon-only topItem this shares a
  // component with — so it gets its own size the same way `check_balance`
  // used to share `doubleRing` here (now its own component above).
  const iconSize = item.actionId === "open_bharat_connect" ? 27 : variant === "link" ? 14 : 16;
  return <StyledChip item={item} iconSize={iconSize} radius={999} variant={variant} />;
}

/// The shared "title on the left, optional `topItems[0]` accessory on the
/// right" row used by `quickActions`, `rechargeBills`, `monthlyClaim`, and
/// `rewardsHub` — the same title-row convention every one of those types
/// uses in the schema (`docs/component-catalog.md`'s item-group
/// semantics), so this is one place to get it right instead of four
/// near-duplicate `flex justify-between` blocks.
function TitleRow({
  title,
  topItem,
  topItemVariant = "chip",
  titleColor,
  marginBottom = 8,
}: {
  title?: TextValue;
  topItem?: ComponentItem;
  topItemVariant?: "chip" | "link";
  /// Overrides the default muted `text-slate-500` title color. Only
  /// `monthlyClaim` passes this today — its title is `text.primary`
  /// (near-black) in Figma, not the shared gray every other section
  /// title uses (see `MonthlyClaimPreview`). Left `undefined`, the
  /// existing Tailwind class applies exactly as before.
  titleColor?: string;
  /// Gap (px) to the content below. Defaults to 8 (the original `mb-2`).
  /// `rechargeBills` passes 16 — Figma (node 5382:7610) specs a 16px gap
  /// here specifically, wider than the 8px every other user of this row
  /// keeps, so this is opt-in per caller rather than a shared default
  /// change that would also shift `quickActions`/`monthlyClaim`/
  /// `rewardsHub` without a Figma reference confirming they want that too.
  marginBottom?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2" style={{ marginBottom }}>
      <span className={`text-xs font-semibold ${titleColor ? "" : "text-slate-500"}`} style={titleColor ? { color: titleColor } : undefined}>
        {resolveText(title)}
      </span>
      {topItem && <TopAccessory item={topItem} variant={topItemVariant} />}
    </div>
  );
}

/// The white, `rounded-[24px]` card behind `quickActions`/`rechargeBills`
/// (Figma node 5382:7481/5382:7608 — both `bg-white rounded-[24px]`, inset
/// 16px from the screen edge). Not every component gets this: `monthlyClaim`
/// (node 5382:7183) has no section-level card, only per-item ones — so this
/// is opted into per component, mirroring iOS's `DSRadius.sectionCard` use
/// in `QuickActionsComponentView`/`RechargeBillsComponentView` specifically,
/// not a renderer-wide default.
function SectionCard({ children, shadow = "single" }: { children: ReactNode; shadow?: "single" | "double" }) {
  const p = usePortal();
  const bg = p.draft?.theme.tokens["surface.default"]?.[p.previewTheme] ?? "#fff";
  // `quickActions` (node 5382:7481) specs a single bottom shadow;
  // `rechargeBills` (node 5382:7608) specs two — one above, one below
  // (`0px_-1px_1px` + `0px_1px_1px`) — mirrors the two `.shadow()` calls
  // on iOS's `RechargeBillsComponentView`. CSS `box-shadow` takes a
  // comma-separated list directly, no stacking trick needed like SwiftUI.
  const boxShadow = shadow === "double" ? "0 -1px 1px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.15)" : "0 1px 1px rgba(0,0,0,0.15)";
  return (
    <div className="mx-4 my-3 rounded-[24px] p-4" style={{ backgroundColor: bg, boxShadow }}>
      {children}
    </div>
  );
}

export function HeaderPreview({ component, audience }: { component: Component; audience: "B2B" | "B2C" }) {
  const sub = component.props.subDetails?.variants.find((v) => {
    const val = v.audience.all?.[0]?.value;
    const first = Array.isArray(val) ? val[0] : val;
    return first === audience;
  });
  return (
    <div className="flex items-center gap-3 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MOCK_AVATAR_URL} alt="" className="h-11 w-11 shrink-0 rounded-full bg-slate-300 object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{"Priya Nair"}</div>
        {sub && <div className="truncate text-xs text-slate-500">{resolveText(sub.valueBinding)}</div>}
      </div>
      <div className="flex gap-3 text-lg">
        <span>🔍</span>
        <span className="relative">
          🔔{(component.props.rightActions?.[1]?.badgeCountField ?? null) && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />}
        </span>
      </div>
    </div>
  );
}

/// Three fixed, Figma-exact `quickActions` bottom chips (Figma
/// `HANDOVER--PAY` nodes 4908:2621 "Generate UPI ID", 5503:3143 "UPI ID: …"
/// chip, 5503:3156 "Style Your QR") — mirrors iOS's
/// `QuickActionsComponentView.bottomChip(for:)` exactly: each one visually
/// distinct (solid red CTA, neutral bordered chip, accent-bordered chip)
/// instead of the one shared `StyledChip` pill every bottom item rendered
/// as before. Text and colors are hardcoded, keyed off `item.id` — not
/// schema-driven for this round. `upi_id_chip`'s trailing (copy) icon has
/// no slot in the shared `ComponentItem` media model (only `leading`), so
/// both icon URLs are inlined here as literals straight from this round's
/// icon JSON, same as on iOS. An id this doesn't recognize falls back to
/// the original generic `StyledChip` so any other `bottomItems` entry
/// (e.g. `rechargeBills`, which reuses `StyledChip` directly, untouched)
/// keeps rendering exactly as before.
function BottomChip({ item }: { item: ComponentItem }) {
  const upiIcon = "https://uat1.omnicard.co.in/file-utils/tyk9QhPN.png";
  const copyIcon = "https://uat1.omnicard.co.in/file-utils/stebR2y1.png";

  if (item.id === "generate_upi_prompt") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-[8px] bg-[#E44239] px-2 py-1.5 text-[10px] font-semibold text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={upiIcon} alt="" width={14} height={14} />
        Generate UPI ID
      </span>
    );
  }
  if (item.id === "upi_id_chip") {
    // Figma node 5503:3143 lays the leading icon+text group and the
    // trailing copy icon out with `justify-between` across a 142px-wide
    // inner row — the copy icon sits at the row's right edge, not 4px
    // from the text like the other icon gaps. `min-w-[142px]` +
    // `justify-between` on the inner row reproduces that (min, not fixed,
    // width: the browser's default sans-serif is wider than Acumin Pro
    // for this exact string, so a hard 142px would wrap it — same
    // `whitespace-nowrap` fix as `GenerateUpiIdRow`'s button, same
    // reason).
    return (
      <span className="inline-flex shrink-0 items-center rounded-[12px] bg-[#F9FAFB] px-3 py-2" style={{ border: "1px solid #DEDEDE" }}>
        <span className="inline-flex min-w-[142px] items-center justify-between gap-1 text-[10px] font-medium text-[#1C1C1C]">
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={upiIcon} alt="" width={12} height={12} />
            UPI ID: 812849586@omni
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={copyIcon} alt="" width={12} height={12} className="shrink-0" />
        </span>
      </span>
    );
  }
  if (item.id === "style_qr_chip") {
    // This border (Figma node 5503:3156) isn't the flat `#7877ED` it
    // first looks like — Figma's dev-mode code export flattens a
    // gradient stroke to a single representative CSS `border-color`,
    // which is what came back for this node. The actual screenshot shows
    // the ring cycling purple → teal → pink and back to purple around the
    // full perimeter. There's no bound Figma variable for it
    // (get_variable_defs returns nothing for this node) and no tool here
    // exposes the literal stroke paint, so this reproduces it by eye from
    // that screenshot — mirrors iOS's `styleQRBorderGradient`
    // (`AngularGradient`) — rather than the flat color: closest available
    // approximation, not a pixel-exact match. A plain CSS `border` can't
    // take a gradient, so this uses the standard two-layer background
    // trick: a transparent border reserves the ring's width, an opaque
    // `padding-box` layer paints the `#FFF6EF` fill, and a `border-box`
    // conic-gradient layer shows through only in that reserved ring.
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-[12px] px-3 py-2 text-[10px] font-medium text-[#1C1C1C]"
        style={{
          border: "1px solid transparent",
          backgroundImage: "linear-gradient(#FFF6EF, #FFF6EF), conic-gradient(from 0deg, #7877ED, #5EEAD4, #F472B6, #7877ED)",
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#7877ED" strokeWidth="1.3">
          <rect x="1" y="1" width="5" height="5" rx="1" />
          <rect x="10" y="1" width="5" height="5" rx="1" />
          <rect x="1" y="10" width="5" height="5" rx="1" />
          <rect x="10" y="10" width="5" height="5" rx="1" />
        </svg>
        Style Your QR
      </span>
    );
  }
  // Unknown id — original generic pill, unchanged.
  return <StyledChip item={item} iconSize={14} radius={12} />;
}

/// Figma `HANDOVER--PAY` node 4908:2621 ("Frame 1171277480") — the complete
/// Generate UPI ID view: one `#F9FAFB`-filled, `#DEDEDE`-bordered,
/// 12px-rounded row holding the current UPI ID (leading icon + 12px
/// `#1C1C1C` text) on the left and the "Generate UPI ID" button (fixed
/// 92px wide, `#E44239` fill, 10px semibold white text) on the right —
/// replacing the two separate stacked chips this used to render for
/// `generate_upi_prompt`/`upi_id_chip`. Mirrors iOS's
/// `generateUpiIdRow(generateItem:upiItem:)` exactly; every value here is
/// hardcoded straight from the Figma spec (node 4908:2622-4908:2635), only
/// the icon URL comes from this round's icon JSON, same as `BottomChip`.
function GenerateUpiIdRow({ generateItem, upiItem }: { generateItem: ComponentItem; upiItem: ComponentItem }) {
  const upiIcon = "https://uat1.omnicard.co.in/file-utils/tyk9QhPN.png";
  return (
    <div className="flex w-full items-center justify-between gap-2 rounded-[12px] bg-[#F9FAFB] p-2" style={{ border: "1px solid #DEDEDE" }}>
      <span data-item-id={upiItem.id} className="inline-flex min-w-0 shrink items-center gap-2 text-[12px] font-medium text-[#1C1C1C]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={upiIcon} alt="" width={12} height={12} className="shrink-0" />
        <span className="truncate">UPI ID: 812849586@omni</span>
      </span>
      {/* Figma specs a fixed 92px button (node 4908:2632) with the text on
          one line — that's Acumin Pro's metrics, not the browser's default
          sans-serif, which wraps this 16-character string inside 92px. A
          two-line button reads as more broken than a few extra px of
          width, so this sizes to content (`whitespace-nowrap`, no fixed
          width) — mirrors iOS's `fixedSize` fix for the same reason. */}
      <span
        data-item-id={generateItem.id}
        className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] bg-[#E44239] px-2 py-1.5 text-[10px] font-semibold text-white"
      >
        Generate UPI ID
      </span>
    </div>
  );
}

export function QuickActionsPreview({ component }: { component: Component }) {
  const cols = component.layout?.columns ?? 4;
  const bottom = component.props.bottomItems ?? [];
  const generateItem = bottom.find((it) => it.id === "generate_upi_prompt");
  const upiItem = bottom.find((it) => it.id === "upi_id_chip");
  // Figma has two designs for this section and no schema condition yet to
  // choose between them: node 4928:14877 (= node 4908:2621, same design)
  // is a single combined row — the existing UPI ID plus a "Generate UPI
  // ID" button — and nodes 5503:3143 + 5503:3156 together are
  // `upi_id_chip` and `style_qr_chip` standing on their own, no button.
  // Per the current instruction, both render at once until the real
  // condition exists: the combined row on top (when both its ids are
  // present) and every bottom item *except* `generate_upi_prompt` again
  // below it as its own standalone chip via `BottomChip` — `upi_id_chip`
  // deliberately appears in both places. `generate_upi_prompt` is left out
  // of the standalone row because it has no design of its own outside the
  // combined one. Swap `showCombinedRow`'s condition for the real
  // show/hide rule once one exists; nothing else here should need to
  // change.
  const showCombinedRow = Boolean(generateItem && upiItem);
  const standaloneItems = bottom.filter((it) => it.id !== "generate_upi_prompt");
  return (
    <SectionCard>
      <TitleRow title={component.props.title} topItem={component.props.topItems?.[0]} />
      <GridItems items={component.props.items ?? []} columns={cols} />
      {(showCombinedRow || standaloneItems.length > 0) && (
        <div className="mt-3 flex flex-col gap-2">
          {showCombinedRow && generateItem && upiItem && <GenerateUpiIdRow generateItem={generateItem} upiItem={upiItem} />}
          {standaloneItems.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {standaloneItems.map((it) => (
                <BottomChip key={it.id} item={it} />
              ))}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/** Stand-in glyphs for `bundled` icon names this preview's seeded data
 * actually uses (`kyc`, `quick_request`, `user_avatar_placeholder`,
 * `invite_reject`, `invite_approve`, plus `rechargeBills`' own
 * `wallet_alert` for `plan_expired_nudge`) — mirrors iOS's
 * `BundledIconCatalog` SF Symbol table for the same names, since none of
 * them has a real uploaded asset (or a `WEB_BUNDLED_ICON_OVERRIDES` entry)
 * yet. Any other bundled name still falls back to `ItemIcon`'s existing
 * "no icon" placeholder — this is additive only. Not Action-Center-
 * specific despite the name history: `RechargeBottomChip` uses it too. */
const BUNDLED_GLYPH_FALLBACK: Record<string, string> = {
  kyc: "🪪",
  quick_request: "⚡",
  user_avatar_placeholder: "🧑",
  invite_reject: "✕",
  invite_approve: "✓",
  arrow_right: "→",
  arrow: "→",
  wallet_alert: "📱",
  bharat_connect: "🏦",
  // `quickActions`' `check_balance` topItem (bundled name `balance`) — the
  // same gap `wallet_alert`/`bharat_connect` had: no `WEB_BUNDLED_ICON_OVERRIDES`
  // entry, so it rendered as the bare hollow-square placeholder instead of
  // an icon. Mirrors iOS's `BundledIconCatalog`, which already maps this
  // name to the `eye` SF Symbol.
  balance: "👁",
};

function bundledGlyph(ref?: AssetRef): string | null {
  return ref?.kind === "bundled" ? (BUNDLED_GLYPH_FALLBACK[ref.name] ?? null) : null;
}

/** The one color driving a themed Action Center card's left stripe, icon
 * ring, and (for the critical/accent theme) its meta text — mirrors iOS's
 * `ActionCenterCard.accentColor` exactly, including which themes get a
 * real color TOKEN vs. a hardcoded approximation; see that doc comment
 * for why. Keyed off the same `style.backgroundToken` the card's own fill
 * already reads. */
function actionCenterAccentColor(tokens: Record<string, { light: string; dark: string }>, theme: "light" | "dark", backgroundToken?: string): string {
  switch (backgroundToken) {
    case "surface.accent":
      return tokens["status.critical.text"]?.[theme] ?? "#E44239";
    case "surface.info":
      return "#356FFF";
    case "surface.warning":
      return "#F2994A";
    case "surface.success":
      return tokens["status.success.text"]?.[theme] ?? "#17A24E";
    default:
      return tokens["surface.border"]?.[theme] ?? "#DEDEDE";
  }
}

/** Mirrors iOS's `ActionButtonView` exactly: `variant` (`solid` default)
 * picks filled-vs-outline, `role` (`primary` default) picks the color.
 * `success`/`critical` resolve through real theme tokens (so they stay
 * live-editable in the Themes panel); `neutral` has no matching token yet.
 * `primary` — an unstyled button, e.g. `request_advance_cta` — has no
 * single correct color of its own: Figma's two reference buttons for this
 * exact gap (`complete_kyc_cta`, node 4908:2651, `#3D6BE4`;
 * `request_advance_cta`'s own button, node 5382:6452, `#E44239`) each
 * match their *own card's* accent instead of sharing one brand blue, so
 * `defaultColor` (the card's own `actionCenterAccentColor`) is threaded in
 * from `ActionCenterCard` rather than hardcoded here. */
function ActionCenterButton({ button, defaultColor }: { button: ButtonSpec; defaultColor: string }) {
  const p = usePortal();
  const tokens = p.draft?.theme.tokens ?? {};
  const theme = p.previewTheme;
  const label = resolveText(button.label);
  const iconUrl = resolveAssetUrl(button.icon);
  const glyph = bundledGlyph(button.icon);
  const variant = button.buttonStyle?.variant ?? "solid";
  const role = button.buttonStyle?.role ?? "primary";
  const roleColor =
    role === "success"
      ? (tokens["status.success.text"]?.[theme] ?? "#17A24E")
      : role === "critical"
        ? (tokens["status.critical.text"]?.[theme] ?? "#E44239")
        : role === "neutral"
          ? "#6B7280"
          : defaultColor;
  const outline = variant === "outline" || variant === "ghost";
  const icon = iconUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={iconUrl} alt="" width={14} height={14} />
  ) : glyph ? (
    <span style={{ fontSize: 12, lineHeight: 1 }}>{glyph}</span>
  ) : null;

  return (
    <span
      // Figma's Action Center buttons (nodes 4908:2651 "Complete KYC" —
      // `rounded-[8px]`, 5382:6452 the arrow-only button — `rounded-[4px]`)
      // are rectangles, both sharing the same `py-[4px]` vertical padding —
      // an icon-only button (empty `label`, e.g. `request_advance_cta`)
      // gets tighter horizontal padding and the smaller radius to match
      // the near-square button Figma shows for it, mirroring iOS.
      className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold ${label ? "rounded-[8px] px-3" : "rounded-[4px] px-2.5"} py-1`}
      style={{
        background: outline ? "transparent" : roleColor,
        color: outline ? roleColor : "#fff",
        border: outline ? `1px solid ${roleColor}` : undefined,
        opacity: outline ? 1 : 0.9,
      }}
    >
      {button.iconPosition !== "end" && icon}
      {label && <span>{label}</span>}
      {button.iconPosition === "end" && icon}
    </span>
  );
}

/// Figma's actual reference for this card (`HANDOVER--PAY` node 4908:2642
/// "Complete your KYC" *and* 5382:6439 "360° Request" — both literally
/// named `KycStrip` in the file, i.e. the same reusable component) is a
/// **68px-tall horizontal strip**: icon on the left, title/subtitle-or-meta
/// stacked in the middle, one or more buttons trailing — not the taller
/// vertical, icon-on-top card this used to render. The strip hugs its own
/// content width rather than a fixed `w-60` (both reference nodes render at
/// different widths — 321px and 361px respectively), so this is `w-fit` in
/// a `flex` row instead. Mirrors iOS `ActionCenterCard`'s own rewrite.
function ActionCenterCard({ item }: { item: ComponentItem }) {
  const p = usePortal();
  const tokens = p.draft?.theme.tokens ?? {};
  const theme = p.previewTheme;
  const label = resolveText(item.label);
  const subtitle = item.subtitle ? resolveText(item.subtitle) : "";
  const meta = item.meta ? resolveText(item.meta) : "";
  const bg = tokens[item.style?.backgroundToken ?? "surface.default"]?.[theme] ?? "#fff";
  const accent = actionCenterAccentColor(tokens, theme, item.style?.backgroundToken);
  const iconUrl = resolveAssetUrl(item.media?.leading);
  const glyph = bundledGlyph(item.media?.leading);

  return (
    <div
      className="flex w-fit shrink-0 items-center gap-2.5 rounded-[16px] py-[11px] pl-[15px] pr-3"
      style={{ backgroundColor: bg, borderLeft: `3px solid ${accent}`, boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: accent }}>
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" width={18} height={18} />
        ) : glyph ? (
          <span style={{ fontSize: 16, lineHeight: 1 }}>{glyph}</span>
        ) : (
          <div className="h-[18px] w-[18px] rounded-full bg-slate-200" />
        )}
      </div>
      {/* Figma's own text column (the "Container" frame, node 4908:2646)
          is a fixed 121px wide, which is exactly why "Update your details
          to keep your account active & compliant." breaks into the two
          lines node 4908:2650 shows ("...keep your" / "account active &
          compliant.") instead of running on as one line — without a width
          constraint here this flex row just grows to fit the whole
          sentence on one line since nothing else in the row bounds it.
          180px (vs. Figma's 121px) accounts for this preview's larger
          fonts — 13px bold title vs. Figma's 11.5px, 10px body vs.
          Figma's 8px — needing more room to keep the *title* on one line
          the way Figma's does, while still narrow enough that the long
          subtitle still wraps to two. This is a fixed `w-[180px]` (not
          `max-w-`) plus `shrink-0`: `line-clamp-2`'s `-webkit-box` display
          reports an unhelpful intrinsic size to the flex layout, so a mere
          `max-width` still let this column get squeezed down to ~111px by
          its siblings instead of actually using the room it's capped at. */}
      <div className="flex w-[180px] shrink-0 flex-col gap-0.5">
        {label && (
          <div className="line-clamp-2 text-[13px] font-bold" style={{ color: tokens["text.primary"]?.[theme] ?? "#1D1B18" }}>
            {label}
          </div>
        )}
        {subtitle && <div className="line-clamp-2 text-[10px] text-slate-500">{subtitle}</div>}
        {meta && (
          <div className="whitespace-nowrap text-[10px] font-semibold" style={{ color: accent }}>
            {meta}
          </div>
        )}
      </div>
      {item.buttons && item.buttons.length > 0 && (
        <div className="flex shrink-0 gap-2 pl-2">
          {item.buttons.map((b) => (
            <ActionCenterButton key={b.id} button={b} defaultColor={accent} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ActionCenterPreview({ component }: { component: Component }) {
  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3">
      {(component.props.items ?? []).map((item) => (
        <ActionCenterCard key={item.id} item={item} />
      ))}
    </div>
  );
}

export function BannerCarouselPreview({ component }: { component: Component }) {
  return (
    <div className="px-4 py-2">
      <div className="flex h-24 items-center justify-center rounded-xl bg-gradient-to-r from-slate-200 to-slate-300 text-xs text-slate-500">
        banners from dataSourceId=&quot;{component.props.dataSourceId}&quot;
      </div>
    </div>
  );
}

/// Both `bottomItems` share the same `chip.upi.*` background/border
/// tokens in the seed data, but Figma (node 5382:7608, confirmed via full
/// `get_design_context`) gives them two different content treatments:
/// `plan_expired_nudge` is gray-text (`#727272`, no matching token) with
/// a *trailing* phone illustration (node 5382:7740/5382:7741, confirmed
/// against the real exported artwork at node 4928:7719's sibling
/// illustration layer — a genuinely tall 22×28 image, not a square glyph,
/// and positioned AFTER the text, not before it); `view_more` is bold
/// brand-red text with a trailing
/// arrow, sized to its own ~94px minimum width. Mirrors iOS
/// `RechargeBillsComponentView.bottomChip(_:)` — `id` switches the
/// layout, `style` tokens still drive the pill's own background/border
/// color.
function RechargeBottomChip({ item }: { item: ComponentItem }) {
  const p = usePortal();
  const tile = resolveTileStyle(item.style, p.draft?.theme.gradients, p.draft?.theme.tokens ?? {}, p.previewTheme);
  const label = resolveText(item.label);
  const pillStyle = { borderRadius: 8, background: tile.background ?? "#f1f5f9", border: tile.borderColor ? `1px solid ${tile.borderColor}` : undefined };

  if (item.id === "view_more") {
    const brandPrimary = p.draft?.theme.tokens["brand.primary"]?.[p.previewTheme] ?? "#E44239";
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap px-3 py-1.5 text-[10px] font-bold"
        style={{ ...pillStyle, minWidth: 94, color: brandPrimary }}
      >
        {label}
        <ItemIcon item={item} size={12} />
      </span>
    );
  }

  // `plan_expired_nudge`'s icon (`wallet_alert`) is a `bundled` asset in
  // the seeded data, not a `remote` URL — `resolveAssetUrl` only resolves
  // the latter, so without this fallback the icon silently didn't render
  // at all (confirmed via live DOM inspection: the chip's `<span>` had
  // zero children). `bundledGlyph` covers the gap the same way
  // `ActionCenterCard`/`ActionCenterButton` already do for their own
  // bundled icons.
  const iconUrl = resolveAssetUrl(item.media?.leading);
  const glyph = bundledGlyph(item.media?.leading);
  return (
    <span className="inline-flex shrink-0 items-center gap-3 whitespace-nowrap py-1.5 pl-3 pr-2 text-[12px]" style={{ ...pillStyle, color: "#727272" }}>
      {label}
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt="" className="h-[28px] w-[22px] object-contain" />
      ) : (
        glyph && <span style={{ fontSize: 16, lineHeight: 1 }}>{glyph}</span>
      )}
    </span>
  );
}

export function RechargeBillsPreview({ component }: { component: Component }) {
  const cols = component.layout?.columns ?? 4;
  return (
    <SectionCard shadow="double">
      <TitleRow title={component.props.title} topItem={component.props.topItems?.[0]} marginBottom={16} />
      <GridItems items={component.props.items ?? []} columns={cols} tileShape="circle" />
      {component.props.bottomItems && component.props.bottomItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {component.props.bottomItems.map((it) => (
            <RechargeBottomChip key={it.id} item={it} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/// Per-item status card (Figma `HANDOVER--PAY` node 5382:7195 "Approved" /
/// node 5382:7223 "Rejected") — `monthlyClaim` has no section-level card
/// (see `SectionCard`'s doc comment), only these smaller per-item ones,
/// mirroring iOS's `ClaimCard` (`MonthlyClaimComponentView.swift`). The
/// badge copy/color/checkmark are keyed off the item's own `id`
/// ("approved"/"rejected"), the same native-not-schema call as iOS's
/// `ClaimStatus` enum. Amount/count are hardcoded representative preview
/// values — the portal preview has no live data-source fetch, unlike the
/// on-device renderer's `DataSourceRegistry`, so these mirror the mock
/// endpoint's own values (`/api/v1/mock-data/claims/monthly-summary`)
/// rather than being invented separately.
const CLAIM_STATUS: Record<
  string,
  {
    accentToken: string;
    // `status.critical.text`/`.background` (like `status.success.*`) aren't
    // actually present in the theme's `tokens` map — same as the iOS bundle
    // JSON. `ClaimCard` used to pass one hardcoded fallback ("#17A24E" /
    // "#E6F9EE", the *approved* colors) to `token()` for both statuses, so
    // a rejected card with no real token silently rendered green instead of
    // red/pink — the on-device renderer never had this bug because
    // `ThemeResolver`'s `fallbackHex:` is supplied per status, per call
    // (`MonthlyClaimComponentView.swift`'s `accentColor`/`badge`). These
    // per-status fallback fields mirror that.
    accentFallback: string;
    badgeBgToken: string;
    badgeBgFallback: string;
    badgeLabel: string;
    checkmark: boolean;
    amount: string;
    count: string;
  }
> = {
  approved: {
    accentToken: "status.success.text",
    accentFallback: "#17A24E",
    badgeBgToken: "status.success.background",
    badgeBgFallback: "#E6F9EE",
    badgeLabel: "Cleared",
    checkmark: true,
    amount: "42,500",
    count: "9 claims",
  },
  rejected: {
    accentToken: "status.critical.text",
    accentFallback: "#E44239",
    badgeBgToken: "status.critical.background",
    badgeBgFallback: "#FFEBEA",
    badgeLabel: "Action needed",
    checkmark: false,
    amount: "3,200",
    count: "9 claims",
  },
};

function ClaimCard({ item }: { item: ComponentItem }) {
  const p = usePortal();
  const status = CLAIM_STATUS[item.id];
  const token = (id: string, fallback: string) => p.draft?.theme.tokens[id]?.[p.previewTheme] ?? fallback;
  if (!status) return null;
  const accent = token(status.accentToken, status.accentFallback);
  const badgeBg = token(status.badgeBgToken, status.badgeBgFallback);
  const border = token("surface.border", "#DEDEDE");
  const link = token("text.link", "#336DFF");
  return (
    <div className="flex flex-1 flex-col items-center gap-2 rounded-xl bg-white px-4 py-3 text-center" style={{ border: `1px solid ${border}` }}>
      <div className="flex w-full flex-col items-center gap-2 border-b border-[#e8e8e8] pb-2">
        <div className="flex items-center gap-1">
          <span className="h-px w-5" style={{ backgroundColor: accent, opacity: 0.5 }} />
          <span className="text-xs font-semibold" style={{ color: accent }}>
            {resolveText(item.label)}
          </span>
          <span className="h-px w-5" style={{ backgroundColor: accent, opacity: 0.5 }} />
        </div>
        <div className="text-base font-bold text-[#0a0a0a]">₹{status.amount}</div>
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-slate-500">{status.count}</span>
          <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px]" style={{ backgroundColor: badgeBg, color: accent }}>
            {status.badgeLabel}
            {status.checkmark && <span>✓</span>}
          </span>
        </div>
      </div>
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium" style={{ color: link }}>
        View Details →
      </span>
    </div>
  );
}

export function MonthlyClaimPreview({ component }: { component: Component }) {
  const p = usePortal();
  // Figma node 5382:7188 — the title is `text-[#0a0a0a]`, the app's
  // near-black `text.primary` token, not the shared muted gray every
  // other section title (`TitleRow`'s default) uses.
  const titleColor = p.draft?.theme.tokens["text.primary"]?.[p.previewTheme] ?? "#0a0a0a";
  return (
    <div className="px-4 py-3">
      <TitleRow title={component.props.title} topItem={component.props.topItems?.[0]} topItemVariant="link" titleColor={titleColor} />
      <div className="flex gap-3">
        {(component.props.items ?? []).map((item) => (
          <ClaimCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export function RewardsHubPreview({ component }: { component: Component }) {
  // Node 4908:4064 ("Offers & More") is the exact same recipe as
  // `RechargeBillsPreview` — white double-shadow `SectionCard`, circular
  // tiles — confirmed in Dev Mode. `columns` defaults to 4, not the 3 real
  // items: Figma reserves a 4th, invisible tile (node 4908:4118,
  // `opacity-0`) purely so 3 items still land at the same column
  // positions as `quickActions`' 4-column grid above it. An unfilled 4th
  // CSS grid track already renders as blank space, so this reproduces that
  // reserved-slot spacing for free.
  const cols = component.layout?.columns ?? 4;
  return (
    <SectionCard shadow="double">
      <TitleRow title={component.props.title} topItem={component.props.topItems?.[0]} />
      <GridItems items={component.props.items ?? []} columns={cols} tileShape="circle" />
    </SectionCard>
  );
}

export function UnsupportedPreview({ component }: { component: Component }) {
  return (
    <div className="mx-4 my-2 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-3 text-xs text-amber-700">
      Unrecognized component type &quot;{component.type}&quot; — iOS renders nothing here in RELEASE builds (a debug placeholder in DEBUG). This is the
      graceful-degradation path, not an error.
    </div>
  );
}
