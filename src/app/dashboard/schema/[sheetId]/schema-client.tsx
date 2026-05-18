"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/saberx/icon";
import { useToast } from "@/components/saberx/toast";
import {
  EMPTY_FIELD_VALUE,
  FieldFormFields,
  buildFieldPayload,
  needsOptions,
  type FieldFormValue,
  type SheetOption
} from "@/components/saberx/field-form";

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
  bindings: { allowedSheetId: string; allowSelfReference: boolean; displayFieldId?: string | null; allowSources?: boolean }[];
};

export function SchemaClient({
  sheetId,
  documentId,
  systemManaged,
  initialFields,
  sheets
}: {
  sheetId: string;
  documentId: string;
  systemManaged: boolean;
  initialFields: FieldRow[];
  sheets: SheetOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [fields, setFields] = useState(initialFields);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingArchiveId, setConfirmingArchiveId] = useState<string | null>(null);
  const [creatingOpen, setCreatingOpen] = useState(false);

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
            <strong>Glossary schema is system-managed.</strong>
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
              <Th>Flags</Th>
              <Th>Description</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr>
                <td
                  colSpan={7}
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
                  sheets={sheets}
                  currentSheetId={sheetId}
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
                      {(f.type === "single_reference" || f.type === "multi_reference") &&
                        f.bindings.length > 0 && (
                          <span
                            className="pill"
                            title="Reference targets restricted"
                            style={{ fontSize: 10 }}
                          >
                            {f.bindings.length} target
                            {f.bindings.length === 1 ? "" : "s"}
                          </span>
                        )}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                      {f.required && <span className="pill pill-amber">Required</span>}
                      {f.unique && <span className="pill pill-accent">Unique</span>}
                      {!f.editable && !f.isIdField && (
                        <span className="pill">Read-only</span>
                      )}
                      {!f.required && !f.unique && (f.editable || f.isIdField) && <Dim />}
                    </span>
                  </Td>
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
                open={creatingOpen}
                setOpen={setCreatingOpen}
                sheets={sheets}
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
  open,
  setOpen,
  sheets,
  onCreated
}: {
  sheetId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  sheets: SheetOption[];
  onCreated: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [value, setValue] = useState<FieldFormValue>(EMPTY_FIELD_VALUE);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setValue(EMPTY_FIELD_VALUE);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sheets/${sheetId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildFieldPayload(value))
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        toast.error("Could not create field", { detail: detail.error });
        return;
      }
      toast.success("Field created");
      reset();
      setOpen(false);
      await onCreated();
    } finally {
      setSubmitting(false);
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
        <td colSpan={7} style={{ padding: "10px 14px", color: "var(--ink-3)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="plus" size={12} /> Add field
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderTop: "1px dashed var(--line-strong)", background: "var(--accent-soft)" }}>
      <td colSpan={7} style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldFormFields
            value={value}
            onChange={setValue}
            sheets={sheets}
            currentSheetId={sheetId}
          />
          <div
            style={{
              display: "flex",
              gap: 8,
              gridColumn: "1 / -1",
              justifyContent: "flex-end"
            }}
          >
            <button
              type="button"
              className="sx-btn sx-btn-sm"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sx-btn sx-btn-primary sx-btn-sm"
              onClick={submit}
              disabled={
                submitting ||
                !value.label.trim() ||
                (needsOptions(value.type) && !value.options.trim())
              }
            >
              {submitting ? "Creating…" : "Create field"}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function EditFieldRow({
  field,
  sheets,
  currentSheetId,
  onClose,
  onSaved
}: {
  field: FieldRow;
  sheets: SheetOption[];
  currentSheetId: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [value, setValue] = useState<FieldFormValue>({
    label: field.label,
    type: field.type as FieldFormValue["type"],
    description: field.description,
    required: field.required,
    unique: field.unique,
    editable: field.editable,
    options: field.options.map((o) => o.value).join(", "),
    bindings: field.bindings.map((b) => ({
      allowedSheetId: b.allowedSheetId,
      allowSelfReference: b.allowSelfReference,
      displayFieldId: b.displayFieldId ?? null
    })),
    allowSources: field.bindings.some((b) => b.allowSources === true)
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue({
      label: field.label,
      type: field.type as FieldFormValue["type"],
      description: field.description,
      required: field.required,
      unique: field.unique,
      editable: field.editable,
      options: field.options.map((o) => o.value).join(", "),
      bindings: field.bindings.map((b) => ({
        allowedSheetId: b.allowedSheetId,
        allowSelfReference: b.allowSelfReference,
        displayFieldId: b.displayFieldId ?? null
      })),
      allowSources: field.bindings.some((b) => b.allowSources === true)
    });
  }, [field.id]);

  const submit = async () => {
    setSaving(true);
    try {
      const payload = buildFieldPayload(value);
      const res = await fetch(`/api/fields/${field.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: payload.label,
          description: payload.description,
          required: payload.required,
          unique: payload.unique,
          editable: payload.editable,
          ...(needsOptions(value.type) ? { options: payload.options } : {}),
          ...(payload.bindings.length > 0 || field.bindings.length > 0
            ? { bindings: payload.bindings }
            : {})
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
      <td colSpan={7} style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldFormFields
            value={value}
            onChange={setValue}
            sheets={sheets}
            currentSheetId={currentSheetId}
            lockType
          />
          <div
            style={{
              display: "flex",
              gap: 8,
              gridColumn: "1 / -1",
              justifyContent: "flex-end"
            }}
          >
            <button type="button" className="sx-btn sx-btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="sx-btn sx-btn-primary sx-btn-sm"
              onClick={submit}
              disabled={saving || !value.label.trim()}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </td>
    </tr>
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
