"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/saberx/icon";

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

export function SourcePreview({ id, filename }: { id: string; filename: string }) {
  const ext = extensionOf(filename);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ext !== "md" && ext !== "txt") return;
    let cancelled = false;
    setTextContent(null);
    setError(null);
    fetch(`/api/sources/${id}/download?inline=1`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load contents (${r.status})`);
        const text = await r.text();
        if (!cancelled) setTextContent(text);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, ext]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "var(--panel)"
      }}
    >
      {error && (
        <div style={{ padding: 20, color: "var(--red)", fontSize: 13 }}>{error}</div>
      )}
      {ext === "pdf" && (
        <iframe
          src={`/api/sources/${id}/download?inline=1#view=FitH`}
          title={filename}
          style={{ width: "100%", flex: 1, border: 0, background: "var(--panel-2)" }}
        />
      )}
      {(ext === "md" || ext === "txt") && textContent === null && !error && (
        <div style={{ padding: 20, color: "var(--ink-3)", fontSize: 13 }}>Loading…</div>
      )}
      {(ext === "md" || ext === "txt") && textContent !== null && (
        <pre
          style={{
            margin: 0,
            padding: "18px 28px",
            fontFamily: ext === "md" ? "inherit" : "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflow: "auto",
            flex: 1
          }}
        >
          {textContent}
        </pre>
      )}
      {ext === "docx" && (
        <div style={{ padding: 24, color: "var(--ink-2)", fontSize: 13, lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 12px" }}>
            Inline preview for DOCX is not available in this version.
          </p>
          <a className="sx-btn sx-btn-primary sx-btn-sm" href={`/api/sources/${id}/download`}>
            <Icon name="download" size={12} /> Download to read
          </a>
        </div>
      )}
      {ext !== "pdf" && ext !== "md" && ext !== "txt" && ext !== "docx" && (
        <div style={{ padding: 24, color: "var(--ink-3)", fontSize: 13 }}>
          No inline preview for .{ext} files.
        </div>
      )}
    </div>
  );
}
