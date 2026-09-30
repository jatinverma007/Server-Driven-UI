/**
 * The approved launcher-icon catalog — see docs/architecture-review.md §7.1.
 * This is the set of alternate icon ids the CURRENTLY BUNDLED iOS app build
 * actually ships in Info.plist → CFBundleIcons → CFBundleAlternateIcons
 * (mirrored in ios-swiftui/DynamicUIApp/Resources — the two lists must be
 * kept in sync by hand; see ios-swiftui README). A campaign's `iconId` that
 * is not in this list is rejected at publish (E_UNSUPPORTED_ICON_ID) because
 * no remote URL can ever become an installed iOS launcher icon.
 */
export interface AppIconCatalogEntry {
  iconId: string;
  label: string;
  bundled: boolean;
}

export const APP_ICON_CATALOG: AppIconCatalogEntry[] = [
  { iconId: "ic_launcher", label: "Default", bundled: true },
  { iconId: "ic_launcher_ny", label: "New Year", bundled: true },
  { iconId: "ic_launcher_26", label: "Republic Day", bundled: true },
  { iconId: "ic_launcher_ind", label: "Independence Day", bundled: true },
  { iconId: "ic_launcher_chris", label: "Christmas", bundled: true },
  // Not yet bundled — present here only so the portal can show them as
  // "blocked: needs an app release" rather than silently omitting them.
  { iconId: "ic_launcher_holi", label: "Holi", bundled: false },
  { iconId: "ic_launcher_rakhi", label: "Raksha Bandhan", bundled: false },
  { iconId: "ic_launcher_diwali", label: "Diwali", bundled: false },
];

export const BUNDLED_ICON_IDS = new Set(APP_ICON_CATALOG.filter((i) => i.bundled).map((i) => i.iconId));
export function isBundledIcon(iconId: string): boolean {
  return BUNDLED_ICON_IDS.has(iconId);
}
