"use client";

import { useState } from "react";
import { usePortal } from "./PortalProvider";
import { Panel, Button, Badge } from "@/components/common/ui";

export function RevisionHistory() {
  const p = usePortal();
  const [confirming, setConfirming] = useState<number | null>(null);
  const canRestore = p.role === "publisher" || p.role === "admin";

  return (
    <Panel title="Revision history">
      <div className="flex flex-col gap-1.5">
        {p.revisions.length === 0 && <p className="text-xs text-slate-400">No revisions published yet.</p>}
        {p.revisions.map((r) => (
          <div key={r.revision} className="flex items-center justify-between rounded border border-slate-200 p-2 text-sm">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-medium">rev {r.revision}</span>
                {r.revision === p.currentRevision && <Badge tone="success">live</Badge>}
                {r.restoredFromRevision !== null && <Badge>restored from {r.restoredFromRevision}</Badge>}
              </div>
              <div className="text-xs text-slate-500">
                {new Date(r.createdAt).toLocaleString()} · {r.createdBy}
              </div>
            </div>
            {confirming === r.revision ? (
              <div className="flex gap-1">
                <Button
                  variant="primary"
                  onClick={async () => {
                    await p.restore(r.revision);
                    setConfirming(null);
                  }}
                >
                  Confirm
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="secondary" disabled={!canRestore || r.revision === p.currentRevision} onClick={() => setConfirming(r.revision)}>
                Restore
              </Button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
