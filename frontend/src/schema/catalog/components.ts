/**
 * The component registry catalog — the closed set of native component types
 * a published configuration may reference (docs/architecture-review.md §11,
 * "do not create a fully generic arbitrary layout engine"). This drives:
 *  - the JSON Schema `Component.type` enum (kept in sync by hand — see
 *    tests/schema.contract.test.ts),
 *  - the portal's "add component" picker,
 *  - the iOS `ComponentRegistry` (same ids, Swift-side).
 */
import type { ComponentType } from "@/types/homeScreen";

export interface ComponentCatalogEntry {
  type: ComponentType;
  label: string;
  description: string;
  currentVersion: number;
  minVersion: number;
  supportsAudience: boolean;
  supportsDataSource: boolean;
  supportsLayout: boolean;
  itemGroups: Array<"topItems" | "items" | "bottomItems">;
}

export const COMPONENT_CATALOG: ComponentCatalogEntry[] = [
  {
    type: "header",
    label: "Header",
    description: "Top-of-screen identity bar: avatar, name, right-side action icons, and an audience-scoped sub-detail line.",
    currentVersion: 1,
    minVersion: 1,
    supportsAudience: false,
    supportsDataSource: false,
    supportsLayout: false,
    itemGroups: [],
  },
  {
    type: "quickActions",
    label: "Quick Actions",
    description: "A fixed grid of frequent actions, with an optional single-row banner above and chip row below.",
    currentVersion: 1,
    minVersion: 1,
    supportsAudience: true,
    supportsDataSource: false,
    supportsLayout: true,
    itemGroups: ["topItems", "items", "bottomItems"],
  },
  {
    type: "actionCenter",
    label: "Action Center",
    description: "A horizontally scrolling row of dismissible/actionable cards; individual cards may be data-bound.",
    currentVersion: 1,
    minVersion: 1,
    supportsAudience: true,
    supportsDataSource: false,
    supportsLayout: true,
    itemGroups: ["items"],
  },
  {
    type: "bannerCarousel",
    label: "Banner Carousel",
    description: "A horizontal banner carousel with configured static items or a future data source.",
    currentVersion: 1,
    minVersion: 1,
    supportsAudience: true,
    supportsDataSource: true,
    supportsLayout: true,
    itemGroups: ["items"],
  },
  {
    type: "rechargeBills",
    label: "Recharge & Bills",
    description: "A fixed grid of recharge/bill shortcuts with optional top and bottom rows.",
    currentVersion: 1,
    minVersion: 1,
    supportsAudience: true,
    supportsDataSource: false,
    supportsLayout: true,
    itemGroups: ["topItems", "items", "bottomItems"],
  },
  {
    type: "monthlyClaim",
    label: "Monthly Claim",
    description: "A B2B claim-summary card whose amounts are filled from its dataSourceId.",
    currentVersion: 1,
    minVersion: 1,
    supportsAudience: true,
    supportsDataSource: true,
    supportsLayout: true,
    itemGroups: ["topItems", "items"],
  },
  {
    type: "rewardsHub",
    label: "Rewards Hub",
    description: "A B2C rewards/offers grid.",
    currentVersion: 1,
    minVersion: 1,
    supportsAudience: true,
    supportsDataSource: false,
    supportsLayout: true,
    itemGroups: ["topItems", "items"],
  },
];

export const COMPONENT_TYPE_SET = new Set(COMPONENT_CATALOG.map((c) => c.type));
export function isKnownComponentType(type: string): type is ComponentType {
  return COMPONENT_TYPE_SET.has(type as ComponentType);
}
export function catalogEntryFor(type: string): ComponentCatalogEntry | undefined {
  return COMPONENT_CATALOG.find((c) => c.type === type);
}
