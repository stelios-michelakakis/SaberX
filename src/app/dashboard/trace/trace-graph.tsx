"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/saberx/icon";
import type { TraceLink, TraceRow, TraceSheet } from "./trace-client";

type Line = {
  key: string;
  src: string;
  tgt: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type SheetGridPayload = {
  fields: {
    id: string;
    label: string;
    slug: string;
    type: string;
    isIdField: boolean;
    archived: boolean;
  }[];
  rows: { id: string; cells: Record<string, unknown> }[];
};

type SheetDetail = {
  fields: { id: string; label: string; slug: string; type: string }[];
  rowsById: Map<string, Record<string, unknown>>;
};

function toSheetDetail(g: SheetGridPayload): SheetDetail {
  const fields = g.fields
    .filter((f) => !f.isIdField && !f.archived)
    .map((f) => ({ id: f.id, label: f.label, slug: f.slug, type: f.type }));
  const rowsById = new Map<string, Record<string, unknown>>();
  for (const r of g.rows) rowsById.set(r.id, r.cells);
  return { fields, rowsById };
}

function readCellText(
  cells: Record<string, unknown> | undefined,
  field: { id: string; slug: string }
): string {
  if (!cells) return "";
  const raw = cells[field.id] ?? cells[field.slug];
  if (raw == null || raw === "") return "";
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "object" && "label" in (item as object)) {
          return (item as { label?: unknown }).label ?? "";
        }
        return String(item);
      })
      .filter((s) => s !== "")
      .join(", ");
  }
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

