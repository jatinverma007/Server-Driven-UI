"use client";

import { useState } from "react";
import { PortalProvider, usePortal } from "@/components/editor/PortalProvider";
import { TopBar } from "@/components/editor/TopBar";
import { ComponentList } from "@/components/editor/ComponentList";
import { ComponentEditorForm } from "@/components/editor/ComponentEditorForm";
import { ThemeEditor } from "@/components/editor/ThemeEditor";
import { NavigationEditor } from "@/components/editor/NavigationEditor";
import { RevisionHistory } from "@/components/editor/RevisionHistory";
import { ValidationPanel } from "@/components/editor/ValidationPanel";
import { JsonEditor } from "@/components/editor/JsonEditor";
import { PhonePreview } from "@/components/preview/PhonePreview";
import { Button, Panel } from "@/components/common/ui";

type SidebarTab = "components" | "navigation" | "theme" | "revisions";

function Sidebar({ tab, setTab }: { tab: SidebarTab; setTab: (t: SidebarTab) => void }) {
  const tabs: Array<{ id: SidebarTab; label: string }> = [
    { id: "components", label: "Widgets" },
    { id: "navigation", label: "Navigation" },
    { id: "theme", label: "Themes" },
    { id: "revisions", label: "Versions" },
  ];
  return (
    <nav className="flex flex-col gap-1 border-b border-slate-200 p-2 lg:w-40 lg:border-b-0 lg:border-r">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`rounded-md px-3 py-2 text-left text-sm font-medium ${
            tab === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function DashboardInner() {
  const p = usePortal();
  const [tab, setTab] = useState<SidebarTab>("components");

  if (p.loading) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Loading draft…</div>;
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <Sidebar tab={tab} setTab={setTab} />

        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="flex w-full flex-col gap-3 overflow-y-auto border-b border-slate-200 p-3 lg:w-[27rem] lg:border-b-0 lg:border-r">
            {tab === "components" && (
              <>
                <Panel title="Screen components (drag to reorder)">
                  <ComponentList />
                </Panel>
                <ComponentEditorForm />
              </>
            )}
            {tab === "navigation" && <NavigationEditor />}
            {tab === "theme" && <ThemeEditor />}
            {tab === "revisions" && <RevisionHistory />}

            <ValidationPanel />

            <Button variant="ghost" onClick={() => p.setShowJsonEditor(!p.showJsonEditor)}>
              {p.showJsonEditor ? "Hide" : "Show"} advanced JSON editor
            </Button>
            {p.showJsonEditor && <JsonEditor />}
          </div>

          <div className="flex-1 overflow-hidden">
            <PhonePreview />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PortalProvider>
      <DashboardInner />
    </PortalProvider>
  );
}
