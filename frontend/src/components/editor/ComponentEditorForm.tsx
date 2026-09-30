"use client";

import { usePortal } from "./PortalProvider";
import { Field, TextInput, Select, Checkbox, Panel } from "@/components/common/ui";
import { ItemGroupEditor } from "./ItemGroupEditor";
import { resolveText } from "@/lib/portal/textValue";
import type { AudienceRule } from "@/types/homeScreen";

const AUDIENCE_OPTIONS: Array<{ label: string; value: "all" | "B2B" | "B2C" }> = [
  { label: "Everyone", value: "all" },
  { label: "B2B only", value: "B2B" },
  { label: "B2C only", value: "B2C" },
];

function audienceToOption(a: AudienceRule | undefined): "all" | "B2B" | "B2C" {
  const cond = a?.all?.[0];
  if (!cond) return "all";
  const v: string | undefined = Array.isArray(cond.value) ? cond.value[0] : cond.value;
  return v === "B2B" || v === "B2C" ? v : "all";
}

export function ComponentEditorForm() {
  const p = usePortal();
  const component = p.draft?.screens[0]?.components.find((c) => c.componentId === p.selectedComponentId);
  const catalogEntry = component ? p.componentCatalog.find((c) => c.type === component.type) : undefined;

  if (!component) {
    return <p className="p-4 text-sm text-slate-500">Select a component on the left to edit it, or add a new one.</p>;
  }

  function patchComponent(patch: (c: NonNullable<typeof component>) => void) {
    p.updateDraft((cfg) => {
      const c = cfg.screens[0]!.components.find((c) => c.componentId === component!.componentId);
      if (c) patch(c as NonNullable<typeof component>);
      return cfg;
    });
  }

  const themeTokens = Object.keys(p.draft?.theme.tokens ?? {});

  return (
    <div className="flex flex-col gap-3">
      <Panel title={`${component.type} — ${component.componentId}`}>
        <Checkbox label="Enabled" checked={component.enabled} onChange={(e) => patchComponent((c) => (c.enabled = e.target.checked))} />

        {component.props.title !== undefined && (
          <Field label="Title">
            <TextInput
              value={resolveText(component.props.title)}
              onChange={(e) =>
                patchComponent((c) => {
                  c.props.title = { kind: "literal", value: e.target.value };
                })
              }
            />
          </Field>
        )}

        <Field label="Background theme token">
          <Select
            value={component.style.backgroundToken}
            onChange={(e) =>
              patchComponent((c) => {
                c.style.backgroundToken = e.target.value;
              })
            }
          >
            {themeTokens.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        {catalogEntry?.supportsAudience && (
          <Field label="Audience">
            <Select
              value={audienceToOption(component.audience)}
              onChange={(e) =>
                patchComponent((c) => {
                  const v = e.target.value;
                  c.audience = v === "all" ? undefined : { all: [{ field: "user.type", operator: "in", value: [v] }] };
                })
              }
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {catalogEntry?.supportsLayout && component.layout && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Orientation">
              <Select
                value={component.layout.orientation}
                onChange={(e) =>
                  patchComponent((c) => {
                    c.layout!.orientation = e.target.value as "horizontal" | "vertical";
                  })
                }
              >
                <option value="horizontal">horizontal</option>
                <option value="vertical">vertical</option>
              </Select>
            </Field>
            <Field label="View type">
              <Select
                value={component.layout.viewType}
                onChange={(e) =>
                  patchComponent((c) => {
                    c.layout!.viewType = e.target.value as "fixed" | "scroll";
                  })
                }
              >
                <option value="fixed">fixed</option>
                <option value="scroll">scroll</option>
              </Select>
            </Field>
            {component.layout.viewType === "fixed" && (
              <Field label="Columns (1–6)">
                <TextInput
                  type="number"
                  min={1}
                  max={6}
                  value={component.layout.columns ?? 3}
                  onChange={(e) =>
                    patchComponent((c) => {
                      c.layout!.columns = Math.min(6, Math.max(1, Number(e.target.value) || 1));
                    })
                  }
                />
              </Field>
            )}
            {component.layout.viewType === "scroll" && (
              <Field label="Item sizing">
                <Select
                  value={component.layout.itemSizing ?? "intrinsic"}
                  onChange={(e) =>
                    patchComponent((c) => {
                      c.layout!.itemSizing = e.target.value as "intrinsic" | "fillViewport" | "pagedFullWidth";
                    })
                  }
                >
                  <option value="intrinsic">intrinsic</option>
                  <option value="fillViewport">fillViewport</option>
                  <option value="pagedFullWidth">pagedFullWidth</option>
                </Select>
              </Field>
            )}
          </div>
        )}

        {catalogEntry?.supportsDataSource && (
          <Field label="Data source">
            <Select
              value={component.props.dataSourceId ?? ""}
              onChange={(e) =>
                patchComponent((c) => {
                  c.props.dataSourceId = e.target.value || undefined;
                })
              }
            >
              <option value="">(none)</option>
              {p.dataSourceCatalog.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Panel>

      {(catalogEntry?.itemGroups ?? []).map((group) => (
        <ItemGroupEditor key={group} componentId={component.componentId} group={group} />
      ))}
    </div>
  );
}
