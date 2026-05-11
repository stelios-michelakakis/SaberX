"use client";

import { useState } from "react";
import { Icon } from "@/components/saberx/icon";
import {
  EMPTY_FIELD_VALUE,
  FieldFormFields,
  buildFieldPayload,
  needsOptions,
  type FieldFormValue,
  type SheetOption
} from "@/components/saberx/field-form";
import { useToast } from "@/components/saberx/toast";

export function AddColumnModal({
  sheetId,
  sheets,
  onClose,
  onCreated
}: {
  sheetId: string;
  sheets: SheetOption[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [value, setValue] = useState<FieldFormValue>(EMPTY_FIELD_VALUE);
  const [submitting, setSubmitting] = useState(false);

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
        toast.error("Could not create column", { detail: detail.error });
        return;
      }
      toast.success("Column added", { detail: value.label });
      await onCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 70 }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 560,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "var(--sx-radius-lg)",
          boxShadow: "var(--sx-shadow-lg)",
          padding: 22,
          zIndex: 71
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>Add column</h3>
          <button
            type="button"
            className="sx-btn sx-btn-ghost sx-btn-sm"
            style={{ padding: 4 }}
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={12} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
              justifyContent: "flex-end",
              marginTop: 6
            }}
          >
            <button type="button" className="sx-btn sx-btn-sm" onClick={onClose}>
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
              {submitting ? "Adding…" : "Add column"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
