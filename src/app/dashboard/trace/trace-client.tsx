"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  initialDocumentId,
  stats
}: {
  links: TraceLink[];
  rows: TraceRow[];
  sheets: TraceSheet[];
  fields: { id: string; label: string }[];
  documents: { id: string; title: string }[];
  initialDocumentId: string;
  stats: { totalLinks: number; totalSources: number; docCount: number; orphans: number };
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

  // Sheet picker state is lifted out of TraceGraph so we can render its
  // dropdowns in the same filter bar as the document filters.
  const eligibleSourceSheets = useMemo(() => {
    const ids = new Set<string>();
    for (const l of filteredLinks) {
      const src = rowMap.get(l.sourceRowId);
      if (src) ids.add(src.sheetId);
    }
    return Array.from(ids)
      .map((id) => sheetMap.get(id))
      .filter((s): s is TraceSheet => Boolean(s));
  }, [filteredLinks, rowMap, sheetMap]);

  const eligibleTargetSheets = useMemo(() => {
    const ids = new Set<string>();
    for (const l of filteredLinks) {
      const tgt = rowMap.get(l.targetRowId);
      if (tgt) ids.add(tgt.sheetId);
    }
    return Array.from(ids)
      .map((id) => sheetMap.get(id))
      .filter((s): s is TraceSheet => Boolean(s));
  }, [filteredLinks, rowMap, sheetMap]);

  const defaultPair = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of filteredLinks) {
      const src = rowMap.get(l.sourceRowId);
      const tgt = rowMap.get(l.targetRowId);
      if (!src || !tgt) continue;
      const key = `${src.sheetId}::${tgt.sheetId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best: { key: string; n: number } | null = null;
    for (const [key, n] of counts) {
      if (!best || n > best.n) best = { key, n };
    }
    if (!best) return null;
    const [src, tgt] = best.key.split("::");
    return { src, tgt };
  }, [filteredLinks, rowMap]);

  const [leftSheetId, setLeftSheetId] = useState<string>("");
  const [rightSheetId, setRightSheetId] = useState<string>("");

  // Seed defaults and re-seed when filters change such that the chosen
  // sheet is no longer in scope.
  useEffect(() => {
    if (!eligibleSourceSheets.some((s) => s.id === leftSheetId)) {
      setLeftSheetId(defaultPair?.src ?? eligibleSourceSheets[0]?.id ?? "");
    }
    if (!eligibleTargetSheets.some((s) => s.id === rightSheetId)) {
      setRightSheetId(defaultPair?.tgt ?? eligibleTargetSheets[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleSourceSheets, eligibleTargetSheets, defaultPair]);

  return (
    <>
      <div
        style={{
          padding: "10px 28px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 12,
          color: "var(--ink-3)",
          flexWrap: "wrap"
        }}
      >
        <span>
          <strong style={{ color: "var(--ink)" }}>{stats.totalLinks}</strong>{" "}
          {stats.totalLinks === 1 ? "link" : "links"}
        </span>
        <span>
          <strong style={{ color: "var(--ink)" }}>{stats.totalSources}</strong>{" "}
          {stats.totalSources === 1 ? "source row" : "source rows"}
        </span>
        <span>
          <strong style={{ color: "var(--ink)" }}>{stats.docCount}</strong>{" "}
          {stats.docCount === 1 ? "document involved" : "documents involved"}
        </span>
        <span>
          <strong style={{ color: "var(--ink)" }}>{stats.orphans}</strong>{" "}
          {stats.orphans === 1 ? "row without outgoing links" : "rows without outgoing links"}
        </span>
        <div
          style={{
            marginLeft: "auto",
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
      </div>
      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "18px auto minmax(220px, 1fr) auto auto minmax(220px, 1fr) auto",
          rowGap: 8,
          columnGap: 10,
          alignItems: "center",
          padding: "10px 14px",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "var(--sx-radius-lg)",
          boxShadow: "var(--sx-shadow-sm)"
        }}
      >
        {/* Row 1 — documents */}
        <Icon
          name="filter"
          size={12}
          style={{ color: "var(--ink-3)", justifySelf: "center" }}
        />
        <FilterLabel>Document source</FilterLabel>
        <FilterSelect value={sourceDocId} onChange={setSourceDocId}>
          <option value="">All documents</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </FilterSelect>
        <Icon
          name="arrowR"
          size={12}
          style={{ color: "var(--ink-4)", justifySelf: "center" }}
        />
        <FilterLabel>Document target</FilterLabel>
        <FilterSelect value={targetDocId} onChange={setTargetDocId}>
          <option value="">All documents</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </FilterSelect>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "flex-end"
          }}
        >
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
          <span style={{ color: "var(--ink-3)", fontSize: 12, whiteSpace: "nowrap" }}>
            {filteredLinks.length} link{filteredLinks.length === 1 ? "" : "s"} shown
          </span>
        </div>

        {/* Divider — spans all columns when both rows are visible */}
        {mode === "graph" && (
          <div
            style={{
              gridColumn: "1 / -1",
              height: 0,
              borderTop: "1px dashed var(--line)"
            }}
          />
        )}

        {/* Row 2 — sheets (graph mode only) */}
        {mode === "graph" && (
          <>
            <span
              style={{
                fontSize: 12,
                color: "var(--ink-4)",
                justifySelf: "center"
              }}
              aria-hidden
            >
              ↳
            </span>
            <FilterLabel>Sheet source</FilterLabel>
            <FilterSelect value={leftSheetId} onChange={setLeftSheetId}>
              {eligibleSourceSheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {sourceDocId ? s.name : `${s.documentTitle} · ${s.name}`}
                </option>
              ))}
            </FilterSelect>
            <Icon
              name="arrowR"
              size={12}
              style={{ color: "var(--ink-4)", justifySelf: "center" }}
            />
            <FilterLabel>Sheet target</FilterLabel>
            <FilterSelect value={rightSheetId} onChange={setRightSheetId}>
              {eligibleTargetSheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {targetDocId ? s.name : `${s.documentTitle} · ${s.name}`}
                </option>
              ))}
            </FilterSelect>
            <div />
          </>
        )}
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
          leftSheetId={leftSheetId}
          rightSheetId={rightSheetId}
        />
      )}
      </div>
    </>
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
                  {src ? (
                    <Link
                      href={rowHref(src.documentId, src.sheetId, src.id, link.sourceFieldId)}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      <DisplayCell
                        display={link.sourceDisplay}
                        displayField={link.sourceDisplayField}
                        visibleId={src.visibleId || link.sourceRowId.slice(0, 8)}
                      />
                    </Link>
                  ) : (
                    <DisplayCell
                      display={link.sourceDisplay}
                      displayField={link.sourceDisplayField}
                      visibleId={link.sourceRowId.slice(0, 8)}
                    />
                  )}
                </Td>
                <Td muted>
                  {srcSheet && src ? (
                    <Link
                      href={rowHref(srcSheet.documentId, srcSheet.id, src.id, link.sourceFieldId)}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {srcSheet.documentTitle} · {srcSheet.name}
                    </Link>
                  ) : srcSheet ? (
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
                      href={rowHref(tgt.documentId, tgt.sheetId, tgt.id, null)}
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
                <Td muted>
                  {tgt ? (
                    <Link
                      href={rowHref(tgt.documentId, tgt.sheetId, tgt.id, null)}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {tgt.documentTitle} · {tgt.sheetName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
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

function rowHref(
  documentId: string,
  sheetId: string,
  rowId: string,
  fieldId: string | null
): string {
  const params = new URLSearchParams({
    sheet: sheetId,
    flash: "1",
    focusRow: rowId
  });
  if (fieldId) params.set("focusField", fieldId);
  return `/dashboard/documents/${documentId}?${params.toString()}`;
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "var(--ink-3)",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}

function FilterSelect({
  value,
  onChange,
  children
}: {
  value: string;
  onChange: (next: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      className="select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        height: 28,
        minHeight: 0,
        width: "100%",
        fontSize: 12.5,
        padding: "2px 26px 2px 8px"
      }}
    >
      {children}
    </select>
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
