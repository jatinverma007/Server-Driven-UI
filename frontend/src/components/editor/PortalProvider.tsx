"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { HomeScreenConfiguration } from "@/types/homeScreen";
import type { ComponentCatalogEntry } from "@/schema/catalog/components";
import type { ActionCatalogEntry } from "@/schema/catalog/actions";
import type { DataSourceCatalogEntry } from "@/schema/catalog/dataSources";
import { useRouter } from "next/navigation";
import {
  getDraft,
  saveDraft,
  validateConfig,
  publishConfig,
  listRevisions,
  restoreRevision,
  getComponentCatalog,
  getActionCatalog,
  getDataSourceCatalog,
  getCurrentUser,
  logout as logoutRequest,
  type PortalRole,
  type PortalUser,
  type ValidationResponse,
  type RevisionSummary,
} from "@/lib/portal/api";

export type PreviewAudience = "B2B" | "B2C";
export type PreviewTheme = "light" | "dark";
// Logical (point, not pixel) widths from Apple's published iOS Human
// Interface Guidelines device tables — the same unit SwiftUI's own layout
// system reasons in, so a chip that fits/wraps here should fit/wrap the
// same way on that physical device's simulator. Covers the actual spread
// of shipping screen sizes (320pt smallest-ever up to 440pt largest-ever),
// not just three points on that range, so a layout that only got exercised
// at "iPhone 14" width (390pt) has somewhere narrower and wider to prove
// itself against too.
export type PreviewDevice = "iphone-se" | "iphone-13-mini" | "iphone-14" | "iphone-14-pro" | "iphone-14-plus" | "iphone-14-pro-max" | "iphone-16-pro-max";

interface PortalState {
  role: PortalRole;
  setRole: (r: PortalRole) => void;
  currentUser: PortalUser | null;
  logout: () => Promise<void>;

  draft: HomeScreenConfiguration | null;
  isDirty: boolean;
  loading: boolean;
  error: string | null;

  updateDraft: (updater: (cfg: HomeScreenConfiguration) => HomeScreenConfiguration) => void;
  replaceDraft: (cfg: HomeScreenConfiguration) => void;

  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;

  save: () => Promise<void>;
  saving: boolean;
  validate: () => Promise<ValidationResponse | null>;
  validating: boolean;
  validation: ValidationResponse | null;
  publish: () => Promise<boolean>;
  publishing: boolean;

  revisions: RevisionSummary[];
  currentRevision: number | null;
  refreshRevisions: () => Promise<void>;
  restore: (revision: number) => Promise<void>;

  previewAudience: PreviewAudience;
  setPreviewAudience: (a: PreviewAudience) => void;
  previewTheme: PreviewTheme;
  setPreviewTheme: (t: PreviewTheme) => void;
  previewDevice: PreviewDevice;
  setPreviewDevice: (d: PreviewDevice) => void;

  showJsonEditor: boolean;
  setShowJsonEditor: (v: boolean) => void;

  componentCatalog: ComponentCatalogEntry[];
  actionCatalog: ActionCatalogEntry[];
  dataSourceCatalog: DataSourceCatalogEntry[];
}

const PortalContext = createContext<PortalState | null>(null);

