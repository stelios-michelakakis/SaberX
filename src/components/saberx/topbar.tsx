"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { useTweaks } from "./theme-provider";
import { useToast } from "./toast";
import { TweaksPanelTrigger } from "./tweaks-panel";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

export function Topbar({ breadcrumbs }: { breadcrumbs: string[] }) {
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
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import-jobs", { method: "POST", body: fd });
      if (!res.ok) {
        const text = await res.text();
        toast.error("Import failed", { detail: text.slice(0, 200) });
        return;
      }
      toast.success("Workbook imported");
      router.refresh();
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onNewDocument = async () => {
    const title = window.prompt("New document title");
    if (!title) return;
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      toast.error("Failed to create document", { detail: detail.error });
      return;
    }
    const data: { document: { id: string } } = await res.json();
    toast.success("Document created");
    router.push(`/dashboard/documents/${data.document.id}`);
    router.refresh();
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
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: 280,
          height: 30,
          padding: "0 10px",
          borderRadius: 7,
          border: "1px solid var(--line)",
          background: "var(--bg-2)",
          color: "var(--ink-3)",
          fontFamily: "inherit",
          fontSize: 12.5,
          textDecoration: "none"
        }}
      >
        <Icon name="search" size={12} />
        <span>Search documents, fields, rows…</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          className="sx-btn sx-btn-ghost sx-btn-sm"
          onClick={runUndo}
          disabled={undoing}
          title="Undo last action (⌘Z)"
          style={{ padding: 5 }}
          type="button"
        >
          <Icon name="refresh" />
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
        <div style={{ width: 1, height: 18, background: "var(--line)", margin: "0 4px" }} />
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm"
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
        >
          <Icon name="upload" size={12} />
          {importing ? "Importing…" : "Import"}
        </button>
        <button className="sx-btn sx-btn-primary sx-btn-sm" onClick={onNewDocument} type="button">
          <Icon name="plus" size={12} />
          New document
        </button>
      </div>
    </div>
  );
}
