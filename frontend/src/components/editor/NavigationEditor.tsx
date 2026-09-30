"use client";

import { usePortal } from "./PortalProvider";
import { TextInput, Select, Panel, Button } from "@/components/common/ui";
import { resolveText } from "@/lib/portal/textValue";

export function NavigationEditor() {
  const p = usePortal();
  const items = p.draft?.navigation.bottom ?? [];

  function patch(index: number, fn: (item: (typeof items)[number]) => void) {
    p.updateDraft((cfg) => {
      const item = cfg.navigation.bottom[index];
      if (item) fn(item);
      return cfg;
    });
  }

  function move(index: number, dir: -1 | 1) {
    p.updateDraft((cfg) => {
      const next = cfg.navigation.bottom;
      const target = index + dir;
      if (target < 0 || target >= next.length) return cfg;
      const a = next[index]!;
      const b = next[target]!;
      next[index] = b;
      next[target] = a;
      return cfg;
    });
  }

  function audienceLabel(item: (typeof items)[number]): "all" | "B2B" | "B2C" {
    const v = item.audience?.all?.[0]?.value;
    const first = Array.isArray(v) ? v[0] : v;
    return first === "B2B" || first === "B2C" ? first : "all";
  }

  return (
    <Panel title="Bottom navigation">
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-1.5 rounded border border-slate-200 p-1.5 text-sm">
            <span className="w-16 shrink-0 truncate text-xs text-slate-400">{item.id}</span>
            <TextInput
              value={resolveText(item.label)}
              onChange={(e) =>
                patch(i, (it) => {
                  it.label = { kind: "literal", value: e.target.value };
                })
              }
              className="flex-1"
            />
            <Select
              value={item.actionId}
              onChange={(e) =>
                patch(i, (it) => {
                  it.actionId = e.target.value;
                })
              }
              className="!w-36"
            >
              {p.actionCatalog.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
            <Select
              value={audienceLabel(item)}
              onChange={(e) =>
                patch(i, (it) => {
                  const v = e.target.value;
                  it.audience = v === "all" ? undefined : { all: [{ field: "user.type", operator: "in", value: [v] }] };
                })
              }
              className="!w-24"
            >
              <option value="all">all</option>
              <option value="B2B">B2B</option>
              <option value="B2C">B2C</option>
            </Select>
            <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
              ↑
            </Button>
            <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
              ↓
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
