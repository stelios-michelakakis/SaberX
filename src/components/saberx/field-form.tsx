"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { FIELD_TYPES } from "@/lib/constants";

export type SheetOption = { id: string; name: string; sheetKind: string };

type TreeDoc = {
  id: string;
  title: string;
  sheets: { id: string; name: string; sheetKind: string }[];
};

export type FieldFormValue = {
  label: string;
  type: (typeof FIELD_TYPES)[number];
  description: string;
  required: boolean;
  unique: boolean;
  editable: boolean;
  options: string; // comma/newline-separated
  bindings: { allowedSheetId: string | null; allowSelfReference: boolean; displayFieldId: string | null }[];
  // When true, the reference picker also lists uploaded sources alongside
  // row targets. Stored on every binding row (allow_sources) so the picker
  // can detect it from any single binding row at read time.
  allowSources: boolean;
};

export const EMPTY_FIELD_VALUE: FieldFormValue = {
  label: "",
  type: "short_text",
  description: "",
  required: false,
  unique: false,
  editable: true,
  options: "",
  bindings: [],
  allowSources: false
};

export function needsOptions(type: string) {
  return ["single_enum", "multi_enum", "status", "tag_list"].includes(type);
}

export function isReferenceType(type: string) {
  return type === "single_reference" || type === "multi_reference";
}

