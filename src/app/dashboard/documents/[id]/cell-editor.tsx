"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/saberx/icon";

export type FieldOption = { label: string; value: string };

export type FieldVm = {
  id: string;
  label: string;
  slug: string;
  type: string;
  description?: string;
  required: boolean;
  unique: boolean;
  editable: boolean;
  isIdField: boolean;
  options?: FieldOption[];
};

export type RefValue = { id: string; label: string; sheetId: string };

export type ReferenceTarget = {
  rowId: string;
  visibleId: string | null;
  sheetId: string;
  sheetName: string;
};

const baseTd: React.CSSProperties = {
  padding: "6px 12px",
  borderBottom: "1px solid var(--line)",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
  maxWidth: 280,
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontSize: 12.5
};

export function cellDisplay(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .map((v) =>
        typeof v === "object" && v && "label" in v ? (v as { label: string }).label : String(v)
      )
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function readCell(row: { cells: Record<string, unknown> }, field: FieldVm): unknown {
  if (field.id in row.cells) return row.cells[field.id];
  if (field.slug in row.cells) return row.cells[field.slug];
  return undefined;
}

type CellProps = {
  field: FieldVm;
  rowId: string;
  sheetId: string;
  value: unknown;
  editable: boolean;
  onCommit: (value: unknown) => void | Promise<void>;
};

export function Cell(props: CellProps) {
  const { field, value, editable } = props;
  const [editing, setEditing] = useState(false);

  if (field.isIdField) {
    return (
      <td
        style={{
          ...baseTd,
          color: "var(--accent-ink)",
          fontFamily: "var(--font-mono)",
          fontSize: 11.5
        }}
      >
        {String(value ?? "—")}
      </td>
    );
  }

  if (!editable) {
    return <ReadOnlyCell field={field} value={value} />;
  }

  if (editing) {
    return (
      <Editor
        {...props}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <td
      style={{
        ...baseTd,
        cursor: "text",
        color: "var(--ink-2)"
      }}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Click to edit"
    >
      <DisplayValue field={field} value={value} />
    </td>
  );
}

function ReadOnlyCell({ field, value }: { field: FieldVm; value: unknown }) {
  return (
    <td style={{ ...baseTd, color: "var(--ink-3)" }}>
      <DisplayValue field={field} value={value} />
    </td>
  );
}

function DisplayValue({ field, value }: { field: FieldVm; value: unknown }) {
  if (value == null || value === "") return <span style={{ color: "var(--ink-4)" }}>—</span>;

  if (field.type === "boolean") {
    const truthy = value === true || value === "true" || value === "1";
    return (
      <span
        className={truthy ? "pill pill-green" : "pill"}
        style={{ display: "inline-flex" }}
      >
        {truthy ? "Yes" : "No"}
      </span>
    );
  }

  if (field.type === "single_enum" || field.type === "multi_enum" || field.type === "tag_list") {
    const list = Array.isArray(value) ? value : [String(value)];
    return (
      <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
        {list.map((v, i) => (
          <span key={i} className="pill pill-accent">
            {String(v)}
          </span>
        ))}
      </span>
    );
  }

  if (field.type === "status") {
    return <span className="pill pill-amber">{String(value)}</span>;
  }

  if (field.type === "single_reference" || field.type === "multi_reference") {
    const list: RefValue[] = Array.isArray(value)
      ? (value as RefValue[])
      : typeof value === "object" && value
      ? [value as RefValue]
      : [];
    if (!list.length) return <span style={{ color: "var(--ink-4)" }}>—</span>;
    return (
      <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
        {list.map((r) => (
          <span
            key={r.id}
            className="pill pill-accent mono"
            style={{ fontSize: 11 }}
          >
            <Icon name="link" size={12} />
            {r.label.split(" - ")[0] || r.id.slice(0, 8)}
          </span>
        ))}
      </span>
    );
  }

  if (field.type === "url" && typeof value === "string") {
    return (
      <span
        style={{
          color: "var(--accent-ink)",
          textDecoration: "underline",
          fontSize: 12.5
        }}
      >
        {value}
      </span>
    );
  }

  if (field.type === "date" || field.type === "datetime") {
    const s = String(value);
    return <span className="mono" style={{ fontSize: 11.5 }}>{s}</span>;
  }

  return <>{cellDisplay(value)}</>;
}

function Editor(props: CellProps & { onClose: () => void }) {
  const { field } = props;
  switch (field.type) {
    case "boolean":
      return <BoolEditor {...props} />;
    case "single_enum":
    case "multi_enum":
    case "tag_list":
    case "status":
      return <EnumEditor {...props} />;
    case "date":
      return <DateEditor {...props} kind="date" />;
    case "datetime":
      return <DateEditor {...props} kind="datetime-local" />;
    case "single_reference":
    case "multi_reference":
      return <ReferenceEditor {...props} />;
    case "integer":
    case "decimal":
      return <ScalarEditor {...props} kind="number" />;
    case "url":
      return <ScalarEditor {...props} kind="url" />;
    case "long_text":
    case "rich_note":
      return <TextAreaEditor {...props} />;
    default:
      return <ScalarEditor {...props} kind="text" />;
  }
}

function ScalarEditor({
  value,
  onCommit,
  onClose,
  kind
}: CellProps & { onClose: () => void; kind: "text" | "number" | "url" }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);

  const commit = async () => {
    if (draft !== (value == null ? "" : String(value))) {
      await onCommit(draft);
    }
    onClose();
  };

  return (
    <td style={{ ...baseTd, padding: 0 }}>
      <input
        ref={ref}
        className="input"
        type={kind}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") onClose();
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          minHeight: 0,
          height: 30,
          border: "1px solid var(--sx-accent)",
          borderRadius: 0,
          padding: "4px 12px",
          fontSize: 12.5,
          background: "var(--panel)",
          color: "var(--ink)"
        }}
      />
    </td>
  );
}

