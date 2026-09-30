"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePortal } from "./PortalProvider";
import { Button, Select, TextInput, Field } from "@/components/common/ui";
import { resolveText } from "@/lib/portal/textValue";
import type { ComponentItem } from "@/types/homeScreen";

const newItemSchema = z.object({
  id: z
    .string()
    .min(1, "Required")
    .regex(/^[a-z0-9_]+$/, "lowercase, digits, underscore only"),
  label: z.string().min(1, "Required"),
  actionId: z.string().min(1, "Required"),
});
type NewItemForm = z.infer<typeof newItemSchema>;

export function ItemGroupEditor({ componentId, group }: { componentId: string; group: "topItems" | "items" | "bottomItems" }) {
  const p = usePortal();
  const component = p.draft?.screens[0]!.components.find((c) => c.componentId === componentId);
  const items: ComponentItem[] = (component?.props[group] as ComponentItem[] | undefined) ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewItemForm>({ resolver: zodResolver(newItemSchema), defaultValues: { id: "", label: "", actionId: "" } });

  function mutateItems(fn: (items: ComponentItem[]) => ComponentItem[]) {
    p.updateDraft((cfg) => {
      const c = cfg.screens[0]!.components.find((c) => c.componentId === componentId);
      if (!c) return cfg;
      const current = (c.props[group] as ComponentItem[] | undefined) ?? [];
      c.props[group] = fn(current);
      return cfg;
    });
  }

  function onAdd(data: NewItemForm) {
    mutateItems((current) => [
      ...current,
      { id: data.id, label: { kind: "literal", value: data.label }, actionId: data.actionId },
    ]);
    reset();
  }

  function move(index: number, dir: -1 | 1) {
    mutateItems((current) => {
      const next = [...current];
      const target = index + dir;
      if (target < 0 || target >= next.length) return current;
      const a = next[index]!;
      const b = next[target]!;
      next[index] = b;
      next[target] = a;
      return next;
    });
  }

  function remove(index: number) {
    mutateItems((current) => current.filter((_, i) => i !== index));
  }

  function updateItem(index: number, patch: Partial<{ label: string; actionId: string }>) {
    mutateItems((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              ...(patch.label !== undefined ? { label: { kind: "literal" as const, value: patch.label } } : {}),
              ...(patch.actionId !== undefined ? { actionId: patch.actionId } : {}),
            }
          : item
      )
    );
  }

  return (
    <div className="rounded-md border border-slate-200 p-2">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group}</div>
      <div className="flex flex-col gap-1">
        {items.length === 0 && <p className="text-xs text-slate-400">No items.</p>}
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-1.5 rounded border border-slate-200 p-1.5">
            <span className="w-24 shrink-0 truncate text-xs text-slate-400">{item.id}</span>
            <TextInput
              value={resolveText(item.label)}
              onChange={(e) => updateItem(i, { label: e.target.value })}
              className="flex-1"
              aria-label={`${item.id} label`}
            />
            <Select
              value={item.actionId ?? ""}
              onChange={(e) => updateItem(i, { actionId: e.target.value })}
              className="!w-40"
              aria-label={`${item.id} action`}
            >
              <option value="">(no action)</option>
              {p.actionCatalog.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
            <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
              ↑
            </Button>
            <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
              ↓
            </Button>
            <Button variant="danger" onClick={() => remove(i)} aria-label="Delete item">
              ✕
            </Button>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onAdd)} className="mt-2 flex items-end gap-1.5 border-t border-dashed border-slate-200 pt-2">
        <Field label="New item id">
          <TextInput {...register("id")} placeholder="e.g. new_action" />
          {errors.id && <span className="text-xs text-red-600">{errors.id.message}</span>}
        </Field>
        <Field label="Label">
          <TextInput {...register("label")} placeholder="Label" />
        </Field>
        <Field label="Action">
          <Select {...register("actionId")}>
            <option value="">choose…</option>
            {p.actionCatalog.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">
          + Add
        </Button>
      </form>
    </div>
  );
}
