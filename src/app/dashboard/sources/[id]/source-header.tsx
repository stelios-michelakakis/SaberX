"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/saberx/icon";
import { useToast } from "@/components/saberx/toast";

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function SourceHeader({
  id,
  filename,
  displayName: initialDisplayName,
  sizeBytes
}: {
  id: string;
  filename: string;
  displayName: string | null;
  sizeBytes: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [displayName, setDisplayName] = useState<string | null>(initialDisplayName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDisplayName ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const shown = displayName?.trim() || filename;
  const ext = extensionOf(filename);

  const commit = async () => {
    const next = draft.trim();
    const nextValue = next.length === 0 ? null : next;
    if (nextValue === displayName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nextValue })
      });
      if (!r.ok) {
        const detail = await r.json().catch(() => ({}));
        toast.error("Rename failed", { detail: detail.error });
        return;
      }
      const data = (await r.json()) as { source: { displayName: string | null } };
      setDisplayName(data.source.displayName);
      setDraft(data.source.displayName ?? "");
      setEditing(false);
      toast.success(nextValue ? "Renamed" : "Display name cleared");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        padding: "10px 20px",
        borderBottom: "1px solid var(--line)",
        background: "var(--panel)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 0
      }}
    >
      <Link
        href="/dashboard/sources"
        title="Back to sources"
        style={{
          color: "var(--ink-3)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          flex: "none"
        }}
      >
        <Icon name="arrowL" size={11} /> Sources
      </Link>
      <span style={{ color: "var(--line)" }}>/</span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setDraft(displayName ?? "");
                setEditing(false);
              }
            }}
            disabled={saving}
            placeholder={filename}
            className="input"
            style={{
              minHeight: 0,
              height: 26,
              padding: "2px 8px",
              fontSize: 13,
              fontWeight: 600,
              background: "var(--panel-2)"
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(displayName ?? "");
              setEditing(true);
            }}
            title="Click to rename"
            style={{
              all: "unset",
              cursor: "text",
              fontWeight: 600,
              fontSize: 13,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {shown}
          </button>
        )}
        {(displayName?.trim() || editing) && (
          <span
            style={{
              fontSize: 10.5,
              color: "var(--ink-4)",
              fontFamily: "var(--font-mono)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
            title={filename}
          >
            {filename}
          </span>
        )}
      </div>
      <span style={{ color: "var(--ink-4)", fontSize: 11, flex: "none" }}>
        {ext.toUpperCase() || "?"} · {formatSize(sizeBytes)}
      </span>
      <a
        className="sx-btn sx-btn-ghost sx-btn-sm"
        href={`/api/sources/${id}/download`}
        title="Download"
        style={{ flex: "none", padding: "4px 10px" }}
      >
        <Icon name="download" size={12} /> Download
      </a>
    </div>
  );
}
