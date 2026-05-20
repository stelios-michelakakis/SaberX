"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/saberx/icon";
import { useToast } from "@/components/saberx/toast";

type Candidate = {
  rowId: string;
  visibleId: string;
  sheetId: string;
  sheetName: string;
  documentId: string;
  documentTitle: string;
};

type DetectedToken = {
  token: string;
  start: number;
  end: number;
  candidates: Candidate[];
};

type DetectedCell = {
  rowId: string;
  rowVisibleId: string | null;
  rawText: string;
  tokens: DetectedToken[];
  isAll?: boolean;
};

type DetectedColumn = {
  sheetId: string;
  sheetName: string;
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  cells: DetectedCell[];
  totalCells: number;
  cellsWithTokens: number;
  totalTokens: number;
  ambiguousTokens: number;
  unresolvedTokens: number;
  suggestedTargetSheets: {
    sheetId: string;
    sheetName: string;
    documentId: string;
    documentTitle: string;
    hits: number;
  }[];
};

type DetectionResult = { documentId: string; columns: DetectedColumn[] };

// State per column.
type ColumnDecision = {
  skip: boolean;
  selectedSheets: Set<string>;
  // tokenKey = `${rowId}|${tokenIndex}` → rowId picked (or null = skip this token).
  picks: Map<string, string | null>;
  // Source rowIds whose cell text was "All" and that the user wants expanded
  // to every live row in the column's target sheets at apply time.
  expandAllRows: Set<string>;
};