export function usePortal(): PortalState {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within <PortalProvider>");
  return ctx;
}

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // "admin" is just the pre-load default so nothing sits permanently
  // disabled while /auth/me is in flight — it's replaced by the real,
  // server-verified role a moment later (see the load effect below), and
  // the server independently enforces the real role on every write
  // regardless of what this optimistic default says.
  const [role, setRole] = useState<PortalRole>("admin");
  const [currentUser, setCurrentUser] = useState<PortalUser | null>(null);
  const [draft, setDraft] = useState<HomeScreenConfiguration | null>(null);
  const [savedJson, setSavedJson] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [currentRevision, setCurrentRevision] = useState<number | null>(null);
  const [previewAudience, setPreviewAudience] = useState<PreviewAudience>("B2C");
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>("light");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("iphone-14");
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [componentCatalog, setComponentCatalog] = useState<ComponentCatalogEntry[]>([]);
  const [actionCatalog, setActionCatalog] = useState<ActionCatalogEntry[]>([]);
  const [dataSourceCatalog, setDataSourceCatalog] = useState<DataSourceCatalogEntry[]>([]);

  const refreshRevisions = useCallback(async () => {
    try {
      const res = await listRevisions(role);
      setRevisions(res.revisions);
      setCurrentRevision(res.currentRevision);
    } catch {
      // non-fatal — revision panel just stays empty
    }
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const user = await getCurrentUser();
        if (cancelled) return;
        if (!user) {
          // Session expired between the server-side dashboard/layout.tsx
          // check and this client-side fetch — bounce to login rather than
          // rendering an editor for nobody.
          router.replace("/login");
          return;
        }
        setCurrentUser(user);
        setRole(user.role);

        const [draftRes, comps, actions, sources] = await Promise.all([
          getDraft(user.role),
          getComponentCatalog(),
          getActionCatalog(),
          getDataSourceCatalog(),
        ]);
        if (cancelled) return;
        setDraft(draftRes.content);
        setSavedJson(JSON.stringify(draftRes.content));
        setComponentCatalog(comps.components);
        setActionCatalog(actions.actions);
        setDataSourceCatalog(sources.dataSources);
        // Inline rather than via refreshRevisions(): that callback closes
        // over the `role` state, which hasn't re-rendered with the
        // just-fetched user.role yet at this point in the same effect run.
        try {
          const res = await listRevisions(user.role);
          if (!cancelled) {
            setRevisions(res.revisions);
            setCurrentRevision(res.currentRevision);
          }
        } catch {
          // non-fatal — revision panel just stays empty
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load draft.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDraft = useCallback((updater: (cfg: HomeScreenConfiguration) => HomeScreenConfiguration) => {
    setDraft((prev) => (prev ? updater(structuredClone(prev)) : prev));
  }, []);

  const replaceDraft = useCallback((cfg: HomeScreenConfiguration) => {
    setDraft(cfg);
  }, []);

  const isDirty = useMemo(() => draft !== null && JSON.stringify(draft) !== savedJson, [draft, savedJson]);

  // Warn on tab close / navigation away with unsaved changes.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await saveDraft(draft, role);
      setDraft(res.content);
      setSavedJson(JSON.stringify(res.content));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  }, [draft, role]);

  const validate = useCallback(async () => {
    if (!draft) return null;
    setValidating(true);
    try {
      const res = await validateConfig(draft, role);
      setValidation(res);
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation request failed.");
      return null;
    } finally {
      setValidating(false);
    }
  }, [draft, role]);

  const publish = useCallback(async () => {
    if (!draft) return false;
    setPublishing(true);
    setError(null);
    try {
      // Publish only ever succeeds against what's saved server-side — save first
      // so "publish" always reflects exactly what's shown as the draft.
      await saveDraft(draft, role);
      const res = await publishConfig(undefined, role);
      if (res.published) {
        setValidation({ valid: true, errors: [], warnings: res.warnings ?? [] });
        await refreshRevisions();
        return true;
      } else {
        setValidation({ valid: false, errors: res.errors ?? [], warnings: res.warnings ?? [] });
        return false;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed.");
      return false;
    } finally {
      setPublishing(false);
    }
  }, [draft, role, refreshRevisions]);

  const logout = useCallback(async () => {
    await logoutRequest();
    router.replace("/login");
    router.refresh();
  }, [router]);

  const restore = useCallback(
    async (revision: number) => {
      setError(null);
      try {
        await restoreRevision(revision, role);
        await refreshRevisions();
        const draftRes = await getDraft(role);
        setDraft(draftRes.content);
        setSavedJson(JSON.stringify(draftRes.content));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Restore failed.");
      }
    },
    [role, refreshRevisions]
  );

  const value: PortalState = {
    role,
    setRole,
    currentUser,
    logout,
    draft,
    isDirty,
    loading,
    error,
    updateDraft,
    replaceDraft,
    selectedComponentId,
    setSelectedComponentId,
    save,
    saving,
    validate,
    validating,
    validation,
    publish,
    publishing,
    revisions,
    currentRevision,
    refreshRevisions,
    restore,
    previewAudience,
    setPreviewAudience,
    previewTheme,
    setPreviewTheme,
    previewDevice,
    setPreviewDevice,
    showJsonEditor,
    setShowJsonEditor,
    componentCatalog,
    actionCatalog,
    dataSourceCatalog,
  };

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}
