import type { AudienceRule, AudienceCondition } from "@/types/homeScreen";

/**
 * Evaluates the same constrained, non-executable audience-rule shape the
 * backend validator and iOS's native `AudienceEvaluator` use (see
 * docs/architecture-review.md §6 — no expression evaluation, only
 * predefined fields/operators). Used here purely for the preview panel's
 * B2B/B2C toggle; the portal never decides real audience membership.
 */
export interface PreviewContext {
  "user.type": "B2B" | "B2C";
  "user.role"?: string;
  "user.planType"?: string;
  "app.version"?: string;
  "feature.flag"?: string;
}

function evalCondition(cond: AudienceCondition, ctx: PreviewContext): boolean {
  const actual = (ctx as unknown as Record<string, unknown>)[cond.field];
  const expected = cond.value;
  switch (cond.operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "in":
      return Array.isArray(expected) ? expected.includes(actual as string) : actual === expected;
    case "notIn":
      return Array.isArray(expected) ? !expected.includes(actual as string) : actual !== expected;
    case "gte":
      return String(actual ?? "") >= String(expected ?? "");
    case "lte":
      return String(actual ?? "") <= String(expected ?? "");
    default:
      return false;
  }
}

export function matchesAudience(rule: AudienceRule | undefined, ctx: PreviewContext): boolean {
  if (!rule) return true; // absent = everyone (docs/json-analysis.md A-03)
  if (rule.all && !rule.all.every((c) => evalCondition(c, ctx))) return false;
  if (rule.any && !rule.any.some((c) => evalCondition(c, ctx))) return false;
  if (rule.none && rule.none.some((c) => evalCondition(c, ctx))) return false;
  return true;
}
