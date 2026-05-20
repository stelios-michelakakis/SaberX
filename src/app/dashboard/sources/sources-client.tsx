"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/saberx/icon";
import { useToast } from "@/components/saberx/toast";

export type SourceVm = {
  id: string;
  filename: string;
  displayName: string | null;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string | null;
  uploadedByUsername: string | null;
  referenceCount: number;
  createdAt: string;
  updatedAt: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

export function SourcesClient({ initialSources }: { initialSources: SourceVm[] }) {
  const router = useRouter();
  const toast = useToast();

  const [sources, setSources] = useState<SourceVm[]>(initialSources);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch("/api/sources");
    if (!r.ok) return;
    const data = (await r.json()) as { sources: SourceVm[] };
    setSources(data.sources);
  };

  const onDelete = async (id: string) => {
    const r = await fetch(`/api/sources/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const detail = await r.json().catch(() => ({}));
      const referenced = typeof detail.error === "string" && /referenced by/i.test(detail.error);
      toast.error("Could not delete source", {
        detail: referenced
          ? `${detail.error}. Open the source to see where it's used.`
          : detail.error
      });
      if (referenced) router.push(`/dashboard/sources/${id}`);
      return;
    }
    toast.success("Source deleted");
    setConfirmDeleteId(null);
    await refresh();
  };

  return (
    <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "var(--sx-radius-lg)",
          background: "var(--panel)",
          overflow: "hidden",
          boxShadow: "var(--sx-shadow-sm)"
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <colgroup>
            {/* Filename takes all remaining space; the others hug their content. */}
            <col />
            <col style={{ width: 70 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "var(--panel-2)" }}>
              <Th>Filename</Th>
              <Th align="right">Refs</Th>
              <Th>Type</Th>
              <Th align="right">Size</Th>
              <Th>Uploaded by</Th>
              <Th>Uploaded</Th>
              <Th align="right"> </Th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}
                >
                  No sources yet. Use the <strong>Import</strong> button in the top bar to upload a PDF, DOCX, MD, or TXT.
                </td>
              </tr>
            )}
            {sources.map((s) => {
              const ext = extensionOf(s.filename);
              return (
                <tr
                  key={s.id}
                  style={{ borderTop: "1px solid var(--line)", cursor: "pointer" }}
                  onClick={() => router.push(`/dashboard/sources/${s.id}`)}
                >
                  <Td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Icon
                        name="doc"
                        size={12}
                        style={{ color: "var(--accent-ink)", flex: "none" }}
                      />
                      <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                        {s.displayName?.trim() || s.filename}
                      </span>
                    </span>
                    {s.displayName?.trim() && (
                      <div
                        className="mono"
                        style={{ color: "var(--ink-4)", fontSize: 10.5, marginTop: 2 }}
                        title={s.filename}
                      >
                        {s.filename}
                      </div>
                    )}
                  </Td>
                  <Td align="right" muted mono>
                    {s.referenceCount > 0 ? (
                      <span
                        className="pill pill-accent"
                        title={`Referenced by ${s.referenceCount} cell(s)`}
                      >
                        {s.referenceCount}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td muted>
                    <span className="pill">{ext.toUpperCase() || "?"}</span>
                  </Td>
                  <Td align="right" muted mono>
                    {formatSize(s.sizeBytes)}
                  </Td>
                  <Td muted>{s.uploadedByUsername ?? "—"}</Td>
                  <Td muted>{new Date(s.createdAt).toLocaleString()}</Td>
                  <Td align="right">
                    <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <a
                        className="sx-btn sx-btn-ghost sx-btn-sm"
                        href={`/api/sources/${s.id}/download`}
                        title="Download"
                        style={{ padding: 4 }}
                      >
                        <Icon name="download" size={12} />
                      </a>
                      {confirmDeleteId === s.id ? (
                        <>
                          <button
                            type="button"
                            className="sx-btn sx-btn-sm"
                            onClick={() => onDelete(s.id)}
                            style={{ color: "var(--red)", borderColor: "var(--red)" }}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="sx-btn sx-btn-sm"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="sx-btn sx-btn-ghost sx-btn-sm"
                          onClick={() => setConfirmDeleteId(s.id)}
                          title="Delete"
                          style={{ padding: 4, color: "var(--red)" }}
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      )}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "8px 12px",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--ink-3)",
        borderBottom: "1px solid var(--line)",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  muted,
  mono
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={mono ? "mono" : undefined}
      style={{
        padding: "8px 12px",
        textAlign: align,
        color: muted ? "var(--ink-3)" : "var(--ink)",
        verticalAlign: "top"
      }}
    >
      {children}
    </td>
  );
}
