/**
 * Two-layer validation, matching docs/architecture-review.md §9:
 *
 *  1. STRUCTURAL — `home-screen.schema.json` via ajv (types, required fields,
 *     enums, string formats/patterns). Run first; if it fails we don't
 *     bother with semantic checks on a shape we can't safely traverse.
 *  2. SEMANTIC — this file. Rules that JSON Schema cannot express: catalog
 *     membership, cross-references, uniqueness across siblings, and the
 *     placeholder patterns that Phase 1 identified (F-02/F-03).
 *
 * Both layers run for `POST /validate` AND `POST /publish` (publish is
 * "validate, and if it passes, persist" — never publish without both).
 */
import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "@/schema/home-screen.schema.json";
import { isKnownAction } from "@/schema/catalog/actions";
import { isKnownDataSource } from "@/schema/catalog/dataSources";
import { isKnownComponentType } from "@/schema/catalog/components";
import { isBundledIcon } from "@/schema/catalog/icons";
import type { HomeScreenConfiguration, TextValue, AssetRef, Component, ComponentItem, ButtonSpec } from "@/types/homeScreen";

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const SUPPORTED_SCHEMA_MAJOR = 2;
const PLACEHOLDER_PATTERN = /<UPLOAD_PENDING:[^>]*>|<CONFIRM_DATE>/;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateStructure = ajv.compile(schema);

function ajvErrorsToIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((e) => ({
    code: "E_SCHEMA_" + (e.keyword ?? "invalid").toUpperCase(),
    path: e.instancePath || "(root)",
    message: e.message ?? "schema validation failed",
    severity: "error" as const,
  }));
}

function pushErr(list: ValidationIssue[], code: string, path: string, message: string) {
  list.push({ code, path, message, severity: "error" });
}
function pushWarn(list: ValidationIssue[], code: string, path: string, message: string) {
  list.push({ code, path, message, severity: "warning" });
}

function textContainsPlaceholder(t: TextValue | undefined): boolean {
  if (!t) return false;
  if (t.kind === "literal") return PLACEHOLDER_PATTERN.test(t.value);
  return PLACEHOLDER_PATTERN.test(t.fallback);
}

function assetContainsPlaceholder(a: AssetRef | undefined): boolean {
  if (!a) return false;
  if (a.kind === "pending") return true; // pending is, by definition, unresolved
  if (a.kind === "remote") return PLACEHOLDER_PATTERN.test(a.url);
  if (a.kind === "bundled") return PLACEHOLDER_PATTERN.test(a.name);
  if (a.kind === "binding") return assetContainsPlaceholder(a.fallback);
  return false;
}

function checkItem(item: ComponentItem, path: string, errors: ValidationIssue[]) {
  if (textContainsPlaceholder(item.label) || textContainsPlaceholder(item.subtitle) || textContainsPlaceholder(item.meta)) {
    pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", path, "Item text contains an unresolved <UPLOAD_PENDING>/<CONFIRM_DATE> placeholder.");
  }
  if (assetContainsPlaceholder(item.media?.leading) || assetContainsPlaceholder(item.media?.trailing) || assetContainsPlaceholder(item.media?.badge)) {
    pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", path, "Item media contains an unresolved placeholder or a pending asset.");
  }
  if (item.actionId && !isKnownAction(item.actionId)) {
    pushErr(errors, "E_UNKNOWN_ACTION", `${path}.actionId`, `Action id "${item.actionId}" is not in the action catalog.`);
  }
  if (item.dataSourceId && !isKnownDataSource(item.dataSourceId)) {
    pushErr(errors, "E_UNKNOWN_DATA_SOURCE", `${path}.dataSourceId`, `Data source id "${item.dataSourceId}" is not in the data-source catalog.`);
  }
  const hasVisibleLabel = item.label?.kind === "literal" ? item.label.value.trim().length > 0 : Boolean(item.label);
  if (!hasVisibleLabel && !item.accessibilityLabel && (item.actionId || (item.buttons?.length ?? 0) > 0)) {
    pushErr(errors, "E_MISSING_ACCESSIBILITY_LABEL", path, "Actionable item has no visible label and no accessibilityLabel.");
  }
  (item.buttons ?? []).forEach((b: ButtonSpec, i: number) => checkButton(b, `${path}.buttons[${i}]`, errors));
}

