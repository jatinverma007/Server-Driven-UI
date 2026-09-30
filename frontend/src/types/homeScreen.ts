/**
 * Hand-maintained TypeScript types mirroring `src/schema/home-screen.schema.json`
 * one-to-one. This file is the "matching Codable models" counterpart on the
 * TypeScript side (see docs/architecture-review.md §8) — the JSON Schema
 * remains the authoritative, machine-validated contract (checked by ajv at
 * runtime in `lib/validation`); these types exist so the portal and backend
 * get compile-time safety without re-deriving the shape by hand at every call
 * site. If you change the JSON Schema, update this file in the same commit —
 * `tests/schema.contract.test.ts` cross-checks a real fixture against both.
 */

export type ComponentType =
  | "header"
  | "quickActions"
  | "actionCenter"
  | "bannerCarousel"
  | "rechargeBills"
  | "monthlyClaim"
  | "rewardsHub"
  | "unsupported";

export const COMPONENT_TYPES: ComponentType[] = [
  "header",
  "quickActions",
  "actionCenter",
  "bannerCarousel",
  "rechargeBills",
  "monthlyClaim",
  "rewardsHub",
];

export type ConfigStatus = "draft" | "published" | "archived";
export type Environment = "development" | "staging" | "production";

export type TextValue =
  | { kind: "literal"; value: string }
  | { kind: "binding"; path: string; fallback: string };

export type AssetRefStatic =
  | { kind: "remote"; url: string }
  | { kind: "bundled"; name: string };

export type AssetRef =
  | AssetRefStatic
  | { kind: "pending"; ref: string }
  | { kind: "binding"; path: string; fallback: AssetRefStatic };

export interface ColorPair {
  light: string;
  dark: string;
}

export interface GradientStop {
  /** A key into `theme.tokens` — a gradient stop is a themed (light/dark
   *  -aware) color, never a literal hex, so it resolves through exactly
   *  the same lookup a flat `backgroundToken` does. */
  colorToken: string;
  /** 0–1 position along the gradient line. */
  location: number;
}

export interface GradientValue {
  /** CSS `linear-gradient()` angle convention (0° = to top, 90° = to
   *  right, 180° = to bottom, clockwise) — matches Figma dev-mode's
   *  `background-image: linear-gradient(<angle>deg, ...)` export
   *  directly. */
  angle: number;
  stops: GradientStop[];
}

export interface IconCampaign {
  id: string;
  iconId: string;
  startDate: string;
  endDate: string;
  priority: number;
}

export interface AppIcons {
  defaultIconId: string;
  supportedIconIds: string[];
  timeZone: string;
  campaigns: IconCampaign[];
}

export type AudienceField = "user.type" | "user.role" | "user.planType" | "app.version" | "feature.flag";
export type AudienceOperator = "eq" | "neq" | "in" | "notIn" | "gte" | "lte";

export interface AudienceCondition {
  field: AudienceField;
  operator: AudienceOperator;
  value: string | string[];
}

export interface AudienceRule {
  all?: AudienceCondition[];
  any?: AudienceCondition[];
  none?: AudienceCondition[];
}

export interface ButtonStyle {
  variant: "solid" | "outline" | "ghost";
  role: "primary" | "success" | "critical" | "neutral";
}

export interface ButtonSpec {
  id: string;
  label: TextValue;
  icon?: AssetRef;
  iconPosition?: "start" | "end";
  buttonStyle?: ButtonStyle;
  actionId: string;
  accessibilityLabel?: TextValue;
}

export interface ComponentItem {
  id: string;
  label?: TextValue;
  subtitle?: TextValue;
  meta?: TextValue;
  media?: {
    leading?: AssetRef;
    trailing?: AssetRef;
    badge?: AssetRef;
  };
  accessibilityLabel?: TextValue;
  actionId?: string;
  dataSourceId?: string;
  style?: { backgroundToken?: string; backgroundGradientToken?: string; borderToken?: string };
  buttons?: ButtonSpec[];
}

export interface NavigationItem {
  id: string;
  label: TextValue;
  icon: AssetRef;
  actionId: string;
  variant?: "standard" | "elevatedCenter";
  audience?: AudienceRule;
}

export interface Layout {
  orientation?: "horizontal" | "vertical";
  viewType?: "fixed" | "scroll";
  itemSizing?: "intrinsic" | "fillViewport" | "pagedFullWidth";
  columns?: number;
}

export interface HeaderRightAction {
  id: string;
  icon: AssetRef;
  actionId: string;
  badgeCountField?: string;
}

export interface HeaderSubDetailVariant {
  audience: AudienceRule;
  textType?: "plain_text" | "badge";
  valueBinding: TextValue;
  icon?: AssetRef;
  actionId?: string;
}

export interface ComponentProps {
  title?: TextValue;
  nameField?: string;
  profileImageField?: string;
  rightActions?: HeaderRightAction[];
  subDetails?: { variants: HeaderSubDetailVariant[] };
  dataSourceId?: string;
  topItems?: ComponentItem[];
  items?: ComponentItem[];
  bottomItems?: ComponentItem[];
  [extra: string]: unknown;
}

export interface Component {
  componentId: string;
  type: ComponentType;
  componentVersion: number;
  enabled: boolean;
  audience?: AudienceRule;
  style: { backgroundToken: string };
  layout?: Layout;
  props: ComponentProps;
}

export interface ScreenStyle {
  backgroundToken: string;
  statusBarStyle: "auto" | "lightContent" | "darkContent";
  /** Optional hero-band gradient (`theme.gradients` key) layered over
   *  `backgroundToken` — see `HeaderPreview`'s screen-background wrapper
   *  and the iOS `HomeScreenRenderer`. */
  backgroundGradientToken?: string;
}

export interface Screen {
  screenId: string;
  title: string;
  style: ScreenStyle;
  components: Component[];
}

export interface HomeScreenConfiguration {
  configurationId: string;
  schemaVersion: string;
  revision: number;
  status: ConfigStatus;
  environment: Environment;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  cache?: { maxAgeSeconds: number };
  platformConstraints: {
    minAppVersion: { ios: string; android: string };
  };
  theme: { tokens: Record<string, ColorPair>; gradients?: Record<string, GradientValue> };
  appIcons: AppIcons;
  navigation: { bottom: NavigationItem[] };
  screens: Screen[];
}

/** The wire type stripped of server-authored envelope fields — what a portal
 * form edits and what PUT /draft accepts as its body. */
export type HomeScreenConfigurationInput = Omit<
  HomeScreenConfiguration,
  "configurationId" | "revision" | "status" | "publishedAt" | "createdAt" | "updatedAt"
>;
