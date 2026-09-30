"use client";

import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePortal } from "./PortalProvider";
import { Button, Badge } from "@/components/common/ui";
import type { Component } from "@/types/homeScreen";

function SortableRow({ component, selected, onSelect }: { component: Component; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: component.componentId });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
        selected ? "border-slate-900 bg-slate-50" : "border-transparent hover:bg-slate-50"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${component.componentId}`}
        className="cursor-grab select-none px-1 text-slate-400 hover:text-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        ⠿
      </button>
      <span className={`flex-1 truncate ${!component.enabled ? "text-slate-400 line-through" : ""}`}>{component.componentId}</span>
      <Badge>{component.type}</Badge>
      {component.audience && <Badge tone="warning">{summarizeAudience(component)}</Badge>}
    </div>
  );
}

function summarizeAudience(c: Component): string {
  const cond = c.audience?.all?.[0] ?? c.audience?.any?.[0];
  if (!cond) return "scoped";
  return Array.isArray(cond.value) ? cond.value.join(",") : String(cond.value);
}

export function ComponentList() {
  const p = usePortal();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const screen = p.draft?.screens[0];

  if (!screen) return null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    p.updateDraft((cfg) => {
      const comps = cfg.screens[0]!.components;
      const oldIndex = comps.findIndex((c) => c.componentId === active.id);
      const newIndex = comps.findIndex((c) => c.componentId === over.id);
      cfg.screens[0]!.components = arrayMove(comps, oldIndex, newIndex);
      return cfg;
    });
  }

  function addComponent(type: string) {
    const catalogEntry = p.componentCatalog.find((c) => c.type === type);
    if (!catalogEntry) return;
    const id = `${type}_${Date.now().toString(36)}`;
    p.updateDraft((cfg) => {
      cfg.screens[0]!.components.push({
        componentId: id,
        type: catalogEntry.type,
        componentVersion: catalogEntry.currentVersion,
        enabled: true,
        style: { backgroundToken: "surface.default" },
        layout: catalogEntry.supportsLayout ? { orientation: "horizontal", viewType: "fixed", columns: 3 } : undefined,
        props: { title: { kind: "literal", value: catalogEntry.label }, items: [] },
      });
      return cfg;
    });
    p.setSelectedComponentId(id);
  }

  function removeSelected() {
    if (!p.selectedComponentId) return;
    p.updateDraft((cfg) => {
      cfg.screens[0]!.components = cfg.screens[0]!.components.filter((c) => c.componentId !== p.selectedComponentId);
      return cfg;
    });
    p.setSelectedComponentId(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={screen.components.map((c) => c.componentId)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1">
            {screen.components.map((c) => (
              <SortableRow key={c.componentId} component={c} selected={c.componentId === p.selectedComponentId} onSelect={() => p.setSelectedComponentId(c.componentId)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-2 flex items-center gap-2">
        <select
          className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
          onChange={(e) => {
            if (e.target.value) addComponent(e.target.value);
            e.target.value = "";
          }}
          defaultValue=""
        >
          <option value="" disabled>
            + Add component…
          </option>
          {p.componentCatalog.map((c) => (
            <option key={c.type} value={c.type}>
              {c.label}
            </option>
          ))}
        </select>
        <Button variant="danger" disabled={!p.selectedComponentId} onClick={removeSelected}>
          Delete
        </Button>
      </div>
    </div>
  );
}
