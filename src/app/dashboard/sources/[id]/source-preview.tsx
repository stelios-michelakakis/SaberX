"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/saberx/icon";

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const EXCEL_EXTS = new Set(["xlsx", "xlsm"]);

export function SourcePreview({ id, filename }: { id: string; filename: string }) {
  const ext = extensionOf(filename);

  if (ext === "pdf") {
    return (
      <Frame>
        <iframe
          src={`/api/sources/${id}/download?inline=1#view=FitH`}
          title={filename}
          style={{ width: "100%", flex: 1, border: 0, background: "var(--panel-2)" }}
        />
      </Frame>
    );
  }
  if (ext === "md" || ext === "txt") {
    return (
      <Frame>
        <TextPreview id={id} ext={ext} />
      </Frame>
    );
  }
  if (IMAGE_EXTS.has(ext)) {
    return (
      <Frame>
        <ImagePreview id={id} filename={filename} />
      </Frame>
    );
  }
  if (EXCEL_EXTS.has(ext)) {
    return (
      <Frame>
        <ExcelPreview id={id} />
      </Frame>
    );
  }
  if (ext === "docx") {
    return (
      <Frame>
        <UnsupportedNote id={id} message="Inline preview for DOCX is not available in this version." />
      </Frame>
    );
  }
  return (
    <Frame>
      <div style={{ padding: 24, color: "var(--ink-3)", fontSize: 13 }}>
        No inline preview for .{ext} files.
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
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
      {children}
    </div>
  );
}

function TextPreview({ id, ext }: { id: string; ext: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setError(null);
    fetch(`/api/sources/${id}/download?inline=1`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load contents (${r.status})`);
        const body = await r.text();
        if (!cancelled) setText(body);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorNote message={error} />;
  if (text === null) return <LoadingNote />;
  return (
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
      {text}
    </pre>
  );
}

function ImagePreview({ id, filename }: { id: string; filename: string }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--panel-2)",
        padding: 24,
        overflow: "auto"
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/sources/${id}/download?inline=1`}
        alt={filename}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          background: "var(--panel)",
          borderRadius: 6,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
        }}
      />
    </div>
  );
}

type PreviewData = {
  sheets: string[];
  activeSheet: string | null;
  rows: (string | number | boolean | null)[][];
  truncated?: { rows: boolean; cols: boolean; maxRows: number; maxCols: number };
};

function ExcelPreview({ id }: { id: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    const url = active
      ? `/api/sources/${id}/preview?sheet=${encodeURIComponent(active)}`
      : `/api/sources/${id}/preview`;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const detail = await r.json().catch(() => ({}));
          throw new Error(detail.error || `Preview failed (${r.status})`);
        }
        const json = (await r.json()) as PreviewData;
        if (cancelled) return;
        setData(json);
        if (!active && json.activeSheet) setActive(json.activeSheet);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, active]);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <LoadingNote />;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {data.sheets.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: "0 20px",
            borderBottom: "1px solid var(--line)",
            background: "var(--panel-2)",
            overflowX: "auto"
          }}
        >
          {data.sheets.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActive(s)}
              style={{
                border: 0,
                background: "transparent",
                padding: "8px 12px",
                fontSize: 12,
                fontFamily: "inherit",
                color: s === data.activeSheet ? "var(--ink)" : "var(--ink-3)",
                fontWeight: s === data.activeSheet ? 500 : 400,
                borderBottom:
                  s === data.activeSheet ? "2px solid var(--ink)" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {data.rows.length === 0 ? (
          <div style={{ color: "var(--ink-3)", fontSize: 13 }}>This sheet is empty.</div>
        ) : (
          <table
            style={{
              borderCollapse: "collapse",
              fontSize: 12.5,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            <thead>
              <tr style={{ background: "var(--panel-2)" }}>
                {data.rows[0].map((_, colIdx) => (
                  <th
                    key={colIdx}
                    style={{
                      padding: "6px 10px",
                      textAlign: "left",
                      borderBottom: "1px solid var(--line)",
                      borderRight: "1px solid var(--line)",
                      fontSize: 10.5,
                      fontWeight: 500,
                      color: "var(--ink-4)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {columnLabel(colIdx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, rIdx) => (
                <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? "transparent" : "var(--panel-2)" }}>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        padding: "6px 10px",
                        borderBottom: "1px solid var(--line)",
                        borderRight: "1px solid var(--line)",
                        verticalAlign: "top",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        color: rIdx === 0 ? "var(--ink)" : "var(--ink-2)",
                        fontWeight: rIdx === 0 ? 600 : 400,
                        maxWidth: 360
                      }}
                    >
                      {cell == null ? "" : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.truncated && (data.truncated.rows || data.truncated.cols) && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--ink-4)" }}>
            Preview truncated to {data.truncated.maxRows} rows × {data.truncated.maxCols} columns.
            Download the file for the full content.
          </div>
        )}
      </div>
    </div>
  );
}

function columnLabel(index: number): string {
  // 0 → A, 25 → Z, 26 → AA, etc.
  let n = index;
  let label = "";
  while (true) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return label;
}

function UnsupportedNote({ id, message }: { id: string; message: string }) {
  return (
    <div style={{ padding: 24, color: "var(--ink-2)", fontSize: 13, lineHeight: 1.6 }}>
      <p style={{ margin: "0 0 12px" }}>{message}</p>
      <a className="sx-btn sx-btn-primary sx-btn-sm" href={`/api/sources/${id}/download`}>
        <Icon name="download" size={12} /> Download to read
      </a>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return <div style={{ padding: 20, color: "var(--red)", fontSize: 13 }}>{message}</div>;
}

function LoadingNote() {
  return <div style={{ padding: 20, color: "var(--ink-3)", fontSize: 13 }}>Loading…</div>;
}
