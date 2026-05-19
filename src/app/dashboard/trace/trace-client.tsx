"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/saberx/icon";
import { TraceGraph } from "./trace-graph";

export type TraceLink = {
  sourceRowId: string;
  sourceFieldId: string;
  targetRowId: string;
  sourceDisplay?: string | null;
  sourceDisplayField?: string | null;
  targetDisplay?: string | null;
  targetDisplayField?: string | null;
};

export type TraceRow = {
  id: string;
  visibleId: string | null;
  sheetId: string;
  sheetName: string;
  documentId: string;
  documentTitle: string;
};

export type TraceSheet = {
  id: string;
  name: string;
  sheetKind: string;
  documentId: string;
  documentTitle: string;
};

type Mode = "table" | "graph";

export function TraceClient({
  links,
  rows,
  sheets,
  fields,
  documents,
  initialDocumentId
}: {
  links: TraceLink[];
  rows: TraceRow[];
  sheets: TraceSheet[];
  fields: { id: string; label: string }[];
  documents: { id: string; title: string }[];
  initialDocumentId: string;
}) {
  const [mode, setMode] = useState<Mode>("graph");
  const [sourceDocId, setSourceDocId] = useState(initialDocumentId);
  const [targetDocId, setTargetDocId] = useState("");

  const rowMap = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sheetMap = useMemo(() => new Map(sheets.map((s) => [s.id, s])), [sheets]);
  const fieldMap = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);

  const filteredLinks = useMemo(() => {
    if (!sourceDocId && !targetDocId) return links;
    return links.filter((l) => {
      const src = rowMap.get(l.sourceRowId);
      const tgt = rowMap.get(l.targetRowId);
      const matchSrc = !sourceDocId || src?.documentId === sourceDocId;
      const matchTgt = !targetDocId || tgt?.documentId === targetDocId;
      return matchSrc && matchTgt;
    });
  }, [links, sourceDocId, targetDocId, rowMap]);

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
          boxShadow: "var(--sx-shadow-sm)",
          flexWrap: "wrap"
        }}
      >
        <div
          style={{
            display: "inline-flex",
            background: "var(--bg-2)",
            padding: 2,
            borderRadius: 6,
            border: "1px solid var(--line)"
          }}
        >
          {(["graph", "table"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                fontSize: 11.5,
                padding: "4px 10px",
                border: 0,
                borderRadius: 4,
                cursor: "pointer",
                background: mode === m ? "var(--panel)" : "transparent",
                color: mode === m ? "var(--ink)" : "var(--ink-3)",
                fontWeight: mode === m ? 500 : 400,
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Icon name={m === "graph" ? "trace" : "list"} size={12} />
              {m === "graph" ? "Graph" : "Table"}
            </button>
          ))}
        </div>
        <Icon name="filter" size={12} style={{ color: "var(--ink-3)", marginLeft: 6 }} />
        <DocFilter
          label="Source"
          value={sourceDocId}
          onChange={setSourceDocId}
          documents={documents}
        />
        <Icon name="arrowR" size={12} style={{ color: "var(--ink-4)" }} />
        <DocFilter
          label="Target"
          value={targetDocId}
          onChange={setTargetDocId}
          documents={documents}
        />
        {(sourceDocId || targetDocId) && (
          <button
            type="button"
            className="sx-btn sx-btn-sm"
            onClick={() => {
              setSourceDocId("");
              setTargetDocId("");
            }}
          >
            <Icon name="x" size={12} /> Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", color: "var(--ink-3)", fontSize: 12 }}>
          {filteredLinks.length} link{filteredLinks.length === 1 ? "" : "s"} shown
        </span>
      </div>

      {mode === "table" ? (
        <TraceTable
          links={filteredLinks}
          rowMap={rowMap}
          sheetMap={sheetMap}
          fieldMap={fieldMap}
        />
      ) : (
        <TraceGraph
          links={filteredLinks}
          rowMap={rowMap}
          sheetMap={sheetMap}
          documentFilterId={sourceDocId || targetDocId || null}
        />
      )}
    </div>
  );
}

