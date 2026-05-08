"use client";

import { useState } from "react";
import { Icon } from "@/components/saberx/icon";
import { useToast } from "@/components/saberx/toast";

export function NewSheetModal({
  documentId,
  onClose,
  onCreated
}: {
  documentId: string;
  onClose: () => void;
  onCreated: (sheetId: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [idPrefix, setIdPrefix] = useState("ID");
  const [zeroPad, setZeroPad] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          idPrefix,
          zeroPad
        })
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const message =
          detail.error || (typeof detail.detail === "string" ? detail.detail : `Failed (${res.status})`);
        setError(message);
        return;
      }
      const data: { sheet: { id: string } } = await res.json();
      toast.success("Sheet created", { detail: name });
      onCreated(data.sheet.id);
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
          width: 460,
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
          <h3 style={{ margin: 0, fontSize: 16 }}>New sheet</h3>
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

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Sheet name">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Operational Scenarios"
            />
          </Field>
          <Field label="Description">
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="ID prefix (no separators)">
              <input
                className="input"
                value={idPrefix}
                onChange={(e) => setIdPrefix(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                placeholder="SCN"
              />
            </Field>
            <Field label="Zero padding">
              <input
                className="input"
                type="number"
                min={1}
                max={8}
                value={zeroPad}
                onChange={(e) => setZeroPad(Math.max(1, Math.min(8, Number(e.target.value) || 4)))}
              />
            </Field>
          </div>
          <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 11.5 }}>
            Visible IDs will be generated as <span className="mono">{idPrefix || "ID"}-
            {"0".repeat(Math.max(0, zeroPad - 1))}1</span>, …
          </p>
          {error && <div className="error" style={{ fontSize: 12 }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            <button type="button" className="sx-btn sx-btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="sx-btn sx-btn-primary sx-btn-sm"
              onClick={submit}
              disabled={submitting || !name.trim() || !idPrefix.trim()}
            >
              {submitting ? "Creating…" : "Create sheet"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
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
