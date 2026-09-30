"use client";

import { usePortal } from "./PortalProvider";
import { Panel, Badge } from "@/components/common/ui";

export function ValidationPanel() {
  const p = usePortal();
  if (p.error) {
    return (
      <Panel title="Error" className="border-red-300">
        <p className="text-sm text-red-700">{p.error}</p>
      </Panel>
    );
  }
  if (!p.validation) return null;

  return (
    <Panel title="Validation result" className={p.validation.valid ? "border-emerald-300" : "border-red-300"}>
      <div className="mb-2">
        <Badge tone={p.validation.valid ? "success" : "critical"}>{p.validation.valid ? "Valid" : `${p.validation.errors.length} error(s)`}</Badge>
        {p.validation.warnings.length > 0 && <Badge tone="warning">{p.validation.warnings.length} warning(s)</Badge>}
      </div>
      <ul className="flex flex-col gap-1 text-xs">
        {p.validation.errors.map((e, i) => (
          <li key={i} className="rounded bg-red-50 p-1.5 text-red-800">
            <span className="font-mono font-semibold">{e.code}</span> <span className="text-red-500">{e.path}</span>
            <div>{e.message}</div>
          </li>
        ))}
        {p.validation.warnings.map((w, i) => (
          <li key={i} className="rounded bg-amber-50 p-1.5 text-amber-800">
            <span className="font-mono font-semibold">{w.code}</span> <span className="text-amber-500">{w.path}</span>
            <div>{w.message}</div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
