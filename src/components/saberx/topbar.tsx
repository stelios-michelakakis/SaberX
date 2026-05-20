"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { useTweaks } from "./theme-provider";
import { useToast } from "./toast";
import { TweaksPanelTrigger } from "./tweaks-panel";
import { HelpMenu } from "./help-menu";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

export function Topbar({
  breadcrumbs,
  firstDocumentId,
  tutorialSeen
}: {
  breadcrumbs: string[];
  firstDocumentId?: string;
  tutorialSeen: boolean;
}) {
  const router = useRouter();
  const { tweaks, toggle } = useTweaks();
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importWrapRef = useRef<HTMLDivElement>(null);
  // Two separate hidden file inputs so each "Import as ..." choice has the
  // right accept attribute and we don't need to validate after the fact.
  const docFileRef = useRef<HTMLInputElement>(null);
  const sourceFileRef = useRef<HTMLInputElement>(null);

  const runUndo = async () => {
    if (undoing) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/me/undo", { method: "POST" });
      if (res.status === 409) {
        toast.info("Nothing to undo");
        return;
      }
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        toast.error("Undo failed", { detail: detail.error });
        return;
      }
      const data: { undone: { undoSummary: string } } = await res.json();
      toast.success("Undone", { detail: data.undone.undoSummary });
      router.refresh();
    } finally {
      setUndoing(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        router.push("/dashboard/search");
        return;
      }
      if (k === "z" && !e.shiftKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        runUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const clearFileInputs = () => {
    if (docFileRef.current) docFileRef.current.value = "";
    if (sourceFileRef.current) sourceFileRef.current.value = "";
  };

  const onImport = async (file: File, mode: "document" | "source") => {
    const name = file.name.toLowerCase();
    if (mode === "document") {
      if (!name.endsWith(".xlsx") && !name.endsWith(".xlsm")) {
        toast.error("Unsupported file type", {
          detail: "Documents must be Excel workbooks (.xlsx or .xlsm)."
        });
        clearFileInputs();
        return;
      }
    } else {
      const allowed = [".pdf", ".docx", ".md", ".txt", ".xlsx", ".xlsm", ".png", ".jpg", ".jpeg", ".gif", ".webp"];
      if (!allowed.some((ext) => name.endsWith(ext))) {
        toast.error("Unsupported source type", {
          detail: "Sources can be PDF, DOCX, MD, TXT, Excel, or common image formats."
        });
        clearFileInputs();
        return;
      }
    }

    setImporting(true);
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const sizeLabel = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
    const progressId = toast.info(`Uploading ${file.name}…`, {
      detail: `${sizeLabel} — ${mode === "document" ? "parsing as a document" : "saving as a source"}`,
      durationMs: 0,
      loading: true
    });
    try {
      if (mode === "document") {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/import-jobs", { method: "POST", body: fd });
        toast.dismiss(progressId);
        if (!res.ok) {
          const text = await res.text();
          toast.error("Import failed", { detail: text.slice(0, 200) });
          return;
        }
        const payload = (await res.json().catch(() => null)) as
          | { document?: { id: string; title: string } }
          | null;
        toast.success(`Imported ${file.name}`);
        router.refresh();
        const newDocId = payload?.document?.id;
        if (newDocId) {
          router.push(`/dashboard/documents/${newDocId}/resolve-references?wizard=1`);
        } else {
          router.push("/dashboard");
        }
      } else {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/sources", { method: "POST", body: fd });
        toast.dismiss(progressId);
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          toast.error("Upload failed", { detail: detail.error });
          return;
        }
        toast.success(`Uploaded ${file.name}`);
        router.refresh();
        router.push("/dashboard/sources");
      }
    } catch (err) {
      toast.dismiss(progressId);
      toast.error("Upload failed", { detail: (err as Error).message });
    } finally {
      setImporting(false);
      clearFileInputs();
    }
  };

  // Close the import dropdown when clicking outside.
  useEffect(() => {
    if (!importMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (importWrapRef.current && !importWrapRef.current.contains(e.target as Node)) {
        setImportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [importMenuOpen]);

  return (
    <div
      style={{
        height: 48,
        flex: "none",
        borderBottom: "1px solid var(--line)",
        background: "var(--panel)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 14px"
      }}
    >
      <button
        className="sx-btn sx-btn-ghost sx-btn-sm"
        onClick={() => toggle("sidebarCollapsed")}
        style={{ padding: 5 }}
        type="button"
        aria-label="Toggle sidebar"
      >
        <Icon name="panelL" />
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          color: "var(--ink-3)",
          flex: 1,
          minWidth: 0,
          overflow: "hidden"
        }}
      >
        {breadcrumbs.map((c, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <Icon name="chevronR" size={12} style={{ color: "var(--ink-4)" }} />}
            <span
              style={{
                color: i === breadcrumbs.length - 1 ? "var(--ink)" : "var(--ink-3)",
                fontWeight: i === breadcrumbs.length - 1 ? 500 : 400,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {c}
            </span>
          </span>
        ))}
      </div>

      <Link
        href="/dashboard/search"
        data-tour="topbar-search"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: "0 1 320px",
          minWidth: 200,
          maxWidth: 360,
          height: 30,
          padding: "0 8px 0 10px",
          borderRadius: 7,
          border: "1px solid var(--line)",
          background: "var(--bg-2)",
          color: "var(--ink-3)",
          fontFamily: "inherit",
          fontSize: 12.5,
          textDecoration: "none",
          overflow: "hidden"
        }}
      >
        <Icon name="search" size={12} style={{ flex: "none" }} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          Search documents, fields, rows…
        </span>
        <span style={{ display: "flex", gap: 3, flex: "none" }}>
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </span>
      </Link>

      <div
        style={{
          width: 1,
          height: 18,
          background: "var(--line)",
          margin: "0 2px",
          flex: "none"
        }}
      />

      <div data-tour="topbar-tools" style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          data-tour="topbar-undo"
          className="sx-btn sx-btn-ghost sx-btn-sm"
          onClick={runUndo}
          disabled={undoing}
          title="Undo last action (⌘Z)"
          style={{ padding: 5 }}
          type="button"
          aria-label="Undo last action"
        >
          <Icon name="undo" />
        </button>
        <button
          className="sx-btn sx-btn-ghost sx-btn-sm"
          onClick={() => toggle("theme")}
          title="Toggle theme"
          style={{ padding: 5 }}
          type="button"
        >
          <Icon name={tweaks.theme === "dark" ? "sun" : "moon"} />
        </button>
        <TweaksPanelTrigger />
        <HelpMenu firstDocumentId={firstDocumentId} tutorialSeen={tutorialSeen} />
        <div style={{ width: 1, height: 18, background: "var(--line)", margin: "0 4px" }} />
        <input
          ref={docFileRef}
          type="file"
          accept=".xlsx,.xlsm"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f, "document");
          }}
        />
        <input
          ref={sourceFileRef}
          type="file"
          accept=".pdf,.docx,.md,.txt,.xlsx,.xlsm,.png,.jpg,.jpeg,.gif,.webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f, "source");
          }}
        />
        <div ref={importWrapRef} style={{ position: "relative" }}>
          <button
            className="sx-btn sx-btn-sm"
            onClick={() => setImportMenuOpen((v) => !v)}
            disabled={importing}
            type="button"
            data-tour="topbar-import"
            aria-haspopup="menu"
            aria-expanded={importMenuOpen}
          >
            {importing ? (
              <Icon name="spinner" size={12} className="spin" />
            ) : (
              <Icon name="upload" size={12} />
            )}
            {importing ? "Uploading…" : "Import"}
            <Icon name="chevronD" size={10} style={{ marginLeft: 2, opacity: 0.7 }} />
          </button>
          {importMenuOpen && !importing && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                minWidth: 240,
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                boxShadow:
                  "0 1px 0 rgba(0,0,0,0.04), 0 8px 24px -8px rgba(0,0,0,0.2), 0 16px 48px -12px rgba(0,0,0,0.22)",
                padding: 4,
                zIndex: 60
              }}
            >
              <ImportMenuItem
                title="Import document"
                detail="Excel workbook (.xlsx / .xlsm)"
                onClick={() => {
                  setImportMenuOpen(false);
                  docFileRef.current?.click();
                }}
              />
              <ImportMenuItem
                title="Import source"
                detail="PDF, DOCX, MD, TXT, Excel, or image"
                onClick={() => {
                  setImportMenuOpen(false);
                  sourceFileRef.current?.click();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportMenuItem({
  title,
  detail,
  onClick
}: {
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "8px 10px",
        borderRadius: 6,
        width: "100%",
        boxSizing: "border-box"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>{title}</span>
      <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{detail}</span>
    </button>
  );
}
