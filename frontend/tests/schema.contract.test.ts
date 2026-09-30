import { describe, it, expect } from "vitest";
import schema from "@/schema/home-screen.schema.json";
import { COMPONENT_TYPES } from "@/types/homeScreen";
import { COMPONENT_CATALOG } from "@/schema/catalog/components";
import { ACTION_CATALOG } from "@/schema/catalog/actions";
import { DATA_SOURCE_CATALOG } from "@/schema/catalog/dataSources";
import validFixture from "@/schema/examples/home-screen.valid.json";
import type { HomeScreenConfiguration, Component, ComponentItem } from "@/types/homeScreen";

describe("contract consistency — TS types, JSON Schema, and catalogs must agree", () => {
  it("ComponentType union matches the JSON Schema's Component.type enum", () => {
    const schemaEnum = (schema as any).$defs.Component.properties.type.enum as string[];
    for (const t of COMPONENT_TYPES) {
      expect(schemaEnum).toContain(t);
    }
    // every non-"unsupported" schema enum value has a catalog entry
    for (const t of schemaEnum.filter((t) => t !== "unsupported")) {
      expect(COMPONENT_CATALOG.some((c) => c.type === t)).toBe(true);
    }
  });

  it("every actionId used in the seed fixture is in the action catalog", () => {
    const cfg = validFixture as unknown as HomeScreenConfiguration;
    const actionIds = new Set<string>();
    cfg.navigation.bottom.forEach((n) => actionIds.add(n.actionId));
    cfg.screens.forEach((s: any) =>
      s.components.forEach((c: Component) => {
        const props = c.props as any;
        for (const group of ["topItems", "items", "bottomItems"]) {
          (props[group] as ComponentItem[] | undefined)?.forEach((item) => {
            if (item.actionId) actionIds.add(item.actionId);
            item.buttons?.forEach((b) => actionIds.add(b.actionId));
          });
        }
      })
    );
    const known = new Set(ACTION_CATALOG.map((a) => a.id));
    for (const id of actionIds) {
      expect(known.has(id)).toBe(true);
    }
    expect(actionIds.size).toBeGreaterThan(10);
  });

  it("every dataSourceId used in the seed fixture is in the data-source catalog", () => {
    const cfg = validFixture as unknown as HomeScreenConfiguration;
    const known = new Set(DATA_SOURCE_CATALOG.map((d) => d.id));
    const used: string[] = [];
    cfg.screens.forEach((s) =>
      s.components.forEach((c) => {
        if (c.props.dataSourceId) used.push(c.props.dataSourceId);
      })
    );
    expect(used.length).toBeGreaterThan(0);
    for (const id of used) expect(known.has(id)).toBe(true);
  });

  it("no endpoint/method/URL-shaped dataSourceId ever appears in the seed fixture (F-05 stays fixed)", () => {
    const raw = JSON.stringify(validFixture);
    expect(raw).not.toMatch(/"endpoint"\s*:/);
    expect(raw).not.toMatch(/"method"\s*:\s*"(GET|POST|PUT|DELETE)"/);
  });

  it("no <UPLOAD_PENDING or <CONFIRM_DATE placeholder survives in the publishable seed fixture", () => {
    const raw = JSON.stringify(validFixture);
    expect(raw).not.toMatch(/<UPLOAD_PENDING/);
    expect(raw).not.toMatch(/<CONFIRM_DATE/);
  });
});
