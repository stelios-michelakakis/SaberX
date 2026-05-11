"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/saberx/icon";

const ACTION_PILL: Record<string, string> = {
  ROW_CREATE: "pill pill-green",
  ROW_UPDATE: "pill pill-amber",
  ROW_DELETE: "pill pill-red",
  CELL_UPDATE: "pill pill-amber",
  DOCUMENT_CREATE: "pill pill-green",
  DOCUMENT_UPDATE: "pill pill-amber",
  DOCUMENT_DELETE: "pill pill-red",
  SHEET_CREATE: "pill pill-green",
  SHEET_UPDATE: "pill pill-amber",
  SHEET_DELETE: "pill pill-red",
  FIELD_CREATE: "pill pill-green",
  FIELD_UPDATE: "pill pill-amber",
  FIELD_DELETE: "pill pill-red",
  SNAPSHOT_CREATE: "pill pill-violet",
  IMPORT_COMPLETE: "pill pill-green",
  IMPORT_FAIL: "pill pill-red",
  EXPORT_COMPLETE: "pill pill-green",
  EXPORT_FAIL: "pill pill-red",
  LOGIN_SUCCESS: "pill",
  LOGIN_FAIL: "pill pill-red",
  LOGOUT: "pill",
  PASSWORD_CHANGE: "pill pill-accent",
  INTEGRITY_WARNING: "pill pill-amber",
  INTEGRITY_ERROR: "pill pill-red"
};

type Event = {
  id: string;
  timestamp: string;
  actingUsername: string;
  actionType: string;
  entityType: string;
  rowVisibleId: string | null;
  parentDocumentName: string | null;
  summaryText: string;
};

export function AuditClient({
  events,
  actors,
  actions,
  documents,
  filters
}: {
  events: Event[];
  actors: string[];
  actions: string[];
  documents: { id: string; title: string }[];
  filters: { actor: string; action: string; document: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setFilter = (key: "actor" | "action" | "document", value: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/dashboard/audit?${params.toString()}`);
  };

  const clearAll = () => router.replace("/dashboard/audit");
  const hasFilters = filters.actor || filters.action || filters.document;

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
        <Icon name="filter" size={12} style={{ color: "var(--ink-3)" }} />
        <select
          className="select"
          value={filters.actor}
          onChange={(e) => setFilter("actor", e.target.value)}
          style={{
            height: 30,
            minHeight: 0,
            width: "auto",
            minWidth: 180,
            fontSize: 12.5,
            padding: "4px 28px 4px 10px"
          }}
        >
          <option value="">All actors</option>
          {actors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={filters.action}
          onChange={(e) => setFilter("action", e.target.value)}
          style={{
            height: 30,
            minHeight: 0,
            width: "auto",
            minWidth: 200,
            fontSize: 12.5,
            padding: "4px 28px 4px 10px"
          }}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a.toLowerCase().replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={filters.document}
          onChange={(e) => setFilter("document", e.target.value)}
          style={{
            height: 30,
            minHeight: 0,
            width: "auto",
            minWidth: 220,
            fontSize: 12.5,
            padding: "4px 28px 4px 10px"
          }}
        >
          <option value="">All documents</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button className="sx-btn sx-btn-sm" onClick={clearAll} type="button">
            <Icon name="x" size={12} /> Clear
          </button>
        )}
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
              <Th>Time</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Document</Th>
              <Th>Summary</Th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>
                  No audit events match these filters.
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid var(--line)" }}>
                <Td>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                    {new Date(e.timestamp).toLocaleString()}
                  </span>
                </Td>
                <Td>{e.actingUsername || <span style={{ color: "var(--ink-4)" }}>system</span>}</Td>
                <Td>
                  <span className={ACTION_PILL[e.actionType] ?? "pill"}>
                    {e.actionType.toLowerCase().replace(/_/g, " ")}
                  </span>
                </Td>
                <Td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon name="cube" size={12} style={{ color: "var(--ink-4)" }} />
                    <span className="mono" style={{ fontSize: 11.5 }}>{e.entityType}</span>
                    {e.rowVisibleId && (
                      <span style={{ color: "var(--accent-ink)" }}>· {e.rowVisibleId}</span>
                    )}
                  </span>
                </Td>
                <Td muted>{e.parentDocumentName || "—"}</Td>
                <Td muted>{e.summaryText || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
