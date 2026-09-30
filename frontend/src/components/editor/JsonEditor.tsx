"use client";

import { useEffect, useState } from "react";
import { usePortal } from "./PortalProvider";
import { Button, Panel } from "@/components/common/ui";

/**
 * Advanced JSON editor — secondary to the structured form (per the brief:
 * "Do not make raw JSON editing the primary experience"). It's synchronized
 * with the form editor: it always reflects the current draft state and
 * writes back through the same `updateDraft`/`replaceDraft` the form uses,
 * so both views can never disagree about what's staged. "Apply" refuses to
 * take effect on JSON that doesn't even parse or doesn't pass the same
 * schema/semantic validator `/validate` runs — it cannot get ahead of the
 * form editor with something un-publishable.
 */
export function JsonEditor() {
  const p = usePortal();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (p.draft) setText(JSON.stringify(p.draft, null, 2));
  }, [p.draft]);

  async function apply() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(e instanceof Error ? `Invalid JSON: ${e.message}` : "Invalid JSON.");
      return;
    }
    setApplying(true);
    try {
      const { validateHomeScreenConfiguration } = await import("@/lib/validation/semanticValidator");
      const result = validateHomeScreenConfiguration(parsed);
      if (!result.valid) {
        setError(`Schema/semantic check failed — ${result.errors.length} error(s). Fix them (see Validate panel) before applying.`);
        return;
      }
      p.replaceDraft(parsed as typeof p.draft & object);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Panel title="Advanced: raw JSON (synced with the form editor above)">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="h-96 w-full rounded-md border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-emerald-300 focus:outline-none"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <Button variant="secondary" disabled={applying} onClick={apply}>
          {applying ? "Checking…" : "Apply to form editor"}
        </Button>
        <Button variant="ghost" onClick={() => p.draft && setText(JSON.stringify(p.draft, null, 2))}>
          Reset to current draft
        </Button>
      </div>
    </Panel>
  );
}
