"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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

const SUPPORTED_ACCEPT = ".pdf,.docx,.md,.txt";
const MAX_BYTES = 50 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

function iconFor(ext: string): string {
  if (ext === "pdf") return "doc";
  if (ext === "docx") return "doc";
  if (ext === "md" || ext === "txt") return "doc";
  return "doc";
}

export function SourcesClient({ initialSources }: { initialSources: SourceVm[] }) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [sources, setSources] = useState<SourceVm[]>(initialSources);
  const [filter, setFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingName, setPendingName] = useState("");

  useEffect(() => {
    if (searchParams?.get("upload") === "1") {
      fileRef.current?.click();
      const next = new URLSearchParams(searchParams.toString());
      next.delete("upload");
      router.replace(`/dashboard/sources${next.toString() ? `?${next}` : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.get("upload")]);

  const refresh = async () => {
    const r = await fetch("/api/sources");
    if (!r.ok) return;
    const data = (await r.json()) as { sources: SourceVm[] };
    setSources(data.sources);
  };

  const queueUpload = (file: File) => {
    if (file.size === 0) {
      toast.error("File is empty");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File too large", { detail: `Max ${formatSize(MAX_BYTES)}` });
      return;
    }
    setPendingFile(file);
    // Pre-fill with the filename minus extension so users can shorten quickly.
    const dot = file.name.lastIndexOf(".");
    setPendingName(dot > 0 ? file.name.slice(0, dot) : file.name);
  };

  const cancelPending = () => {
    setPendingFile(null);
    setPendingName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmPending = async () => {
    if (!pendingFile) return;
    const file = pendingFile;
    const displayName = pendingName.trim();

    setUploading(true);
    setPendingFile(null);
    const progressId = toast.info(`Uploading ${displayName || file.name}…`, {
      detail: formatSize(file.size),
      durationMs: 0,
      loading: true
    });
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (displayName) fd.append("displayName", displayName);
      const r = await fetch("/api/sources", { method: "POST", body: fd });
      toast.dismiss(progressId);
      if (!r.ok) {
        const detail = await r.json().catch(() => ({}));
        toast.error("Upload failed", { detail: detail.error });
        return;
      }
      toast.success(`Uploaded ${displayName || file.name}`);
      await refresh();
    } catch (err) {
      toast.dismiss(progressId);
      toast.error("Upload failed", { detail: (err as Error).message });
    } finally {
      setUploading(false);
      setPendingName("");
      if (fileRef.current) fileRef.current.value = "";
    }
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

  const filtered = useMemo(() => {
    if (!filter.trim()) return sources;
    const q = filter.toLowerCase();
    return sources.filter(
      (s) =>
        s.filename.toLowerCase().includes(q) ||
        (s.displayName ?? "").toLowerCase().includes(q) ||
        (s.uploadedByUsername ?? "").toLowerCase().includes(q)
    );
  }, [sources, filter]);

  return (
    <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          padding: "10px 14px",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "var(--sx-radius-lg)",
          boxShadow: "var(--sx-shadow-sm)"
        }}
      >
        <Icon name="filter" size={12} style={{ color: "var(--ink-3)" }} />
        <input
          className="input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by filename or uploader…"
          style={{
            height: 30,
            minHeight: 0,
            flex: 1,
            padding: "4px 10px",
            fontSize: 12.5
          }}
        />
        <span style={{ color: "var(--ink-3)", fontSize: 12 }}>
          {filtered.length} of {sources.length}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept={SUPPORTED_ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) queueUpload(f);
          }}
        />
        <button
          type="button"
          className="sx-btn sx-btn-primary sx-btn-sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Icon name="upload" size={12} />
          {uploading ? "Uploading…" : "Upload source"}
        </button>
      </div>

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
          <thead>
            <tr style={{ background: "var(--panel-2)" }}>
              <Th>Filename</Th>
              <Th>Type</Th>
              <Th align="right">Size</Th>
              <Th align="right">Refs</Th>
              <Th>Uploaded by</Th>
              <Th>Uploaded</Th>
              <Th align="right"> </Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}
                >
                  {sources.length === 0
                    ? "No sources yet. Upload a PDF, DOCX, MD, or TXT file to get started."
                    : "No sources match this filter."}
                </td>
              </tr>
            )}
            {filtered.map((s) => {
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
                        name={iconFor(ext)}
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
                  <Td muted>
                    <span className="pill">{ext.toUpperCase() || "?"}</span>
                  </Td>
                  <Td align="right" muted mono>
                    {formatSize(s.sizeBytes)}
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

      {pendingFile && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={cancelPending}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--panel)",
              color: "var(--ink)",
              borderRadius: "var(--sx-radius-lg)",
              width: "min(480px, 100%)",
              padding: 18,
              boxShadow: "var(--sx-shadow-lg)",
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>Give this source a display name</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
              {pendingFile.name} · {formatSize(pendingFile.size)} — the original filename is
              kept for downloads. The display name is what shows up in reference chips and the
              sidebar.
            </div>
            <input
              className="input"
              autoFocus
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmPending();
                } else if (e.key === "Escape") {
                  cancelPending();
                }
              }}
              placeholder={pendingFile.name}
              style={{ height: 32, padding: "4px 10px", fontSize: 13 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="sx-btn sx-btn-sm"
                onClick={cancelPending}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sx-btn sx-btn-primary sx-btn-sm"
                onClick={confirmPending}
                disabled={uploading || !pendingName.trim()}
              >
                <Icon name="upload" size={12} /> Upload
              </button>
            </div>
          </div>
        </div>
      )}
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