function checkButton(button: ButtonSpec, path: string, errors: ValidationIssue[]) {
  if (textContainsPlaceholder(button.label)) {
    pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", `${path}.label`, "Button label contains an unresolved placeholder.");
  }
  if (assetContainsPlaceholder(button.icon)) {
    pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", `${path}.icon`, "Button icon contains an unresolved placeholder or is pending.");
  }
  if (!isKnownAction(button.actionId)) {
    pushErr(errors, "E_UNKNOWN_ACTION", `${path}.actionId`, `Action id "${button.actionId}" is not in the action catalog.`);
  }
  const emptyLabel = button.label.kind === "literal" && button.label.value.trim().length === 0;
  if (emptyLabel && !button.accessibilityLabel) {
    pushErr(errors, "E_MISSING_ACCESSIBILITY_LABEL", path, "Icon-only button has no accessibilityLabel.");
  }
}

export function validateHomeScreenConfiguration(input: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const structurallyValid = validateStructure(input);
  errors.push(...ajvErrorsToIssues(validateStructure.errors));
  if (!structurallyValid) {
    // Semantic checks assume a structurally-sound shape; bail out early
    // rather than throwing while walking a malformed document.
    return { valid: false, errors, warnings };
  }

  const cfg = input as unknown as HomeScreenConfiguration;

  // Rule: schemaVersion compatibility
  const major = Number.parseInt(cfg.schemaVersion.split(".")[0] ?? "0", 10);
  if (major !== SUPPORTED_SCHEMA_MAJOR) {
    pushErr(errors, "E_INCOMPATIBLE_SCHEMA_VERSION", "/schemaVersion", `schemaVersion major ${major} is not supported (expected ${SUPPORTED_SCHEMA_MAJOR}.x).`);
  }

  // Rule: theme token references must resolve
  const knownTokens = new Set(Object.keys(cfg.theme.tokens));
  function checkToken(token: string | undefined, path: string) {
    if (token && !knownTokens.has(token)) {
      pushErr(errors, "E_UNKNOWN_THEME_TOKEN", path, `backgroundToken "${token}" is not defined in theme.tokens.`);
    }
  }

  // Rule: gradient token references (backgroundGradientToken) must resolve
  // against theme.gradients, and every gradient's own stops must in turn
  // resolve against theme.tokens — a gradient stop is a themed color, not
  // a literal, so it's held to the same "must exist" bar checkToken
  // already enforces for a flat backgroundToken.
  const knownGradients = new Set(Object.keys(cfg.theme.gradients ?? {}));
  function checkGradientToken(token: string | undefined, path: string) {
    if (token && !knownGradients.has(token)) {
      pushErr(errors, "E_UNKNOWN_GRADIENT_TOKEN", path, `backgroundGradientToken "${token}" is not defined in theme.gradients.`);
    }
  }
  Object.entries(cfg.theme.gradients ?? {}).forEach(([gradientKey, gradient]) => {
    gradient.stops.forEach((stop, i) => {
      checkToken(stop.colorToken, `/theme/gradients/${gradientKey}/stops[${i}]/colorToken`);
    });
  });

  // Rule: appIcons — supportedIconIds must be real bundled icons; campaigns must
  // reference a supported id and must not contain placeholders.
  for (const iconId of cfg.appIcons.supportedIconIds) {
    if (PLACEHOLDER_PATTERN.test(iconId)) {
      pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", "/appIcons/supportedIconIds", `"${iconId}" is a placeholder, not a real icon id.`);
    } else if (!isBundledIcon(iconId)) {
      pushWarn(warnings, "W_ICON_NOT_IN_APP_CATALOG", "/appIcons/supportedIconIds", `"${iconId}" is not in the known bundled-icon catalog — confirm the app build actually ships it.`);
    }
  }
  const campaignIds = new Set<string>();
  cfg.appIcons.campaigns.forEach((c, i) => {
    const path = `/appIcons/campaigns[${i}]`;
    if (campaignIds.has(c.id)) {
      pushErr(errors, "E_DUPLICATE_ID", path, `Duplicate campaign id "${c.id}".`);
    }
    campaignIds.add(c.id);
    if (PLACEHOLDER_PATTERN.test(c.iconId) || PLACEHOLDER_PATTERN.test(c.startDate) || PLACEHOLDER_PATTERN.test(c.endDate)) {
      pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", path, "Campaign contains an unresolved placeholder.");
    } else if (!cfg.appIcons.supportedIconIds.includes(c.iconId)) {
      pushErr(errors, "E_UNSUPPORTED_ICON_ID", `${path}.iconId`, `"${c.iconId}" is not in appIcons.supportedIconIds.`);
    }
    if (!PLACEHOLDER_PATTERN.test(c.startDate) && !PLACEHOLDER_PATTERN.test(c.endDate) && c.endDate < c.startDate) {
      pushErr(errors, "E_INVALID_DATE_RANGE", path, `endDate (${c.endDate}) is before startDate (${c.startDate}).`);
    }
  });

  // Rule: navigation items — actions + placeholders + theme
  cfg.navigation.bottom.forEach((nav, i) => {
    const path = `/navigation/bottom[${i}]`;
    if (textContainsPlaceholder(nav.label)) pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", path, "Navigation label contains a placeholder.");
    if (assetContainsPlaceholder(nav.icon)) pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", `${path}.icon`, "Navigation icon is unresolved/pending.");
    if (!isKnownAction(nav.actionId)) pushErr(errors, "E_UNKNOWN_ACTION", `${path}.actionId`, `Action id "${nav.actionId}" is not in the action catalog.`);
  });

  // Rule: screens/components — duplicate ids, unknown types, ordering, theme, catalogs
  cfg.screens.forEach((screen, si) => {
    checkToken(screen.style.backgroundToken, `/screens[${si}]/style/backgroundToken`);
    checkGradientToken(screen.style.backgroundGradientToken, `/screens[${si}]/style/backgroundGradientToken`);
    const seenComponentIds = new Set<string>();
    if (screen.components.length === 0) {
      pushErr(errors, "E_INVALID_ORDERING", `/screens[${si}]/components`, "A screen must have at least one component.");
    }
    screen.components.forEach((component: Component, ci: number) => {
      const path = `/screens[${si}]/components[${ci}]`;
      if (seenComponentIds.has(component.componentId)) {
        pushErr(errors, "E_DUPLICATE_COMPONENT_ID", path, `Duplicate componentId "${component.componentId}" within screen "${screen.screenId}".`);
      }
      seenComponentIds.add(component.componentId);

      if (!isKnownComponentType(component.type)) {
        pushErr(errors, "E_UNKNOWN_COMPONENT", `${path}.type`, `Component type "${component.type}" is not in the component catalog.`);
      }
      checkToken(component.style?.backgroundToken, `${path}.style.backgroundToken`);

      const props = component.props ?? {};
      if (props.dataSourceId && !isKnownDataSource(props.dataSourceId)) {
        pushErr(errors, "E_UNKNOWN_DATA_SOURCE", `${path}.props.dataSourceId`, `Data source id "${props.dataSourceId}" is not in the data-source catalog.`);
      }
      if (textContainsPlaceholder(props.title)) {
        pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", `${path}.props.title`, "Component title contains a placeholder.");
      }
      for (const group of ["topItems", "items", "bottomItems"] as const) {
        const items = props[group] as ComponentItem[] | undefined;
        if (!items) continue;
        const seenItemIds = new Set<string>();
        items.forEach((item, ii) => {
          const itemPath = `${path}.props.${group}[${ii}]`;
          if (seenItemIds.has(item.id)) {
            pushErr(errors, "E_DUPLICATE_ID", itemPath, `Duplicate item id "${item.id}" within ${group}.`);
          }
          seenItemIds.add(item.id);
          checkToken(item.style?.backgroundToken, `${itemPath}.style.backgroundToken`);
          checkGradientToken(item.style?.backgroundGradientToken, `${itemPath}.style.backgroundGradientToken`);
          checkToken(item.style?.borderToken, `${itemPath}.style.borderToken`);
          checkItem(item, itemPath, errors);
        });
      }
      (props.rightActions ?? []).forEach((ra, i) => {
        if (assetContainsPlaceholder(ra.icon)) pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", `${path}.props.rightActions[${i}].icon`, "Right-action icon is unresolved/pending.");
        if (!isKnownAction(ra.actionId)) pushErr(errors, "E_UNKNOWN_ACTION", `${path}.props.rightActions[${i}].actionId`, `Action id "${ra.actionId}" is not in the action catalog.`);
      });
      (props.subDetails?.variants ?? []).forEach((v, i) => {
        if (textContainsPlaceholder(v.valueBinding)) pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", `${path}.props.subDetails.variants[${i}]`, "subDetails valueBinding contains a placeholder.");
        if (assetContainsPlaceholder(v.icon)) pushErr(errors, "E_UNRESOLVED_PLACEHOLDER", `${path}.props.subDetails.variants[${i}].icon`, "subDetails icon is unresolved/pending.");
        if (v.actionId && !isKnownAction(v.actionId)) pushErr(errors, "E_UNKNOWN_ACTION", `${path}.props.subDetails.variants[${i}].actionId`, `Action id "${v.actionId}" is not in the action catalog.`);
      });
    });
  });

  // Rule: remote asset hosts must be on the allowlist, when one is
  // configured. Added during the Phase 6 production-readiness audit
  // (docs/production-readiness-audit.md, "Asset delivery / SSRF-adjacent
  // exposure") — `ASSET_HOST_ALLOWLIST` was documented in `.env.example`
  // as enforced here but nothing actually read it. A generic walk (rather
  // than threading a new check through every one of the many per-field
  // AssetRef call sites above) keeps this fix small and low-risk: it can't
  // miss a call site, and it can't change behavior for any existing field
  // beyond adding this one new check.
  const allowlistRaw = process.env.ASSET_HOST_ALLOWLIST?.trim();
  if (allowlistRaw) {
    const allowedHosts = new Set(allowlistRaw.split(",").map((h) => h.trim()).filter(Boolean));
    const seenRemoteUrls = new Set<string>();
    const walkForRemoteAssets = (node: unknown, path: string) => {
      if (node === null || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach((child, i) => walkForRemoteAssets(child, `${path}[${i}]`));
        return;
      }
      const obj = node as Record<string, unknown>;
      if (obj.kind === "remote" && typeof obj.url === "string") {
        if (!seenRemoteUrls.has(`${path}:${obj.url}`)) {
          seenRemoteUrls.add(`${path}:${obj.url}`);
          try {
            const host = new URL(obj.url).host;
            if (!allowedHosts.has(host)) {
              pushErr(errors, "E_ASSET_HOST_NOT_ALLOWED", path, `Remote asset host "${host}" is not in ASSET_HOST_ALLOWLIST.`);
            }
          } catch {
            pushErr(errors, "E_ASSET_HOST_NOT_ALLOWED", path, `Remote asset url "${obj.url}" could not be parsed.`);
          }
        }
      }
      for (const [key, value] of Object.entries(obj)) {
        walkForRemoteAssets(value, `${path}/${key}`);
      }
    };
    walkForRemoteAssets(cfg, "");
  }

  return { valid: errors.length === 0, errors, warnings };
}