function TraceTable({
  links,
  rowMap,
  sheetMap,
  fieldMap
}: {
  links: TraceLink[];
  rowMap: Map<string, TraceRow>;
  sheetMap: Map<string, TraceSheet>;
  fieldMap: Map<string, { id: string; label: string }>;
}) {
  return (
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
            <Th>Source</Th>
            <Th>From sheet</Th>
            <Th>Field</Th>
            <Th>→</Th>
            <Th>Target</Th>
            <Th>To sheet</Th>
          </tr>
        </thead>
        <tbody>
          {links.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>
                No links match this filter.
              </td>
            </tr>
          )}
          {links.map((link, i) => {
            const src = rowMap.get(link.sourceRowId);
            const tgt = rowMap.get(link.targetRowId);
            const srcSheet = src ? sheetMap.get(src.sheetId) : null;
            const field = fieldMap.get(link.sourceFieldId);
            return (
              <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                <Td>
                  <DisplayCell
                    display={link.sourceDisplay}
                    displayField={link.sourceDisplayField}
                    visibleId={src?.visibleId || link.sourceRowId.slice(0, 8)}
                  />
                </Td>
                <Td muted>
                  {srcSheet ? (
                    <Link
                      href={`/dashboard/documents/${srcSheet.documentId}?sheet=${srcSheet.id}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {srcSheet.documentTitle} · {srcSheet.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td muted>{field?.label ?? "—"}</Td>
                <Td>
                  <Icon name="arrowR" size={12} style={{ color: "var(--ink-4)" }} />
                </Td>
                <Td>
                  {tgt ? (
                    <Link
                      href={`/dashboard/documents/${tgt.documentId}?sheet=${tgt.sheetId}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      <DisplayCell
                        display={link.targetDisplay}
                        displayField={link.targetDisplayField}
                        visibleId={tgt.visibleId || link.targetRowId.slice(0, 8)}
                      />
                    </Link>
                  ) : (
                    <span className="mono" style={{ color: "var(--ink-4)", fontSize: 11.5 }}>
                      missing
                    </span>
                  )}
                </Td>
                <Td muted>{tgt ? `${tgt.documentTitle} · ${tgt.sheetName}` : "—"}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DisplayCell({
  display,
  displayField,
  visibleId
}: {
  display?: string | null;
  displayField?: string | null;
  visibleId: string;
}) {
  if (display) {
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.2 }}>
        <span style={{ color: "var(--ink)", fontSize: 12.5 }}>
          {displayField && (
            <span style={{ color: "var(--ink-4)", fontSize: 11, marginRight: 4 }}>
              {displayField}:
            </span>
          )}
          {display}
        </span>
        <span
          className="mono"
          style={{ color: "var(--ink-3)", fontSize: 10.5 }}
          title="Row ID"
        >
          {visibleId}
        </span>
      </span>
    );
  }
  return (
    <span className="mono" style={{ color: "var(--accent-ink)", fontSize: 11.5 }}>
      {visibleId}
    </span>
  );
}

function DocFilter({
  label,
  value,
  onChange,
  documents
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  documents: { id: string; title: string }[];
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        color: "var(--ink-3)"
      }}
    >
      <span style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <select
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 28,
          minHeight: 0,
          width: "auto",
          minWidth: 180,
          fontSize: 12.5,
          padding: "2px 26px 2px 8px"
        }}
      >
        <option value="">All documents</option>
        {documents.map((d) => (
          <option key={d.id} value={d.id}>
            {d.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 14px",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--ink-3)",
        borderBottom: "1px solid var(--line)"
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      style={{
        padding: "10px 14px",
        fontSize: 12.5,
        color: muted ? "var(--ink-3)" : "var(--ink-2)",
        verticalAlign: "middle"
      }}
    >
      {children}
    </td>
  );
}