export function TraceGraph({
  links,
  rowMap,
  sheetMap,
  documentFilterId,
  hideSourceDocInTitle = false,
  hideTargetDocInTitle = false
}: {
  links: TraceLink[];
  rowMap: Map<string, TraceRow>;
  sheetMap: Map<string, TraceSheet>;
  documentFilterId: string | null;
  hideSourceDocInTitle?: boolean;
  hideTargetDocInTitle?: boolean;
}) {
  const eligibleSourceSheets = useMemo(() => {
    const ids = new Set<string>();
    for (const l of links) {
      const src = rowMap.get(l.sourceRowId);
      if (src) ids.add(src.sheetId);
    }
    return Array.from(ids)
      .map((id) => sheetMap.get(id))
      .filter((s): s is TraceSheet => Boolean(s));
  }, [links, rowMap, sheetMap]);

  const eligibleTargetSheets = useMemo(() => {
    const ids = new Set<string>();
    for (const l of links) {
      const tgt = rowMap.get(l.targetRowId);
      if (tgt) ids.add(tgt.sheetId);
    }
    return Array.from(ids)
      .map((id) => sheetMap.get(id))
      .filter((s): s is TraceSheet => Boolean(s));
  }, [links, rowMap, sheetMap]);

  // Default to the most-linked source/target pair.
  const defaultPair = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of links) {
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
  }, [links, rowMap]);

  const [leftSheetId, setLeftSheetId] = useState<string>(
    defaultPair?.src ?? eligibleSourceSheets[0]?.id ?? ""
  );
  const [rightSheetId, setRightSheetId] = useState<string>(
    defaultPair?.tgt ?? eligibleTargetSheets[0]?.id ?? ""
  );

  // Lazy-loaded per-side: the sheet's fields + a map of rowId → cell values.
  // Lets us render arbitrary field values inside each row card.
  const [leftDetail, setLeftDetail] = useState<SheetDetail | null>(null);
  const [rightDetail, setRightDetail] = useState<SheetDetail | null>(null);
  const [leftSelectedFields, setLeftSelectedFields] = useState<Set<string>>(new Set());
  const [rightSelectedFields, setRightSelectedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!leftSheetId) {
      setLeftDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/sheets/${leftSheetId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((g: SheetGridPayload | null) => {
        if (cancelled || !g) return;
        setLeftDetail(toSheetDetail(g));
        setLeftSelectedFields(new Set());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [leftSheetId]);

  useEffect(() => {
    if (!rightSheetId) {
      setRightDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/sheets/${rightSheetId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((g: SheetGridPayload | null) => {
        if (cancelled || !g) return;
        setRightDetail(toSheetDetail(g));
        setRightSelectedFields(new Set());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rightSheetId]);

  // Re-default if the user changes filters and the chosen sheet is no longer eligible.
  useEffect(() => {
    if (!eligibleSourceSheets.some((s) => s.id === leftSheetId)) {
      setLeftSheetId(eligibleSourceSheets[0]?.id ?? "");
    }
    if (!eligibleTargetSheets.some((s) => s.id === rightSheetId)) {
      setRightSheetId(eligibleTargetSheets[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentFilterId, links]);

  const leftRows = useMemo(() => {
    if (!leftSheetId) return [];
    const seen = new Map<string, TraceRow>();
    for (const l of links) {
      const r = rowMap.get(l.sourceRowId);
      if (r && r.sheetId === leftSheetId) seen.set(r.id, r);
    }
    return Array.from(seen.values()).sort((a, b) =>
      (a.visibleId ?? "").localeCompare(b.visibleId ?? "")
    );
  }, [leftSheetId, links, rowMap]);

  const rightRows = useMemo(() => {
    if (!rightSheetId) return [];
    const seen = new Map<string, TraceRow>();
    for (const l of links) {
      const r = rowMap.get(l.targetRowId);
      if (r && r.sheetId === rightSheetId) seen.set(r.id, r);
    }
    return Array.from(seen.values()).sort((a, b) =>
      (a.visibleId ?? "").localeCompare(b.visibleId ?? "")
    );
  }, [rightSheetId, links, rowMap]);

  const visibleLinks = useMemo(() => {
    return links.filter((l) => {
      const src = rowMap.get(l.sourceRowId);
      const tgt = rowMap.get(l.targetRowId);
      return src?.sheetId === leftSheetId && tgt?.sheetId === rightSheetId;
    });
  }, [links, rowMap, leftSheetId, rightSheetId]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const rightRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const [lines, setLines] = useState<Line[]>([]);
  const [hoverRowId, setHoverRowId] = useState<string | null>(null);

  useEffect(() => {
    const compute = () => {
      const container = containerRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const seen = new Set<string>();
      const next: Line[] = [];
      for (const link of visibleLinks) {
        const lEl = leftRefs.current.get(link.sourceRowId);
        const rEl = rightRefs.current.get(link.targetRowId);
        if (!lEl || !rEl) continue;
        // Multiple links can connect the same row pair (e.g. two reference
        // fields on the same row pointing to the same target). De-dupe so the
        // SVG draws one curve per visible row→row connection.
        const pairKey = `${link.sourceRowId}->${link.targetRowId}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        const lr = lEl.getBoundingClientRect();
        const rr = rEl.getBoundingClientRect();
        next.push({
          key: pairKey,
          src: link.sourceRowId,
          tgt: link.targetRowId,
          x1: lr.right - cRect.left,
          y1: (lr.top + lr.bottom) / 2 - cRect.top,
          x2: rr.left - cRect.left,
          y2: (rr.top + rr.bottom) / 2 - cRect.top
        });
      }
      setLines(next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [visibleLinks, leftSheetId, rightSheetId]);

  const linkedFromLeft = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of visibleLinks) {
      if (!m.has(l.sourceRowId)) m.set(l.sourceRowId, new Set());
      m.get(l.sourceRowId)!.add(l.targetRowId);
    }
    return m;
  }, [visibleLinks]);

  const linkedToRight = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of visibleLinks) {
      if (!m.has(l.targetRowId)) m.set(l.targetRowId, new Set());
      m.get(l.targetRowId)!.add(l.sourceRowId);
    }
    return m;
  }, [visibleLinks]);

  const isLineHighlighted = (line: Line) => {
    if (!hoverRowId) return false;
    return line.src === hoverRowId || line.tgt === hoverRowId;
  };

  const isRowHighlighted = (rowId: string) => {
    if (!hoverRowId) return false;
    if (hoverRowId === rowId) return true;
    if (linkedFromLeft.get(hoverRowId)?.has(rowId)) return true;
    if (linkedToRight.get(hoverRowId)?.has(rowId)) return true;
    return false;
  };

  const leftSheet = sheetMap.get(leftSheetId);
  const rightSheet = sheetMap.get(rightSheetId);

  if (eligibleSourceSheets.length === 0 || eligibleTargetSheets.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--ink-3)",
          border: "1px solid var(--line)",
          borderRadius: "var(--sx-radius-lg)",
          background: "var(--panel)"
        }}
      >
        No links to visualise with the current filter.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--sx-radius-lg)",
        background: "var(--panel)",
        boxShadow: "var(--sx-shadow-sm)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel-2)",
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap"
        }}
      >
        <SheetPicker
          label="Sheet source"
          value={leftSheetId}
          onChange={setLeftSheetId}
          options={eligibleSourceSheets}
        />
        <Icon name="arrowR" size={14} style={{ color: "var(--ink-4)" }} />
        <SheetPicker
          label="Sheet target"
          value={rightSheetId}
          onChange={setRightSheetId}
          options={eligibleTargetSheets}
        />
        <span style={{ marginLeft: "auto", color: "var(--ink-3)", fontSize: 12 }}>
          {visibleLinks.length} connection{visibleLinks.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18
        }}
      >
        <FieldTagRow
          label="Show source fields"
          fields={leftDetail?.fields ?? []}
          selected={leftSelectedFields}
          onToggle={(id) =>
            setLeftSelectedFields((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
        <FieldTagRow
          label="Show target fields"
          fields={rightDetail?.fields ?? []}
          selected={rightSelectedFields}
          onToggle={(id) =>
            setRightSelectedFields((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          alignRight
        />
      </div>

      <div
        ref={containerRef}
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1fr) 160px minmax(220px, 1fr)",
          gap: 0,
          padding: "18px 18px",
          minHeight: 380
        }}
      >
        <Column
          title={
            leftSheet
              ? hideSourceDocInTitle
                ? leftSheet.name
                : `${leftSheet.documentTitle} · ${leftSheet.name}`
              : "Source"
          }
          rows={leftRows}
          side="left"
          detail={leftDetail}
          selectedFieldIds={leftSelectedFields}
          isHighlighted={isRowHighlighted}
          onHover={setHoverRowId}
          assignRef={(id, el) => leftRefs.current.set(id, el)}
        />
        <div />
        <Column
          title={
            rightSheet
              ? hideTargetDocInTitle
                ? rightSheet.name
                : `${rightSheet.documentTitle} · ${rightSheet.name}`
              : "Target"
          }
          rows={rightRows}
          side="right"
          detail={rightDetail}
          selectedFieldIds={rightSelectedFields}
          isHighlighted={isRowHighlighted}
          onHover={setHoverRowId}
          assignRef={(id, el) => rightRefs.current.set(id, el)}
        />

        <svg
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            width: "100%",
            height: "100%"
          }}
        >
          {lines.map((l) => {
            const cx = (l.x1 + l.x2) / 2;
            const d = `M ${l.x1} ${l.y1} C ${cx} ${l.y1}, ${cx} ${l.y2}, ${l.x2} ${l.y2}`;
            const highlighted = isLineHighlighted(l);
            return (
              <path
                key={l.key}
                d={d}
                stroke="var(--sx-accent)"
                strokeWidth={highlighted ? 2 : 1.25}
                strokeOpacity={highlighted ? 0.95 : hoverRowId ? 0.18 : 0.5}
                fill="none"
              />
            );
          })}
        </svg>
      </div>

      {visibleLinks.length === 0 && (
        <div
          style={{
            padding: "10px 14px",
            color: "var(--ink-3)",
            fontSize: 12,
            borderTop: "1px solid var(--line)",
            background: "var(--panel-2)",
            textAlign: "center"
          }}
        >
          No direct links between these two sheets — try a different pair.
        </div>
      )}
    </div>
  );
}

function SheetPicker({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: TraceSheet[];
}) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontSize: 10.5,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.04em"
        }}
      >
        {label}
      </span>
      <select
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 28,
          minHeight: 0,
          minWidth: 220,
          fontSize: 12.5,
          padding: "4px 28px 4px 10px"
        }}
      >
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.documentTitle} · {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Column({
  title,
  rows,
  side,
  detail,
  selectedFieldIds,
  isHighlighted,
  onHover,
  assignRef
}: {
  title: string;
  rows: TraceRow[];
  side: "left" | "right";
  detail: SheetDetail | null;
  selectedFieldIds: Set<string>;
  isHighlighted: (rowId: string) => boolean;
  onHover: (id: string | null) => void;
  assignRef: (id: string, el: HTMLElement | null) => void;
}) {
  const selectedFields = detail
    ? detail.fields.filter((f) => selectedFieldIds.has(f.id))
    : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 4,
          textAlign: side === "left" ? "left" : "right"
        }}
      >
        {title}
      </div>
      {rows.length === 0 && (
        <div style={{ color: "var(--ink-4)", fontSize: 12.5, fontStyle: "italic" }}>
          No referenced rows in this sheet.
        </div>
      )}
      {rows.map((r) => {
        const active = isHighlighted(r.id);
        const cells = detail?.rowsById.get(r.id);
        return (
          <Link
            key={r.id}
            href={`/dashboard/documents/${r.documentId}?sheet=${r.sheetId}&flash=1&focusRow=${r.id}`}
            ref={(el) => assignRef(r.id, el)}
            onMouseEnter={() => onHover(r.id)}
            onMouseLeave={() => onHover(null)}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid",
              borderColor: active ? "var(--sx-accent)" : "var(--line)",
              background: active ? "var(--accent-soft)" : "var(--panel-2)",
              color: "var(--ink-2)",
              textDecoration: "none",
              fontSize: 12.5,
              transition: "background 0.12s, border-color 0.12s",
              alignItems: side === "left" ? "stretch" : "stretch"
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: side === "left" ? "row" : "row-reverse",
                alignItems: "center",
                gap: 8
              }}
            >
              <span
                className="mono"
                style={{
                  color: "var(--accent-ink)",
                  fontSize: 11.5,
                  fontWeight: 500
                }}
              >
                {r.visibleId ?? r.id.slice(0, 8)}
              </span>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: active ? "var(--sx-accent)" : "var(--line-strong)",
                  flex: "none"
                }}
              />
            </div>
            {selectedFields.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  textAlign: side === "left" ? "left" : "right"
                }}
              >
                {selectedFields.map((f) => {
                  const value = readCellText(cells, f);
                  if (!value) return null;
                  return (
                    <div
                      key={f.id}
                      style={{
                        fontSize: 11,
                        color: "var(--ink-2)",
                        lineHeight: 1.35,
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: 6,
                        justifyContent: side === "left" ? "flex-start" : "flex-end"
                      }}
                    >
                      <span style={{ color: "var(--ink-4)", flex: "none", fontSize: 10.5 }}>
                        {f.label}:
                      </span>
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textAlign: side === "left" ? "left" : "right",
                          flex: side === "left" ? 1 : "0 1 auto",
                          minWidth: 0
                        }}
                        title={value}
                      >
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function FieldTagRow({
  label,
  fields,
  selected,
  onToggle,
  alignRight
}: {
  label: string;
  fields: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  alignRight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        justifyContent: alignRight ? "flex-end" : "flex-start"
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--ink-4)",
          flex: "none"
        }}
      >
        {label}
      </span>
      {fields.length === 0 && (
        <span style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>—</span>
      )}
      {fields.map((f) => {
        const active = selected.has(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onToggle(f.id)}
            className={active ? "pill pill-accent" : "pill"}
            style={{
              cursor: "pointer",
              border: "1px solid var(--line)",
              fontSize: 11
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
