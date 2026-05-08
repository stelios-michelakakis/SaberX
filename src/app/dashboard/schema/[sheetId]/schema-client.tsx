"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/saberx/icon";
import { useToast } from "@/components/saberx/toast";
import { FIELD_TYPES } from "@/lib/constants";

const FIELD_TYPE_ICON: Record<string, string> = {
  auto_id: "hash",
  short_text: "type",
  long_text: "type",
  rich_note: "type",
  integer: "number",
  decimal: "number",
  boolean: "bool",
  date: "calendar",
  datetime: "calendar",
  single_enum: "tag",
  multi_enum: "tag",
  single_reference: "link",
  multi_reference: "link",
  url: "external",
  status: "flag",
  tag_list: "tag"
};

type FieldRow = {
  id: string;
  label: string;
  slug: string;
  type: string;
  description: string;
  required: boolean;
  unique: boolean;
  editable: boolean;
  isIdField: boolean;
  options: { label: string; value: string }[];
};

export function SchemaClient({
  sheetId,
  documentId,
  systemManaged,
  initialFields
}: {
  sheetId: string;
  documentId: string;
  systemManaged: boolean;
  initialFields: FieldRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [fields, setFields] = useState(initialFields);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingArchiveId, setConfirmingArchiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    const r = await fetch(`/api/sheets/${sheetId}`);
    if (!r.ok) return;
    const data: { fields: FieldRow[] } = await r.json();
    setFields(data.fields);
  };

  const onMove = async (fieldId: string, dir: -1 | 1) => {
    const idx = fields.findIndex((f) => f.id === fieldId);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= fields.length) return;
    const reordered = [...fields];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(nextIdx, 0, item);
    setFields(reordered);
    const order = reordered.map((f) => f.id);
    const res = await fetch(`/api/sheets/${sheetId}/reorder-fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order })
    });
    if (!res.ok) {
      toast.error("Reorder failed");
      await refresh();
      return;
    }
    router.refresh();
  };

  const onArchive = async (fieldId: string) => {
    const res = await fetch(`/api/fields/${fieldId}`, { method: "DELETE" });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      toast.error("Could not archive field", { detail: detail.error });
      return;
    }
    toast.success("Field archived");
    setConfirmingArchiveId(null);
    await refresh();
    router.refresh();
  };

  return (
    <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
      {systemManaged && (
        <div
          style={{
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
            <strong>Glossary schema is system-managed.</strong> The Block / Field or Code / Value
            or Meaning columns are fixed.
          </span>
        </div>
      )}

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
              <Th>Order</Th>
              <Th>Label</Th>
              <Th>Slug</Th>
              <Th>Type</Th>
              <Th>Required</Th>
              <Th>Unique</Th>
              <Th>Description</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}
                >
                  No fields yet. Click <strong>+ Add field</strong> below.
                </td>
              </tr>
            )}
            {fields.map((f, i) => {
              const editable = !systemManaged && !f.isIdField;
              const isEditing = editingId === f.id;
              return isEditing ? (
                <EditFieldRow
                  key={f.id}
                  field={f}
                  onClose={() => setEditingId(null)}
                  onSaved={async () => {
                    setEditingId(null);
                    await refresh();
                    router.refresh();
                  }}
                />
              ) : (
                <tr key={f.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <Td>
                    {editable ? (
                      <span style={{ display: "inline-flex", gap: 2 }}>
                        <button
                          className="sx-btn sx-btn-ghost sx-btn-sm"
                          style={{ padding: 2 }}
                          onClick={() => onMove(f.id, -1)}
                          disabled={i === 0}
                          aria-label="Move up"
                        >
                          <Icon name="chevronU" size={12} />
                        </button>
                        <button
                          className="sx-btn sx-btn-ghost sx-btn-sm"
                          style={{ padding: 2 }}
                          onClick={() => onMove(f.id, 1)}
                          disabled={i === fields.length - 1}
                          aria-label="Move down"
                        >
                          <Icon name="chevronD" size={12} />
                        </button>
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-4)", fontSize: 11.5 }}>
                        {i + 1}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <strong style={{ color: "var(--ink)" }}>{f.label}</strong>
                    {f.isIdField && (
                      <span className="pill pill-accent" style={{ marginLeft: 8 }}>
                        ID
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                      {f.slug}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Icon
                        name={FIELD_TYPE_ICON[f.type] ?? "type"}
                        size={12}
                        style={{ color: "var(--ink-3)" }}
                      />
                      {f.type}
                    </span>
                  </Td>
                  <Td>{f.required ? <span className="pill pill-amber">Required</span> : <Dim />}</Td>
                  <Td>{f.unique ? <span className="pill pill-accent">Unique</span> : <Dim />}</Td>
                  <Td>{f.description || <Dim />}</Td>
                  <Td>
                    {editable && (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <button
                          className="sx-btn sx-btn-ghost sx-btn-sm"
                          style={{ padding: 4 }}
                          onClick={() => setEditingId(f.id)}
                          aria-label="Edit field"
                          title="Edit field"
                        >
                          <Icon name="edit" size={12} />
                        </button>
                        {confirmingArchiveId === f.id ? (
                          <>
                            <button
                              className="sx-btn sx-btn-sm"
                              style={{
                                color: "var(--red)",
                                borderColor: "var(--red)",
                                background: "var(--red-soft)"
                              }}
                              onClick={() => onArchive(f.id)}
                            >
                              <Icon name="check" size={12} /> Archive
                            </button>
                            <button
                              className="sx-btn sx-btn-sm"
                              onClick={() => setConfirmingArchiveId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="sx-btn sx-btn-ghost sx-btn-sm"
                            style={{ padding: 4, color: "var(--red)" }}
                            onClick={() => setConfirmingArchiveId(f.id)}
                            aria-label="Archive field"
                            title="Archive field"
                          >
                            <Icon name="trash" size={12} />
                          </button>
                        )}
                      </span>
                    )}
                  </Td>
                </tr>
              );
            })}
            {!systemManaged && (
              <NewFieldRow
                sheetId={sheetId}
                creating={creating}
                setCreating={setCreating}
                onCreated={async () => {
                  await refresh();
                  router.refresh();
                }}
              />
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>
        Document <span className="mono">{documentId.slice(0, 8)}…</span>
      </div>
    </div>
  );
}

function NewFieldRow({
  sheetId,
  creating,
  setCreating,
  onCreated
}: {
  sheetId: string;
  creating: boolean;
  setCreating: (v: boolean) => void;
  onCreated: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<(typeof FIELD_TYPES)[number]>("short_text");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState("");

  const submit = async () => {
    setCreating(true);
    try {
      const optionList = options
        .split(/[,\n]/)
        .map((o) => o.trim())
        .filter(Boolean);
      const res = await fetch(`/api/sheets/${sheetId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, type, description, required, options: optionList })
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        toast.error("Could not create field", { detail: detail.error });
        return;
      }
      toast.success("Field created");
      setLabel("");
      setDescription("");
      setRequired(false);
      setOptions("");
      setType("short_text");
      setOpen(false);
      await onCreated();
    } finally {
      setCreating(false);
    }
  };

  if (!open) {
    return (
      <tr
        onClick={() => setOpen(true)}
        style={{
          borderTop: "1px dashed var(--line-strong)",
          background: "var(--panel-2)",
          cursor: "pointer"
        }}
      >
        <td colSpan={8} style={{ padding: "10px 14px", color: "var(--ink-3)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="plus" size={12} /> Add field
          </span>
        </td>
      </tr>
    );
  }

  const needsOptions = ["single_enum", "multi_enum", "status", "tag_list"].includes(type);

  return (
    <tr style={{ borderTop: "1px dashed var(--line-strong)", background: "var(--accent-soft)" }}>
      <td colSpan={8} style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Label">
            <input
              className="input"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Priority"
            />
          </Field>
          <Field label="Type">
            <select
              className="select"
              value={type}
              onChange={(e) => setType(e.target.value as (typeof FIELD_TYPES)[number])}
            >
              {FIELD_TYPES.filter((t) => t !== "auto_id").map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description" full>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
          {needsOptions && (
            <Field label="Options (comma- or newline-separated)" full>
              <textarea
                className="textarea"
                rows={2}
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="P0, P1, P2"
              />
            </Field>
          )}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "var(--ink-2)",
              gridColumn: "1 / -1"
            }}
          >
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            Required
          </label>
          <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="sx-btn sx-btn-sm"
              onClick={() => {
                setOpen(false);
                setLabel("");
                setDescription("");
                setRequired(false);
                setOptions("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sx-btn sx-btn-primary sx-btn-sm"
              onClick={submit}
              disabled={creating || !label.trim()}
            >
              {creating ? "Creating…" : "Create field"}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function EditFieldRow({
  field,
  onClose,
  onSaved
}: {
  field: FieldRow;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [label, setLabel] = useState(field.label);
  const [description, setDescription] = useState(field.description);
  const [required, setRequired] = useState(field.required);
  const [unique, setUnique] = useState(field.unique);
  const [options, setOptions] = useState(field.options.map((o) => o.value).join(", "));
  const [saving, setSaving] = useState(false);

  const needsOptions = ["single_enum", "multi_enum", "status", "tag_list"].includes(field.type);

  const submit = async () => {
    setSaving(true);
    try {
      const optionList = needsOptions
        ? options
            .split(/[,\n]/)
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;
      const res = await fetch(`/api/fields/${field.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          description,
          required,
          unique,
          ...(optionList ? { options: optionList } : {})
        })
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        toast.error("Save failed", { detail: detail.error });
        return;
      }
      toast.success("Field updated");
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr style={{ borderTop: "1px solid var(--line)", background: "var(--accent-soft)" }}>
      <td colSpan={8} style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Label">
            <input
              className="input"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          <Field label="Type (immutable)">
            <input className="input" value={field.type} disabled />
          </Field>
          <Field label="Description" full>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
          {needsOptions && (
            <Field label="Options (comma- or newline-separated)" full>
              <textarea
                className="textarea"
                rows={2}
                value={options}
                onChange={(e) => setOptions(e.target.value)}
              />
            </Field>
          )}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "var(--ink-2)"
            }}
          >
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            Required
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "var(--ink-2)"
            }}
          >
            <input
              type="checkbox"
              checked={unique}
              onChange={(e) => setUnique(e.target.checked)}
            />
            Unique
          </label>
          <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1", justifyContent: "flex-end" }}>
            <button type="button" className="sx-btn sx-btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="sx-btn sx-btn-primary sx-btn-sm"
              onClick={submit}
              disabled={saving || !label.trim()}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function Field({
  label,
  children,
  full
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 4, gridColumn: full ? "1 / -1" : undefined }}>
      <span
        style={{
          fontSize: 11,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.04em"
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Dim() {
  return <span style={{ color: "var(--ink-4)" }}>—</span>;
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

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "10px 14px",
        fontSize: 12.5,
        color: "var(--ink-2)",
        verticalAlign: "middle"
      }}
    >
      {children}
    </td>
  );
}
