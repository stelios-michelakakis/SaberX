"use client";

import { useState } from "react";
import { Icon } from "@/components/saberx/icon";
import { useToast } from "@/components/saberx/toast";

const STATUS_OPTIONS = ["draft", "under_review", "baselined", "superseded", "seed"];
const BASELINE_OPTIONS = ["draft", "under_review", "baselined", "superseded"];

export function EditDocumentModal({
  document,
  onClose,
  onSaved
}: {
  document: {
    id: string;
    title: string;
    description: string;
    status: string;
    classification: string;
    baselineState: string;
    templateType: string | null;
    version: number;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description ?? "");
  const [status, setStatus] = useState(document.status);
  const [classification, setClassification] = useState(document.classification);
  const [baselineState, setBaselineState] = useState(document.baselineState);
  const [templateType, setTemplateType] = useState(document.templateType ?? "");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          status,
          classification,
          baselineState,
          templateType: templateType || null,
          version: document.version
        })
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        toast.error("Failed to save", { detail: detail.error });
        return;
      }
      toast.success("Document updated");
      onSaved();
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
          width: 520,
          maxHeight: "85vh",
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
          <h3 style={{ margin: 0, fontSize: 16 }}>Edit document</h3>
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
          <Field label="Title">
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Description">
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Type">
              <input
                className="input"
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                placeholder="CONOPS / ICD / RTM / …"
              />
            </Field>
            <Field label="Classification">
              <input
                className="input"
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                placeholder="unclassified / cui / …"
              />
            </Field>
            <Field label="Status">
              <select
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Baseline state">
              <select
                className="select"
                value={baselineState}
                onChange={(e) => setBaselineState(e.target.value)}
              >
                {BASELINE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            <button type="button" className="sx-btn sx-btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="sx-btn sx-btn-primary sx-btn-sm"
              onClick={submit}
              disabled={submitting || !title.trim()}
            >
              {submitting ? "Saving…" : "Save"}
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