function TextAreaEditor({ value, onCommit, onClose }: CellProps & { onClose: () => void }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);

  const commit = async () => {
    if (draft !== (value == null ? "" : String(value))) {
      await onCommit(draft);
    }
    onClose();
  };

  return (
    <td style={{ ...baseTd, padding: 0, whiteSpace: "normal" }}>
      <textarea
        ref={ref}
        className="textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        rows={3}
        style={{
          minHeight: 60,
          border: "1px solid var(--sx-accent)",
          borderRadius: 0,
          background: "var(--panel)",
          color: "var(--ink)",
          fontSize: 12.5,
          padding: "6px 12px"
        }}
      />
    </td>
  );
}

function BoolEditor({ value, onCommit, onClose }: CellProps & { onClose: () => void }) {
  const truthy = value === true || value === "true" || value === "1";
  return (
    <td style={baseTd} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "inline-flex", gap: 6 }}>
        <button
          type="button"
          className={truthy ? "sx-btn sx-btn-primary sx-btn-sm" : "sx-btn sx-btn-sm"}
          onClick={async () => {
            await onCommit("true");
            onClose();
          }}
        >
          Yes
        </button>
        <button
          type="button"
          className={!truthy ? "sx-btn sx-btn-primary sx-btn-sm" : "sx-btn sx-btn-sm"}
          onClick={async () => {
            await onCommit("false");
            onClose();
          }}
        >
          No
        </button>
      </div>
    </td>
  );
}

function DateEditor({
  value,
  onCommit,
  onClose,
  kind
}: CellProps & { onClose: () => void; kind: "date" | "datetime-local" }) {
  const initial = typeof value === "string" ? value : "";
  const [draft, setDraft] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const commit = async () => {
    if (draft !== initial) await onCommit(draft);
    onClose();
  };
  return (
    <td style={{ ...baseTd, padding: 0 }} onClick={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        className="input"
        type={kind}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") onClose();
        }}
        style={{
          minHeight: 0,
          height: 30,
          border: "1px solid var(--sx-accent)",
          borderRadius: 0,
          padding: "4px 12px",
          fontSize: 12.5,
          background: "var(--panel)",
          color: "var(--ink)"
        }}
      />
    </td>
  );
}

