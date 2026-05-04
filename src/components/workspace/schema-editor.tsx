"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import type { SheetVm } from "./types";

const fieldTypes = ["short_text", "long_text", "integer", "decimal", "boolean", "date", "datetime", "single_enum", "multi_enum", "single_reference", "multi_reference", "url", "status", "tag_list", "rich_note"];

export function SchemaEditor({ documentId, sheet }: { documentId: string | null; sheet: SheetVm | null }) {
  const queryClient = useQueryClient();
  const [sheetName, setSheetName] = useState("");
  const [prefix, setPrefix] = useState("REQ");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("short_text");
  const [fieldDescription, setFieldDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createSheet = useMutation({
    mutationFn: async () => {
      if (!documentId) throw new Error("Select a document first");
      const response = await fetch(`/api/documents/${documentId}/sheets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: sheetName, idPrefix: prefix, zeroPad: 2 })
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not create sheet");
      return response.json();
    },
    onSuccess: () => {
      setSheetName("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not create sheet")
  });

  const createField = useMutation({
    mutationFn: async () => {
      if (!sheet) throw new Error("Select a sheet first");
      const response = await fetch(`/api/sheets/${sheet.id}/fields`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: fieldLabel, type: fieldType, description: fieldDescription })
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not create field");
      return response.json();
    },
    onSuccess: () => {
      setFieldLabel("");
      setFieldDescription("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      if (sheet) queryClient.invalidateQueries({ queryKey: ["sheet", sheet.id] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not create field")
  });

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>Create/Edit Structure</h3>
      {error ? <p className="error">{error}</p> : null}
      <div className="form-stack" style={{ gridTemplateColumns: "1fr 90px auto", alignItems: "end" }}>
        <label className="field-label">
          New sheet
          <input className="input" value={sheetName} onChange={(event) => setSheetName(event.target.value)} placeholder="REQUIREMENTS_REGISTER" />
        </label>
        <label className="field-label">
          Prefix
          <input className="input" value={prefix} onChange={(event) => setPrefix(event.target.value.toUpperCase())} />
        </label>
        <button className="button" onClick={() => createSheet.mutate()}>
          <Plus size={15} /> Sheet
        </button>
      </div>
      <div className="form-stack" style={{ gridTemplateColumns: "1fr 160px 1fr auto", alignItems: "end", marginTop: 14 }}>
        <label className="field-label">
          Field
          <input className="input" value={fieldLabel} onChange={(event) => setFieldLabel(event.target.value)} placeholder="Verification Method" />
        </label>
        <label className="field-label">
          Type
          <select className="select" value={fieldType} onChange={(event) => setFieldType(event.target.value)}>
            {fieldTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Description
          <input className="input" value={fieldDescription} onChange={(event) => setFieldDescription(event.target.value)} />
        </label>
        <button className="button" onClick={() => createField.mutate()} disabled={!sheet || sheet.isSystemReserved}>
          <Plus size={15} /> Field
        </button>
      </div>
    </div>
  );
}
