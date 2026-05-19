"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/saberx/icon";

type Reference = {
  documentId: string;
  documentTitle: string;
  sheetId: string;
  sheetName: string;
  rowId: string;
  rowVisibleId: string | null;
  fieldId: string;
  fieldLabel: string;
};

export function ReferencesPanel({ sourceId, initialCount }: { sourceId: string; initialCount: number }) {
  const [open, setOpen] = useState(initialCount > 0);
  const [references, setReferences] = useState<Reference[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || references !== null) return;
    let cancelled = false;
    fetch(`/api/sources/${sourceId}/references`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load references (${r.status})`);
        const data = (await r.json()) as { references: Reference[] };
        if (!cancelled) setReferences(data.references);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sourceId, references]);

  return (
    <div
      style={{
        borderTop: "1px solid var(--line)",
        background: "var(--panel)",
        padding: "10px 20px"
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--ink-2)"
        }}
      >
        <Icon name={open ? "chevronD" : "chevronR"} size={12} />
        <span style={{ fontWeight: 600 }}>Referenced from</span>
        <span style={{ color: "var(--ink-3)" }}>
          {initialCount === 0
            ? "no references"
            : `${initialCount} ${initialCount === 1 ? "cell" : "cells"}`}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {error && (
            <div style={{ color: "var(--red)", fontSize: 12 }}>{error}</div>
          )}
          {!error && references === null && initialCount > 0 && (
            <div style={{ color: "var(--ink-3)", fontSize: 12 }}>Loading…</div>
          )}
          {!error && references !== null && references.length === 0 && (
            <div style={{ color: "var(--ink-3)", fontSize: 12 }}>
              No cells currently reference this source.
            </div>
          )}
          {!error && references && references.length > 0 && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 6,
                overflow: "hidden",
                background: "var(--panel-2)"
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "var(--panel)" }}>
                    <Th>Document</Th>
                    <Th>Sheet</Th>
                    <Th>Row</Th>
                    <Th>Field</Th>
                    <Th align="right"> </Th>
                  </tr>
                </thead>
                <tbody>
                  {references.map((r, idx) => (
                    <tr key={`${r.rowId}-${r.fieldId}-${idx}`} style={{ borderTop: "1px solid var(--line)" }}>
                      <Td>{r.documentTitle}</Td>
                      <Td muted>{r.sheetName}</Td>
                      <Td mono>{r.rowVisibleId ?? r.rowId.slice(0, 8)}</Td>
                      <Td muted>{r.fieldLabel}</Td>
                      <Td align="right">
                        <Link
                          className="sx-btn sx-btn-ghost sx-btn-sm"
                          href={`/dashboard/documents/${r.documentId}?sheet=${r.sheetId}&flash=1&focusRow=${r.rowId}&focusField=${r.fieldId}`}
                          title="Open the cell"
                          style={{ padding: "2px 8px" }}
                        >
                          <Icon name="arrowR" size={12} /> Open
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
        padding: "6px 10px",
        fontSize: 10.5,
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
        padding: "6px 10px",
        textAlign: align,
        color: muted ? "var(--ink-3)" : "var(--ink)",
        verticalAlign: "middle"
      }}
    >
      {children}
    </td>
  );
}
