"use client";

import { Icon } from "./icon";
import { FIELD_TYPES } from "@/lib/constants";

export type SheetOption = { id: string; name: string; sheetKind: string };

export type FieldFormValue = {
  label: string;
  type: (typeof FIELD_TYPES)[number];
  description: string;
  required: boolean;
  unique: boolean;
  editable: boolean;
  options: string; // comma/newline-separated
  bindings: { allowedSheetId: string; allowSelfReference: boolean }[];
};

export const EMPTY_FIELD_VALUE: FieldFormValue = {
  label: "",
  type: "short_text",
  description: "",
  required: false,
  unique: false,
  editable: true,
  options: "",
  bindings: []
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
            allowSelfReference: sheetId === currentSheetId
          }
        ];
    update("bindings", next);
  };

  const referenceMode = isReferenceType(value.type);
  const optionMode = needsOptions(value.type);
  const eligibleSheets = sheets.filter(
    (s) => s.sheetKind !== "instructions" && s.sheetKind !== "glossary"
  );

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
          {eligibleSheets.length === 0 ? (
            <div style={{ color: "var(--ink-3)", fontSize: 12 }}>
              No other sheets to reference yet — add a sheet first or leave empty to allow all.
            </div>
          ) : (
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
              {eligibleSheets.map((s) => {
                const active = value.bindings.some((b) => b.allowedSheetId === s.id);
                const isSelf = s.id === currentSheetId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSheet(s.id)}
                    className={active ? "pill pill-accent" : "pill"}
                    style={{ cursor: "pointer", border: "1px solid var(--line)" }}
                    title={isSelf ? "Self-references (rows in this sheet)" : undefined}
                  >
                    {active ? (
                      <Icon name="check" size={12} />
                    ) : (
                      <Icon name="link" size={12} />
                    )}
                    {s.name}
                    {isSelf && <span style={{ opacity: 0.7, fontSize: 10 }}>(self)</span>}
                  </button>
                );
              })}
            </div>
          )}
          <p style={{ margin: 0, color: "var(--ink-4)", fontSize: 11 }}>
            Leave empty to allow references to any sheet in this document (excluding open
            issues).
          </p>
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
  return {
    label: value.label,
    type: value.type,
    description: value.description,
    required: value.required,
    unique: value.unique,
    editable: value.editable,
    options: optionList,
    bindings: isReferenceType(value.type) ? value.bindings : []
  };
}