function EnumEditor({ field, value, onCommit, onClose }: CellProps & { onClose: () => void }) {
  const multi = field.type === "multi_enum" || field.type === "tag_list";
  const initial = useMemo<string[]>(() => {
    if (Array.isArray(value)) return value.map(String);
    if (value == null || value === "") return [];
    return [String(value)];
  }, [value]);
  const [draft, setDraft] = useState<string[]>(initial);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        commitAndClose();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const commitAndClose = async () => {
    const same =
      draft.length === initial.length && draft.every((v, i) => v === initial[i]);
    if (!same) {
      await onCommit(multi ? draft : draft[0] ?? "");
    }
    onClose();
  };

  const toggle = (val: string) => {
    if (multi) setDraft((d) => (d.includes(val) ? d.filter((v) => v !== val) : [...d, val]));
    else setDraft([val]);
  };

  return (
    <td style={baseTd} onClick={(e) => e.stopPropagation()}>
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          background: "var(--panel)",
          border: "1px solid var(--sx-accent)",
          borderRadius: 6,
          padding: 6,
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          maxWidth: 320
        }}
      >
        {(field.options ?? []).length === 0 && (
          <span style={{ color: "var(--ink-3)", fontSize: 12 }}>No options defined.</span>
        )}
        {(field.options ?? []).map((opt) => {
          const active = draft.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className={active ? "pill pill-accent" : "pill"}
              style={{ cursor: "pointer", border: "1px solid var(--line)" }}
              onClick={() => {
                if (multi) toggle(opt.value);
                else {
                  toggle(opt.value);
                  setTimeout(commitAndClose, 0);
                }
              }}
            >
              {opt.label}
            </button>
          );
        })}
        {multi && (
          <button
            type="button"
            className="sx-btn sx-btn-sm"
            onClick={commitAndClose}
            style={{ marginLeft: "auto" }}
          >
            <Icon name="check" size={12} /> Done
          </button>
        )}
      </div>
    </td>
  );
}

function ReferenceEditor({
  field,
  sheetId,
  value,
  onCommit,
  onClose
}: CellProps & { onClose: () => void }) {
  const multi = field.type === "multi_reference";
  const initial: string[] = useMemo(() => {
    if (Array.isArray(value))
      return (value as RefValue[]).map((v) => v.id);
    if (value && typeof value === "object" && "id" in value)
      return [(value as RefValue).id];
    return [];
  }, [value]);
  const [draft, setDraft] = useState<string[]>(initial);
  const [targets, setTargets] = useState<ReferenceTarget[] | null>(null);
  const [filter, setFilter] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/sheets/${sheetId}/reference-targets`)
      .then(async (r) => (r.ok ? r.json() : { targets: [] }))
      .then((data: { targets: ReferenceTarget[] }) => setTargets(data.targets));
  }, [sheetId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        commitAndClose();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const commitAndClose = async () => {
    const same =
      draft.length === initial.length && draft.every((v, i) => v === initial[i]);
    if (!same) {
      await onCommit(multi ? draft : draft[0] ?? "");
    }
    onClose();
  };

  const toggle = (id: string) => {
    if (multi) setDraft((d) => (d.includes(id) ? d.filter((v) => v !== id) : [...d, id]));
    else setDraft([id]);
  };

  const filtered = (targets ?? []).filter(
    (t) =>
      !filter ||
      (t.visibleId ?? "").toLowerCase().includes(filter.toLowerCase()) ||
      t.sheetName.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <td style={baseTd} onClick={(e) => e.stopPropagation()}>
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          background: "var(--panel)",
          border: "1px solid var(--sx-accent)",
          borderRadius: 6,
          padding: 6,
          width: 360,
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}
      >
        <input
          className="input"
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by ID or sheet…"
          style={{
            minHeight: 0,
            height: 28,
            padding: "4px 10px",
            fontSize: 12.5,
            background: "var(--panel-2)",
            color: "var(--ink)"
          }}
        />
        <div
          style={{
            maxHeight: 220,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 2
          }}
        >
          {targets === null && (
            <div style={{ color: "var(--ink-3)", fontSize: 12 }}>Loading targets…</div>
          )}
          {targets && filtered.length === 0 && (
            <div style={{ color: "var(--ink-3)", fontSize: 12 }}>No matching rows.</div>
          )}
          {filtered.map((t) => {
            const active = draft.includes(t.rowId);
            return (
              <button
                key={t.rowId}
                type="button"
                onClick={() => {
                  toggle(t.rowId);
                  if (!multi) setTimeout(commitAndClose, 0);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  border: 0,
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: "var(--ink-2)",
                  borderRadius: 4,
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontFamily: "inherit"
                }}
              >
                <Icon
                  name={active ? "check" : "link"}
                  size={12}
                  style={{ color: active ? "var(--sx-accent)" : "var(--ink-4)" }}
                />
                <span className="mono" style={{ color: "var(--accent-ink)", fontSize: 11.5 }}>
                  {t.visibleId ?? t.rowId.slice(0, 8)}
                </span>
                <span style={{ color: "var(--ink-3)", marginLeft: "auto", fontSize: 11.5 }}>
                  {t.sheetName}
                </span>
              </button>
            );
          })}
        </div>
        {multi && (
          <button
            type="button"
            className="sx-btn sx-btn-sm"
            onClick={commitAndClose}
            style={{ alignSelf: "flex-end" }}
          >
            <Icon name="check" size={12} /> Done ({draft.length})
          </button>
        )}
      </div>
    </td>
  );
}