export function FieldFormFields({
  value,
  onChange,
  sheets,
  currentSheetId,
  lockType
}: {
  value: FieldFormValue;
  onChange: (next: FieldFormValue) => void;
  sheets: SheetOption[];
  currentSheetId: string;
  lockType?: boolean;
}) {
  const update = <K extends keyof FieldFormValue>(key: K, v: FieldFormValue[K]) =>
    onChange({ ...value, [key]: v });

  const toggleSheet = (sheetId: string) => {
    const exists = value.bindings.some((b) => b.allowedSheetId === sheetId);
    const next = exists
      ? value.bindings.filter((b) => b.allowedSheetId !== sheetId)
      : [
          ...value.bindings,
          {
            allowedSheetId: sheetId,
            allowSelfReference: sheetId === currentSheetId,
            displayFieldId: null
          }
        ];
    update("bindings", next);
  };

  const setDisplayField = (sheetId: string, displayFieldId: string | null) => {
    update(
      "bindings",
      value.bindings.map((b) =>
        b.allowedSheetId === sheetId ? { ...b, displayFieldId } : b
      )
    );
  };

  const referenceMode = isReferenceType(value.type);
  const optionMode = needsOptions(value.type);
  const eligibleSheets = sheets.filter(
    (s) => s.sheetKind !== "instructions" && s.sheetKind !== "glossary"
  );

  const [tree, setTree] = useState<TreeDoc[] | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  useEffect(() => {
    if (!referenceMode) return;
    let cancelled = false;
    fetch("/api/reference-targets/tree")
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load reference targets (${r.status})`);
        const data = (await r.json()) as { documents: TreeDoc[] };
        if (!cancelled) setTree(data.documents);
      })
      .catch((e: Error) => {
        if (!cancelled) setTreeError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [referenceMode]);

  const sheetById = new Map<string, { id: string; name: string; documentTitle: string }>();
  if (tree) {
    for (const d of tree) {
      for (const s of d.sheets) {
        sheetById.set(s.id, { id: s.id, name: s.name, documentTitle: d.title });
      }
    }
  }
  for (const s of eligibleSheets) {
    if (!sheetById.has(s.id)) sheetById.set(s.id, { id: s.id, name: s.name, documentTitle: "" });
  }

  return (
    <>
      <FormLabel label="Label">
        <input
          className="input"
          autoFocus={!lockType}
          value={value.label}
          onChange={(e) => update("label", e.target.value)}
          placeholder="e.g. Priority"
        />
      </FormLabel>

      <FormLabel label={lockType ? "Type (immutable)" : "Type"}>
        {lockType ? (
          <input className="input" value={value.type} disabled />
        ) : (
          <select
            className="select"
            value={value.type}
            onChange={(e) => update("type", e.target.value as FieldFormValue["type"])}
          >
            {FIELD_TYPES.filter((t) => t !== "auto_id").map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </FormLabel>

      <FormLabel label="Description" full>
        <textarea
          className="textarea"
          value={value.description}
          onChange={(e) => update("description", e.target.value)}
          rows={2}
        />
      </FormLabel>

      {optionMode && (
        <FormLabel label="Options (comma- or newline-separated)" full>
          <textarea
            className="textarea"
            rows={2}
            value={value.options}
            onChange={(e) => update("options", e.target.value)}
            placeholder="Low, Medium, High"
          />
        </FormLabel>
      )}

      {referenceMode && (
        <div style={{ gridColumn: "1 / -1", display: "grid", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: "0.04em"
            }}
          >
            Allowed reference targets
          </span>
          {treeError && (
            <div style={{ color: "var(--red)", fontSize: 12 }}>{treeError}</div>
          )}
          {!treeError && tree === null && (
            <div style={{ color: "var(--ink-3)", fontSize: 12 }}>Loading…</div>
          )}
          {!treeError && tree !== null && tree.length === 0 && (
            <div style={{ color: "var(--ink-3)", fontSize: 12 }}>
              No documents to reference yet.
            </div>
          )}
          {!treeError && tree !== null && tree.length > 0 && (
            <TreePicker
              documents={tree}
              currentSheetId={currentSheetId}
              selected={new Set(
                value.bindings
                  .map((b) => b.allowedSheetId)
                  .filter((id): id is string => Boolean(id))
              )}
              onToggle={toggleSheet}
            />
          )}
          <p style={{ margin: 0, color: "var(--ink-4)", fontSize: 11 }}>
            Leave empty to allow references to any sheet in <em>this</em> document. Pick
            sheets from any document (including others) to restrict the picker to those
            targets.
          </p>
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginTop: 8
            }}
          >
            Sources
          </span>
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              background: "var(--panel-2)"
            }}
          >
            <button
              type="button"
              onClick={() => update("allowSources", !value.allowSources)}
              className={value.allowSources ? "pill pill-accent" : "pill"}
              style={{ cursor: "pointer", border: "1px solid var(--line)" }}
              title="Uploaded sources from the global library (PDF, DOCX, MD, TXT)"
            >
              {value.allowSources ? <Icon name="check" size={12} /> : <Icon name="folder" size={12} />}
              Allow source links
            </button>
          </div>
          <p style={{ margin: 0, color: "var(--ink-4)", fontSize: 11 }}>
            When enabled, the picker also lists uploaded sources (PDF, DOCX, MD, TXT) from the
            global library.
          </p>
          {value.bindings.length > 0 && (
            <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--ink-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em"
                }}
              >
                Display field per target
              </span>
              {value.bindings.map((b) => {
                if (b.allowedSheetId === null) return null;
                const sheetId = b.allowedSheetId;
                const sheet = sheetById.get(sheetId);
                if (!sheet) return null;
                const label = sheet.documentTitle
                  ? `${sheet.documentTitle} · ${sheet.name}`
                  : sheet.name;
                return (
                  <DisplayFieldRow
                    key={sheetId}
                    sheetId={sheetId}
                    sheetName={label}
                    value={b.displayFieldId}
                    onChange={(next) => setDisplayField(sheetId, next)}
                  />
                );
              })}
              <p style={{ margin: 0, color: "var(--ink-4)", fontSize: 11 }}>
                Reference chips and pickers will show the chosen field&apos;s value instead
                of the row ID. Defaults to the ID field.
              </p>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          color: "var(--ink-2)",
          fontSize: 12.5
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={value.required}
            onChange={(e) => update("required", e.target.checked)}
          />
          Required
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={value.unique}
            onChange={(e) => update("unique", e.target.checked)}
          />
          Unique
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={value.editable}
            onChange={(e) => update("editable", e.target.checked)}
          />
          Editable
        </label>
      </div>
    </>
  );
}

type SheetFieldOption = { id: string; label: string; type: string };

function DisplayFieldRow({
  sheetId,
  sheetName,
  value,
  onChange
}: {
  sheetId: string;
  sheetName: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [options, setOptions] = useState<SheetFieldOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOptions(null);
    setError(null);
    fetch(`/api/sheets/${sheetId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        const data = (await r.json()) as { fields?: { id: string; label: string; type: string }[] };
        if (cancelled) return;
        setOptions(
          (data.fields ?? []).map((f) => ({ id: f.id, label: f.label, type: f.type }))
        );
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [sheetId]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gap: 8,
        alignItems: "center",
        fontSize: 12.5
      }}
    >
      <span style={{ color: "var(--ink-2)" }}>{sheetName}</span>
      {error && <span style={{ color: "var(--red)", fontSize: 11 }}>{error}</span>}
      {!error && (
        <select
          className="select"
          value={value ?? ""}
          disabled={options === null}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">Use ID field (default)</option>
          {(options ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} ({o.type})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function TreePicker({
  documents,
  currentSheetId,
  selected,
  onToggle
}: {
  documents: TreeDoc[];
  currentSheetId: string;
  selected: Set<string>;
  onToggle: (sheetId: string) => void;
}) {
  const initialOpen = (): Set<string> => {
    const open = new Set<string>();
    for (const d of documents) {
      const hasSelected = d.sheets.some((s) => selected.has(s.id));
      const hasCurrent = d.sheets.some((s) => s.id === currentSheetId);
      if (hasSelected || hasCurrent) open.add(d.id);
    }
    if (open.size === 0 && documents.length > 0) open.add(documents[0].id);
    return open;
  };
  const [openDocs, setOpenDocs] = useState<Set<string>>(initialOpen);

  const toggleDoc = (id: string) => {
    setOpenDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: 6,
        background: "var(--panel-2)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxHeight: 280,
        overflowY: "auto"
      }}
    >
      {documents.map((doc) => {
        const open = openDocs.has(doc.id);
        const selectedCount = doc.sheets.filter((s) => selected.has(s.id)).length;
        return (
          <div key={doc.id} style={{ display: "flex", flexDirection: "column" }}>
            <button
              type="button"
              onClick={() => toggleDoc(doc.id)}
              aria-expanded={open}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 6px",
                borderRadius: 4,
                fontSize: 12.5,
                color: "var(--ink)"
              }}
            >
              <Icon name={open ? "chevronD" : "chevronR"} size={11} />
              <Icon name="docs" size={12} style={{ color: "var(--ink-3)" }} />
              <span style={{ fontWeight: 500 }}>{doc.title}</span>
              {selectedCount > 0 && (
                <span
                  className="pill pill-accent"
                  style={{ marginLeft: "auto", fontSize: 10, padding: "0 6px" }}
                >
                  {selectedCount}
                </span>
              )}
            </button>
            {open && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 24 }}>
                {doc.sheets.length === 0 && (
                  <span style={{ color: "var(--ink-4)", fontSize: 11, padding: "4px 6px" }}>
                    No referenceable sheets in this document.
                  </span>
                )}
                {doc.sheets.map((s) => {
                  const active = selected.has(s.id);
                  const isSelf = s.id === currentSheetId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onToggle(s.id)}
                      style={{
                        all: "unset",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "4px 8px",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: active ? "var(--accent-soft)" : "transparent",
                        color: active ? "var(--ink)" : "var(--ink-2)"
                      }}
                      title={isSelf ? "Self-references (rows in this sheet)" : undefined}
                    >
                      <Icon
                        name={active ? "check" : "link"}
                        size={12}
                        style={{
                          color: active ? "var(--sx-accent)" : "var(--ink-4)",
                          flex: "none"
                        }}
                      />
                      <span>{s.name}</span>
                      {isSelf && (
                        <span style={{ opacity: 0.7, fontSize: 10, color: "var(--ink-3)" }}>
                          (self)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormLabel({
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

export function buildFieldPayload(value: FieldFormValue) {
  const optionList = needsOptions(value.type)
    ? value.options
        .split(/[,\n]/)
        .map((o) => o.trim())
        .filter(Boolean)
    : [];
  let bindings: {
    allowedSheetId: string | null;
    allowSelfReference: boolean;
    displayFieldId: string | null;
    allowSources: boolean;
  }[] = [];
  if (isReferenceType(value.type)) {
    bindings = value.bindings.map((b) => ({
      allowedSheetId: b.allowedSheetId,
      allowSelfReference: b.allowSelfReference,
      displayFieldId: b.displayFieldId,
      allowSources: value.allowSources
    }));
    if (value.allowSources && bindings.length === 0) {
      bindings.push({
        allowedSheetId: null,
        allowSelfReference: false,
        displayFieldId: null,
        allowSources: true
      });
    }
  }
  return {
    label: value.label,
    type: value.type,
    description: value.description,
    required: value.required,
    unique: value.unique,
    editable: value.editable,
    options: optionList,
    bindings
  };
}