export function ResolveReferencesClient({
  documentId,
  documentTitle
}: {
  documentId: string;
  documentTitle: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wizardMode = searchParams?.get("wizard") === "1";
  const toast = useToast();
  const [data, setData] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Map<string, ColumnDecision>>(new Map());
  const [applying, setApplying] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${documentId}/detect-references`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to scan (${r.status})`);
        const json = (await r.json()) as DetectionResult;
        if (cancelled) return;
        setData(json);
        const seed = new Map<string, ColumnDecision>();
        for (const col of json.columns) {
          const sheets = new Set(col.suggestedTargetSheets.map((s) => s.sheetId));
          const picks = new Map<string, string | null>();
          for (const cell of col.cells) {
            cell.tokens.forEach((tok, idx) => {
              const key = `${cell.rowId}|${idx}`;
              // Default: auto-pick the first candidate from one of the
              // suggested sheets if exactly one such match exists; otherwise
              // leave it null so the user has to pick.
              const fromSuggested = tok.candidates.filter((c) => sheets.has(c.sheetId));
              if (fromSuggested.length === 1) {
                picks.set(key, fromSuggested[0].rowId);
              } else if (tok.candidates.length === 1) {
                picks.set(key, tok.candidates[0].rowId);
              } else {
                picks.set(key, null);
              }
            });
          }
          const expandAllRows = new Set<string>(
            col.cells.filter((c) => c.isAll).map((c) => c.rowId)
          );
          seed.set(col.fieldId, { skip: false, selectedSheets: sheets, picks, expandAllRows });
        }
        setDecisions(seed);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const setColumn = (fieldId: string, mut: (d: ColumnDecision) => ColumnDecision) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      const current = next.get(fieldId);
      if (!current) return prev;
      next.set(fieldId, mut(current));
      return next;
    });
  };

  const apply = async () => {
    if (!data) return;
    const payload = data.columns
      .filter((col) => {
        const d = decisions.get(col.fieldId);
        return d && !d.skip && d.selectedSheets.size > 0;
      })
      .map((col) => {
        const d = decisions.get(col.fieldId)!;
        const cellPicks = col.cells.map((cell) => {
          const pickedRowIds: string[] = [];
          cell.tokens.forEach((_tok, idx) => {
            const key = `${cell.rowId}|${idx}`;
            const picked = d.picks.get(key);
            if (picked && !pickedRowIds.includes(picked)) pickedRowIds.push(picked);
          });
          return {
            rowId: cell.rowId,
            pickedRowIds,
            expandAll: cell.isAll === true && d.expandAllRows.has(cell.rowId)
          };
        });
        return {
          fieldId: col.fieldId,
          targetSheetIds: Array.from(d.selectedSheets),
          cellPicks
        };
      });
    if (payload.length === 0) {
      toast.error("Nothing to apply", { detail: "Select at least one column and one target sheet." });
      return;
    }
    setApplying(true);
    try {
      const r = await fetch(`/api/documents/${documentId}/resolve-references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: payload })
      });
      if (!r.ok) {
        const detail = await r.json().catch(() => ({}));
        toast.error("Failed to apply", { detail: detail.error });
        return;
      }
      const summary = (await r.json()) as {
        convertedFields: { fieldLabel: string }[];
        cellsWritten: number;
        warnings?: { message: string }[];
      };
      const warnings = summary.warnings ?? [];
      if (warnings.length > 0) {
        toast.error(
          `Applied with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`,
          {
            detail: `Converted ${summary.convertedFields.length} column(s), ${summary.cellsWritten} cell(s). First warning: ${warnings[0].message}`,
            durationMs: 12000
          }
        );
        // Don't navigate away — the user needs to be able to inspect what
        // didn't apply.
        console.warn("[resolve-references] warnings:", warnings);
        return;
      }
      toast.success(`Converted ${summary.convertedFields.length} column(s) to references`, {
        detail: `${summary.cellsWritten} cell link(s) written.`
      });
      router.push(`/dashboard/documents/${documentId}`);
      router.refresh();
    } finally {
      setApplying(false);
    }
  };

  const totals = useMemo(() => {
    if (!data) return null;
    const cols = data.columns;
    return {
      columns: cols.length,
      cells: cols.reduce((n, c) => n + c.cellsWithTokens, 0),
      tokens: cols.reduce((n, c) => n + c.totalTokens, 0),
      unresolved: cols.reduce((n, c) => n + c.unresolvedTokens, 0)
    };
  }, [data]);

  return (
    <div style={{ padding: "16px 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          href={`/dashboard/documents/${documentId}`}
          style={{
            color: "var(--ink-3)",
            textDecoration: "none",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            display: "inline-flex",
            alignItems: "center",
            gap: 4
          }}
        >
          <Icon name="arrowL" size={11} /> {documentTitle}
        </Link>
        <span style={{ color: "var(--line)" }}>/</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Detect references</span>
        {totals && (
          <span style={{ color: "var(--ink-3)", fontSize: 12, marginLeft: 12 }}>
            {totals.tokens} tokens · {totals.cells} cells · {totals.columns} columns
            {totals.unresolved > 0 && (
              <span style={{ color: "var(--red)", marginLeft: 8 }}>
                {totals.unresolved} unresolved
              </span>
            )}
          </span>
        )}
        <button
          type="button"
          className="sx-btn sx-btn-primary sx-btn-sm"
          onClick={apply}
          disabled={applying || !data}
          style={{ marginLeft: "auto" }}
        >
          <Icon name="check" size={12} /> {applying ? "Applying…" : "Apply"}
        </button>
      </div>

      {error && <div style={{ color: "var(--red)" }}>{error}</div>}
      {!error && !data && <div style={{ color: "var(--ink-3)" }}>Scanning…</div>}
      {data && data.columns.length === 0 && (
        <div
          style={{
            padding: 28,
            color: "var(--ink-3)",
            fontSize: 13,
            border: "1px dashed var(--line-strong)",
            borderRadius: "var(--sx-radius-lg)",
            textAlign: "center"
          }}
        >
          No reference-like tokens found in this document&apos;s text cells.
        </div>
      )}

      {data && wizardMode && data.columns.length > 0 && (
        <WizardStepper
          stepIdx={stepIdx}
          total={data.columns.length}
          onPrev={() => setStepIdx((i) => Math.max(0, i - 1))}
          onNext={() => setStepIdx((i) => Math.min(data.columns.length - 1, i + 1))}
          onApply={apply}
          applying={applying}
          column={data.columns[stepIdx]}
        />
      )}

      {data &&
        (wizardMode
          ? data.columns
              .slice(stepIdx, stepIdx + 1)
              .map((col) => {
                const d = decisions.get(col.fieldId);
                if (!d) return null;
                return (
                  <Column
                    key={col.fieldId}
                    column={col}
                    decision={d}
                    onChange={(mut) => setColumn(col.fieldId, mut)}
                  />
                );
              })
          : data.columns.map((col) => {
              const d = decisions.get(col.fieldId);
              if (!d) return null;
              return (
                <Column
                  key={col.fieldId}
                  column={col}
                  decision={d}
                  onChange={(mut) => setColumn(col.fieldId, mut)}
                />
              );
            }))}
    </div>
  );
}

function WizardStepper({
  stepIdx,
  total,
  onPrev,
  onNext,
  onApply,
  applying,
  column
}: {
  stepIdx: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onApply: () => void;
  applying: boolean;
  column: DetectedColumn;
}) {
  const atFirst = stepIdx === 0;
  const atLast = stepIdx === total - 1;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        background: "var(--panel-2)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        fontSize: 12.5
      }}
    >
      <span style={{ color: "var(--ink-3)" }}>
        Step <strong style={{ color: "var(--ink)" }}>{stepIdx + 1}</strong> of {total}
      </span>
      <span style={{ color: "var(--ink-4)" }}>·</span>
      <span style={{ color: "var(--ink-2)" }}>
        {column.sheetName} → <strong>{column.fieldLabel}</strong>
      </span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
        <button
          type="button"
          className="sx-btn sx-btn-sm"
          onClick={onPrev}
          disabled={atFirst}
        >
          <Icon name="arrowL" size={12} /> Back
        </button>
        {atLast ? (
          <button
            type="button"
            className="sx-btn sx-btn-primary sx-btn-sm"
            onClick={onApply}
            disabled={applying}
          >
            <Icon name="check" size={12} /> {applying ? "Applying…" : "Apply all"}
          </button>
        ) : (
          <button
            type="button"
            className="sx-btn sx-btn-primary sx-btn-sm"
            onClick={onNext}
          >
            Next <Icon name="arrowR" size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function Column({
  column,
  decision,
  onChange
}: {
  column: DetectedColumn;
  decision: ColumnDecision;
  onChange: (mut: (d: ColumnDecision) => ColumnDecision) => void;
}) {
  const toggleSheet = (sheetId: string) =>
    onChange((d) => {
      const next = new Set(d.selectedSheets);
      if (next.has(sheetId)) next.delete(sheetId);
      else next.add(sheetId);
      return { ...d, selectedSheets: next };
    });
  const toggleSkip = () => onChange((d) => ({ ...d, skip: !d.skip }));
  const setPick = (key: string, rowId: string | null) =>
    onChange((d) => {
      const next = new Map(d.picks);
      next.set(key, rowId);
      return { ...d, picks: next };
    });
  const toggleExpandAll = (rowId: string) =>
    onChange((d) => {
      const next = new Set(d.expandAllRows);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return { ...d, expandAllRows: next };
    });

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--sx-radius-lg)",
        background: "var(--panel)",
        opacity: decision.skip ? 0.55 : 1
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap"
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>{column.fieldLabel}</span>
        <span style={{ color: "var(--ink-3)", fontSize: 11.5 }}>{column.sheetName}</span>
        <span style={{ color: "var(--ink-3)", fontSize: 11.5 }}>
          {column.totalTokens} tokens in {column.cellsWithTokens}/{column.totalCells} cells
          {column.ambiguousTokens > 0 && ` · ${column.ambiguousTokens} ambiguous`}
          {column.unresolvedTokens > 0 && ` · ${column.unresolvedTokens} unresolved`}
          {(() => {
            const n = column.cells.filter((c) => c.isAll).length;
            return n > 0 ? ` · ${n} "All"` : "";
          })()}
        </span>
        <button
          type="button"
          className="sx-btn sx-btn-ghost sx-btn-sm"
          onClick={toggleSkip}
          style={{ marginLeft: "auto" }}
        >
          {decision.skip ? "Include" : "Skip column"}
        </button>
      </div>
      {!decision.skip && (
        <>
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--line)",
              background: "var(--panel-2)",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center"
            }}
          >
            <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Target sheets:</span>
            {column.suggestedTargetSheets.length === 0 && (
              <span style={{ color: "var(--ink-4)", fontSize: 12 }}>
                No matching sheets detected.
              </span>
            )}
            {column.suggestedTargetSheets.map((s) => {
              const active = decision.selectedSheets.has(s.sheetId);
              return (
                <button
                  key={s.sheetId}
                  type="button"
                  onClick={() => toggleSheet(s.sheetId)}
                  className={active ? "pill pill-accent" : "pill"}
                  style={{ cursor: "pointer", border: "1px solid var(--line)" }}
                  title={`${s.documentTitle} · ${s.sheetName} — ${s.hits} hits`}
                >
                  <Icon name={active ? "check" : "link"} size={12} />
                  {s.documentTitle} · {s.sheetName}
                  <span style={{ color: "var(--ink-3)", fontSize: 10, marginLeft: 4 }}>
                    {s.hits}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ maxHeight: 480, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--panel-2)" }}>
                  <Th>Row</Th>
                  <Th>Cell text</Th>
                  <Th>Tokens → target</Th>
                </tr>
              </thead>
              <tbody>
                {column.cells.map((cell) => (
                  <tr key={cell.rowId} style={{ borderTop: "1px solid var(--line)" }}>
                    <Td mono>
                      {cell.rowVisibleId ?? cell.rowId.slice(0, 8)}
                    </Td>
                    <Td>
                      <div
                        style={{
                          maxWidth: 360,
                          whiteSpace: "pre-wrap",
                          color: "var(--ink-2)",
                          fontSize: 12
                        }}
                      >
                        {cell.rawText}
                      </div>
                    </Td>
                    <Td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {cell.isAll && (
                          <AllPicker
                            active={decision.expandAllRows.has(cell.rowId)}
                            targetCount={decision.selectedSheets.size}
                            onToggle={() => toggleExpandAll(cell.rowId)}
                          />
                        )}
                        {cell.tokens.map((tok, idx) => {
                          const key = `${cell.rowId}|${idx}`;
                          const picked = decision.picks.get(key) ?? null;
                          return (
                            <TokenPicker
                              key={key}
                              token={tok}
                              picked={picked}
                              onChange={(val) => setPick(key, val)}
                            />
                          );
                        })}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AllPicker({
  active,
  targetCount,
  onToggle
}: {
  active: boolean;
  targetCount: number;
  onToggle: () => void;
}) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
      <span className={active ? "pill pill-accent" : "pill"} title="Cell text was 'All'">
        All
      </span>
      <span style={{ color: "var(--ink-3)" }}>→</span>
      <span style={{ color: "var(--ink-2)" }}>
        every live row in the {targetCount === 1 ? "selected target sheet" : `${targetCount} selected target sheets`}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="sx-btn sx-btn-ghost sx-btn-sm"
        style={{ padding: "2px 6px" }}
        title={active ? "Skip this cell" : "Expand to all rows"}
      >
        {active ? "Skip" : "Expand"}
      </button>
    </div>
  );
}

function TokenPicker({
  token,
  picked,
  onChange
}: {
  token: DetectedToken;
  picked: string | null;
  onChange: (val: string | null) => void;
}) {
  if (token.candidates.length === 0) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
        <span className="pill" style={{ color: "var(--red)" }}>{token.token}</span>
        <span style={{ color: "var(--ink-4)" }}>no match</span>
      </div>
    );
  }
  if (token.candidates.length === 1) {
    const c = token.candidates[0];
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
        <span className={picked ? "pill pill-accent" : "pill"}>{token.token}</span>
        <span style={{ color: "var(--ink-3)" }}>→</span>
        <span style={{ color: "var(--ink-2)" }}>
          {c.documentTitle} · {c.sheetName} · {c.visibleId}
        </span>
        <button
          type="button"
          onClick={() => onChange(picked ? null : c.rowId)}
          className="sx-btn sx-btn-ghost sx-btn-sm"
          style={{ padding: "2px 6px" }}
          title={picked ? "Skip this token" : "Accept this match"}
        >
          {picked ? "Skip" : "Accept"}
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, flexWrap: "wrap" }}>
      <span className={picked ? "pill pill-accent" : "pill pill-amber"}>{token.token}</span>
      <select
        className="select"
        value={picked ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ height: 26, minHeight: 0, padding: "2px 8px", fontSize: 11.5, minWidth: 280 }}
      >
        <option value="">— Skip —</option>
        {token.candidates.map((c) => (
          <option key={c.rowId} value={c.rowId}>
            {c.documentTitle} · {c.sheetName} · {c.visibleId}
          </option>
        ))}
      </select>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
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
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <td
      className={mono ? "mono" : undefined}
      style={{
        padding: "8px 12px",
        color: "var(--ink-2)",
        verticalAlign: "top",
        fontSize: 12.5
      }}
    >
      {children}
    </td>
  );
}
