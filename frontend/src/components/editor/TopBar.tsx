"use client";

import { useState } from "react";
import { usePortal } from "./PortalProvider";
import { Button, Badge } from "@/components/common/ui";

export function TopBar() {
  const p = usePortal();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const canPublish = p.role === "publisher" || p.role === "admin";
  const canWrite = p.role !== "viewer";

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="font-semibold">OmniCard SDUI</span>
        <Badge>{p.draft?.environment ?? "…"}</Badge>
        <Badge tone={p.draft?.status === "published" ? "success" : "neutral"}>{p.draft?.status ?? "…"}</Badge>
        {p.currentRevision !== null && <span className="text-xs text-slate-500">published rev {p.currentRevision}</span>}
        {p.isDirty && <Badge tone="warning">unsaved changes</Badge>}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="secondary" disabled={!canWrite || p.saving || !p.isDirty} onClick={() => p.save()}>
          {p.saving ? "Saving…" : "Save Draft"}
        </Button>
        <Button variant="secondary" disabled={!canWrite || p.validating} onClick={() => p.validate()}>
          {p.validating ? "Validating…" : "Validate"}
        </Button>
        <Button variant="primary" disabled={!canPublish || p.publishing} onClick={() => setConfirmOpen(true)}>
          {p.publishing ? "Publishing…" : "Publish"}
        </Button>

        {/* Read-only — role comes from the signed-in session now, not a
            self-service dropdown (the dropdown used to let anyone claim
            "publisher" client-side; the server always enforced the real
            role independently, but this closes the hole at the source). */}
        <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-3">
          {p.currentUser && (
            <span className="hidden text-xs text-slate-500 sm:inline">
              {p.currentUser.username} · <span className="font-medium text-slate-700">{p.currentUser.role}</span>
            </span>
          )}
          <Button
            variant="ghost"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              await p.logout();
            }}
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </Button>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">Publish this configuration?</h2>
            <p className="mt-2 text-sm text-slate-600">
              This saves the current draft, re-validates it, and — if valid — creates a new immutable revision that iOS will
              pick up on its next refresh. The previous published revision stays available for rollback.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  setConfirmOpen(false);
                  await p.publish();
                }}
              >
                Publish
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
