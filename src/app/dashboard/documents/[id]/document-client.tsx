"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/saberx/icon";
import { useToast } from "@/components/saberx/toast";
import { Cell, cellDisplay, readCell, type FieldVm } from "./cell-editor";
import { EditDocumentModal } from "./edit-document-modal";
import { NewSheetModal } from "./new-sheet-modal";

type DocumentVm = {
  id: string;
  title: string;
  description: string;
  status: string;
  classification: string;
  baselineState: string;
  templateType: string | null;
  version: number;
};

type SheetVm = {
  id: string;
  name: string;
  sheetKind: string;
  isSystemReserved: boolean;
  displayOrder: number;
  description: string;
};

type RowVm = {
  id: string;
  visibleId: string;
  cells: Record<string, unknown>;
  version: number;
};

type GridResponse = {
  sheet: { id: string; name: string; sheetKind: string };
  fields: FieldVm[];
  rows: RowVm[];
};

const STATUS_PILL: Record<string, string> = {
  draft: "pill",
  baselined: "pill pill-green",
  under_review: "pill pill-amber",
  superseded: "pill",
  seed: "pill"
};

function formatStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DocumentClient({
  document,
  sheets,
  activeSheetId
}: {
  document: DocumentVm;
  sheets: SheetVm[];
  activeSheetId: string;
}) {
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [creatingRow, setCreatingRow] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newSheetOpen, setNewSheetOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const refreshGrid = async () => {
    if (!grid) return;
    const r = await fetch(`/api/sheets/${grid.sheet.id}`);
    if (r.ok) setGrid((await r.json()) as GridResponse);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const activeSheet = sheets.find((s) => s.id === activeSheetId);
    const isInstructions = activeSheet?.sheetKind === "instructions";
    const url = `/api/sheets/${activeSheetId}`;
    const initialFetch = isInstructions
      ? fetch(`/api/sheets/${activeSheetId}/instructions-ready`, { method: "POST" })
      : fetch(url);

    initialFetch
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load sheet (${r.status})`);
        const json = (await r.json()) as GridResponse;
        if (cancelled) return;
        setGrid(json);
        setSelectedRow(json.rows[0]?.id ?? null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSheetId, sheets]);

  const onSelectSheet = (sheetId: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set("sheet", sheetId);
    router.push(`/dashboard/documents/${document.id}?${params.toString()}`);
  };

  const onCreateRow = async () => {
    if (!grid || creatingRow) return;
    setCreatingRow(true);
    try {
      const res = await fetch(`/api/sheets/${grid.sheet.id}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cells: {} })
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        toast.error("Failed to create row", { detail: detail.error });
        return;
      }
      await refreshGrid();
    } finally {
      setCreatingRow(false);
    }
  };

  const callUndo = async () => {
    const res = await fetch("/api/me/undo", { method: "POST" });
    if (res.status === 409) {
      toast.info("Nothing to undo");
      return;
    }
    if (!res.ok) {
      toast.error("Undo failed");
      return;
    }
    await refreshGrid();
    router.refresh();
  };

  const onDeleteRow = async (rowId: string) => {
    if (!grid) return;
    const visible = grid.rows.find((r) => r.id === rowId)?.visibleId ?? rowId.slice(0, 8);
    setGrid((g) => (g ? { ...g, rows: g.rows.filter((r) => r.id !== rowId) } : g));
    if (selectedRow === rowId) setSelectedRow(null);

    const res = await fetch(`/api/rows/${rowId}`, { method: "DELETE" });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      toast.error("Could not delete row", { detail: detail.error });
      await refreshGrid();
      return;
    }
    toast.success(`Deleted row ${visible}`, {
      action: { label: "Undo", onClick: callUndo }
    });
    await refreshGrid();
  };

  const onPatchCell = async (rowId: string, fieldId: string, value: unknown) => {
    const res = await fetch(`/api/rows/${rowId}/cells`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldId, value })
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      toast.error("Cell update failed", { detail: detail.error });
      return;
    }
    await refreshGrid();
  };

  const onSnapshot = async () => {
    const name = window.prompt("Snapshot name", `Baseline ${new Date().toISOString().slice(0, 10)}`);
    if (!name) return;
    const reason = window.prompt("Reason (optional)") ?? undefined;
    const res = await fetch(`/api/documents/${document.id}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, reason })
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      toast.error("Failed to create snapshot", { detail: detail.error });
      return;
    }
    startTransition(() => router.refresh());
    toast.success("Snapshot created", { detail: name });
  };

  const onExport = () => {
    window.location.href = `/api/documents/${document.id}/export-jobs`;
  };

  const onPreviewDelete = async () => {
    const res = await fetch("/api/impact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "document_delete", entityId: document.id })
    });
    if (!res.ok) {
      setConfirmingDelete(true);
      return;
    }
    const impact: {
      blocked: boolean;
      blockers: string[];
      affectedSheets?: number;
      affectedRows?: number;
    } = await res.json();
    if (impact.blocked) {
      toast.error("Cannot delete", { detail: impact.blockers[0] });
      return;
    }
    if ((impact.affectedRows ?? 0) > 0) {
      toast.info("Deleting will archive", {
        detail: `${impact.affectedSheets ?? 0} sheet(s), ${impact.affectedRows ?? 0} row(s) will be soft-deleted.`
      });
    }
    setConfirmingDelete(true);
  };

  const onDeleteDocument = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        toast.error("Failed to delete document", { detail: detail.error });
        return;
      }
      toast.success(`Deleted ${document.title}`, {
        action: { label: "Undo", onClick: callUndo }
      });
      router.push("/dashboard");
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const headerActions = (
    <>
      <button
        className="sx-btn sx-btn-sm"
        type="button"
        onClick={() => setEditOpen(true)}
        title="Edit document metadata"
      >
        <Icon name="edit" size={12} /> Edit
      </button>
      <button
        className="sx-btn sx-btn-sm"
        type="button"
        onClick={() => setNewSheetOpen(true)}
        title="Add a new sheet"
      >
        <Icon name="plus" size={12} /> New sheet
      </button>
      <Link href={`/dashboard/schema/${activeSheetId}`} className="sx-btn sx-btn-sm">
        <Icon name="schema" size={12} /> Schema
      </Link>
      <button className="sx-btn sx-btn-sm" type="button" onClick={onExport}>
        <Icon name="download" size={12} /> Export
      </button>
      <button className="sx-btn sx-btn-sm" type="button" onClick={onSnapshot}>
        <Icon name="history" size={12} /> Snapshot
      </button>
      {confirmingDelete ? (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Delete this document?</span>
          <button
            className="sx-btn sx-btn-sm"
            type="button"
            onClick={onDeleteDocument}
            disabled={deleting}
            style={{
              color: "var(--red)",
              borderColor: "var(--red)",
              background: "var(--red-soft)"
            }}
          >
            <Icon name="trash" size={12} /> {deleting ? "Deleting…" : "Confirm"}
          </button>
          <button
            className="sx-btn sx-btn-sm"
            type="button"
            onClick={() => setConfirmingDelete(false)}
            disabled={deleting}
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          className="sx-btn sx-btn-sm"
          type="button"
          onClick={onPreviewDelete}
          title="Delete document"
          style={{ color: "var(--red)" }}
        >
          <Icon name="trash" size={12} /> Delete
        </button>
      )}
    </>
  );

  const activeSheet = sheets.find((s) => s.id === activeSheetId);
  const isInstructions = activeSheet?.sheetKind === "instructions";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div
        style={{
          padding: "20px 28px 16px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)"
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: 4
              }}
            >
              {(document.templateType || "Document").toUpperCase()}
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.015em"
              }}
            >
              {document.title}
            </h1>
            {document.description && (
              <p
                style={{
                  margin: "6px 0 0",
                  color: "var(--ink-3)",
                  fontSize: 13,
                  maxWidth: 720,
                  lineHeight: 1.5
                }}
              >
                {document.description}
              </p>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <span className={STATUS_PILL[document.status] ?? "pill"}>
                {formatStatus(document.status)}
              </span>
              <span className="pill mono">{document.baselineState}</span>
              <span className="pill">{document.classification.toUpperCase()}</span>
              <span className="pill">v{document.version}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {headerActions}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "0 28px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
          overflowX: "auto"
        }}
      >
        {sheets.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectSheet(s.id)}
            style={{
              border: 0,
              background: "transparent",
              padding: "10px 14px",
              fontSize: 12.5,
              fontFamily: "inherit",
              color: s.id === activeSheetId ? "var(--ink)" : "var(--ink-3)",
              borderBottom:
                s.id === activeSheetId ? "2px solid var(--ink)" : "2px solid transparent",
              fontWeight: s.id === activeSheetId ? 500 : 400,
              cursor: "pointer",
              whiteSpace: "nowrap",
              letterSpacing: s.isSystemReserved ? "0.04em" : "normal",
              textTransform: s.isSystemReserved ? "uppercase" : "none"
            }}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "16px 28px" }}>
          {loading && <div style={{ color: "var(--ink-3)" }}>Loading sheet…</div>}
          {error && <div style={{ color: "var(--red)" }}>{error}</div>}
          {grid && isInstructions && (
            <InstructionsView
              grid={grid}
              onPatchCell={onPatchCell}
              docDescription={document.description}
            />
          )}
          {grid && !isInstructions && (
            <Grid
              grid={grid}
              selectedRow={selectedRow}
              onSelectRow={setSelectedRow}
              onPatchCell={onPatchCell}
              onDeleteRow={onDeleteRow}
              onCreateRow={onCreateRow}
              creatingRow={creatingRow}
            />
          )}
        </div>
        {grid && !isInstructions && grid.sheet.sheetKind !== "glossary" && (
          <Inspector grid={grid} selectedRowId={selectedRow} />
        )}
      </div>

      {editOpen && (
        <EditDocumentModal
          document={document}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            router.refresh();
          }}
        />
      )}

      {newSheetOpen && (
        <NewSheetModal
          documentId={document.id}
          onClose={() => setNewSheetOpen(false)}
          onCreated={(newSheetId) => {
            setNewSheetOpen(false);
            router.push(`/dashboard/documents/${document.id}?sheet=${newSheetId}`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function InstructionsView({
  grid,
  onPatchCell,
  docDescription: _docDescription
}: {
  grid: GridResponse;
  onPatchCell: (rowId: string, fieldId: string, value: unknown) => void;
  docDescription: string;
}) {
  const bodyField = grid.fields.find((f) => f.slug === "body") ?? grid.fields[0];
  const row = grid.rows[0];
  const [draft, setDraft] = useState<string>(() => {
    if (!row || !bodyField) return "";
    return cellDisplay(readCell(row, bodyField));
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!row || !bodyField) return;
    setDraft(cellDisplay(readCell(row, bodyField)));
  }, [row?.id, bodyField?.id]);

  if (!bodyField || !row) {
    return <div style={{ color: "var(--ink-3)" }}>Initialising instructions…</div>;
  }

  const onSave = async () => {
    setSaving(true);
    try {
      await onPatchCell(row.id, bodyField.id, draft);
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--sx-radius-lg)",
        background: "var(--panel)",
        boxShadow: "var(--sx-shadow-sm)",
        maxWidth: 880,
        margin: "0 auto"
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 12
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            textTransform: "uppercase",
            letterSpacing: "0.06em"
          }}
        >
          Document instructions
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {savedAt && (
            <span style={{ color: "var(--ink-3)", fontSize: 11.5 }}>Saved {savedAt}</span>
          )}
          <button
            className="sx-btn sx-btn-primary sx-btn-sm"
            type="button"
            onClick={onSave}
            disabled={saving}
          >
            <Icon name="check" size={12} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <textarea
        className="textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Document-specific guidance, conventions, points of contact…"
        style={{
          minHeight: 360,
          width: "100%",
          border: 0,
          borderRadius: 0,
          background: "var(--panel)",
          color: "var(--ink)",
          fontFamily: "var(--font-ui)",
          fontSize: 13.5,
          lineHeight: 1.6,
          padding: "16px 18px",
          resize: "vertical",
          outline: "none"
        }}
      />
    </div>
  );
}

function Grid({
  grid,
  selectedRow,
  onSelectRow,
  onPatchCell,
  onDeleteRow,
  onCreateRow,
  creatingRow
}: {
  grid: GridResponse;
  selectedRow: string | null;
  onSelectRow: (id: string) => void;
  onPatchCell: (rowId: string, fieldId: string, value: unknown) => void;
  onDeleteRow: (rowId: string) => void;
  onCreateRow: () => void;
  creatingRow: boolean;
}) {
  const colCount = grid.fields.length + 1;
  const systemManaged = grid.sheet.sheetKind === "glossary";
  return (
    <>
      {systemManaged && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            border: "1px solid var(--line)",
            borderLeft: "3px solid var(--sx-accent)",
            borderRadius: "var(--sx-radius)",
            background: "var(--panel-2)",
            color: "var(--ink-2)",
            fontSize: 12.5,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <Icon name="info" size={12} style={{ color: "var(--sx-accent)" }} />
          <span>
            <strong>Glossary is system-managed.</strong> Entries are generated automatically from
            this document&apos;s schema.
          </span>
        </div>
      )}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "var(--sx-radius-lg)",
          background: "var(--panel)",
          overflow: "auto",
          boxShadow: "var(--sx-shadow-sm)"
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--panel-2)", position: "sticky", top: 0, zIndex: 1 }}>
              {grid.fields.map((f) => (
                <th
                  key={f.id}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--ink-3)",
                    borderBottom: "1px solid var(--line)",
                    whiteSpace: "nowrap"
                  }}
                  title={f.description}
                >
                  {f.label}
                  {f.required && <span style={{ color: "var(--red)", marginLeft: 4 }}>*</span>}
                </th>
              ))}
              <th
                style={{
                  width: 36,
                  borderBottom: "1px solid var(--line)",
                  background: "var(--panel-2)"
                }}
              />
            </tr>
          </thead>
          <tbody>
            {grid.rows.length === 0 && (
              <tr>
                <td
                  colSpan={colCount}
                  style={{ padding: 28, textAlign: "center", color: "var(--ink-3)" }}
                >
                  No rows yet — click <strong>+ Add row</strong> below to create the first one.
                </td>
              </tr>
            )}
            {grid.rows.map((row) => {
              const active = row.id === selectedRow;
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectRow(row.id)}
                  style={{
                    borderTop: "1px solid var(--line)",
                    background: active ? "var(--accent-soft)" : undefined,
                    cursor: "pointer",
                    height: "var(--row-h)"
                  }}
                >
                  {grid.fields.map((f) => (
                    <Cell
                      key={f.id}
                      field={f}
                      rowId={row.id}
                      sheetId={grid.sheet.id}
                      value={readCell(row, f)}
                      editable={f.editable && !f.isIdField}
                      onCommit={(v) => onPatchCell(row.id, f.id, v)}
                    />
                  ))}
                  <td style={{ padding: "0 6px", textAlign: "right" }}>
                    {systemManaged ? null : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRow(row.id);
                        }}
                        className="sx-btn sx-btn-ghost sx-btn-sm"
                        style={{ padding: 3 }}
                        aria-label="Delete row"
                        title="Delete row"
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!systemManaged && (
              <AddRowFooter colCount={colCount} onClick={onCreateRow} busy={creatingRow} />
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AddRowFooter({
  colCount,
  onClick,
  busy
}: {
  colCount: number;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <tr
      onClick={() => {
        if (!busy) onClick();
      }}
      style={{
        borderTop: "1px dashed var(--line-strong)",
        cursor: busy ? "progress" : "pointer",
        background: "var(--panel-2)"
      }}
    >
      <td
        colSpan={colCount}
        style={{
          padding: "10px 12px",
          color: "var(--ink-3)",
          fontSize: 12.5,
          fontWeight: 500
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: busy ? "var(--ink-4)" : "var(--ink-3)"
          }}
        >
          <Icon name="plus" size={12} />
          {busy ? "Adding row…" : "Add row"}
        </span>
      </td>
    </tr>
  );
}

function Inspector({
  grid,
  selectedRowId
}: {
  grid: GridResponse;
  selectedRowId: string | null;
}) {
  const row = selectedRowId ? grid.rows.find((r) => r.id === selectedRowId) : null;
  return (
    <aside
      style={{
        width: 320,
        flex: "none",
        borderLeft: "1px solid var(--line)",
        background: "var(--panel-2)",
        overflowY: "auto",
        padding: 18
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 10
        }}
      >
        Row inspector
      </div>
      {!row && <div style={{ color: "var(--ink-3)", fontSize: 12.5 }}>Select a row to inspect.</div>}
      {row && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="mono" style={{ color: "var(--accent-ink)", fontSize: 13 }}>
            {row.visibleId || row.id.slice(0, 8)}
          </div>
          {grid.fields.map((f) => (
            <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--ink-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em"
                }}
                title={f.description}
              >
                {f.label}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-2)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word"
                }}
              >
                {cellDisplay(readCell(row, f)) || (
                  <span style={{ color: "var(--ink-4)" }}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
