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
  const fileRef = useRef<HTMLInputElement>(null);

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

  const onImport = async (file: File) => {
    const name = file.name.toLowerCase();
    const isWorkbook = name.endsWith(".xlsx") || name.endsWith(".xlsm");
    const isSource =
      name.endsWith(".pdf") ||
      name.endsWith(".docx") ||
      name.endsWith(".md") ||
      name.endsWith(".txt");
    if (!isWorkbook && !isSource) {
      toast.error("Unsupported file type", {
        detail: "Excel workbooks (.xlsx, .xlsm) import as documents. PDF/DOCX/MD/TXT upload as sources."
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setImporting(true);
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const sizeLabel = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
    const progressId = toast.info(`Uploading ${file.name}…`, {
      detail: `${sizeLabel} — ${isWorkbook ? "parsing as a document" : "saving as a source"}`,
      durationMs: 0,
      loading: true
    });
    try {
      if (isWorkbook) {
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
        const newDocId = payload?.document?.id;
        if (newDocId) {
          // Walk the user through any detected cross-references in a wizard
          // before landing on the new document. If detection finds nothing
          // the wizard shows an empty state with a back link.
          router.push(`/dashboard/documents/${newDocId}/resolve-references?wizard=1`);
        } else {
          router.push("/dashboard");
        }
        router.refresh();
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
        router.push("/dashboard/sources");
        router.refresh();
      }
    } catch (err) {
      toast.dismiss(progressId);
      toast.error("Upload failed", { detail: (err as Error).message });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

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
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm,.pdf,.docx,.md,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
          }}
        />
        <button
          className="sx-btn sx-btn-sm"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          type="button"
          data-tour="topbar-import"
          title="Excel (.xlsx/.xlsm) imports as a document; PDF/DOCX/MD/TXT uploads as a source"
        >
          {importing ? (
            <Icon name="spinner" size={12} className="spin" />
          ) : (
            <Icon name="upload" size={12} />
          )}
          {importing ? "Uploading…" : "Import"}
        </button>
      </div>
    </div>
  );
}
