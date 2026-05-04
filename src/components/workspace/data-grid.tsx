"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { FieldVm, GridRowVm, SheetGridVm } from "./types";

async function patchCell(rowId: string, fieldId: string, value: unknown, rowVersion?: number) {
  const response = await fetch(`/api/rows/${rowId}/cells`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fieldId, value, rowVersion })
  });
  if (!response.ok) throw new Error((await response.json()).error ?? "Cell update failed");
  return response.json();
}

async function createRow(sheetId: string, cells: Record<string, unknown>) {
  const response = await fetch(`/api/sheets/${sheetId}/rows`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cells })
  });
  if (!response.ok) throw new Error((await response.json()).error ?? "Row creation failed");
  return response.json();
}

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => item.label ?? String(item)).join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

export function DataGrid({ grid, analysisActive, onAnalyzeValue }: { grid: SheetGridVm; analysisActive: boolean; onAnalyzeValue: (value: string) => void }) {
  const queryClient = useQueryClient();
  const [newCells, setNewCells] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const referenceFields = useMemo(() => grid.fields.filter((field) => field.type.includes("reference")), [grid.fields]);

  const { data: refs } = useQuery({
    queryKey: ["reference-targets", grid.sheet.id],
    enabled: referenceFields.length > 0,
    queryFn: async () => {
      const response = await fetch(`/api/sheets/${grid.sheet.id}/rows?references=1`);
      if (!response.ok) throw new Error("Could not load reference targets");
      return response.json() as Promise<{ targets: { rowId: string; visibleId: string; sheetName: string }[] }>;
    }
  });

  const mutation = useMutation({
    mutationFn: ({ row, field, value }: { row: GridRowVm; field: FieldVm; value: unknown }) => patchCell(row.id, field.id, value, row.version),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["sheet", grid.sheet.id] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Update failed")
  });

  const createMutation = useMutation({
    mutationFn: () => createRow(grid.sheet.id, newCells),
    onSuccess: () => {
      setNewCells({});
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["sheet", grid.sheet.id] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Row creation failed")
  });

  return (
    <>
      {error ? <p className="error">{error}</p> : null}
      <div className="grid-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              {grid.fields.map((field) => (
                <th key={field.id} title={field.description}>
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.id}>
                {grid.fields.map((field) => {
                  const value = row.cells[field.id] ?? row.cells[field.slug] ?? "";
                  const isReference = field.type === "single_reference" || field.type === "multi_reference";
                  if (isReference) {
                    const selected = Array.isArray(value) ? value.map((item) => item.id) : [];
                    return (
                      <td key={field.id}>
                        <select
                          className="select"
                          multiple={field.type === "multi_reference"}
                          value={selected}
                          onChange={(event) => {
                            const ids = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                            mutation.mutate({ row, field, value: field.type === "single_reference" ? ids[0] ?? null : ids });
                          }}
                        >
                          {refs?.targets.map((target) => (
                            <option key={target.rowId} value={target.rowId}>
                              {target.visibleId} - {target.sheetName}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={field.id}
                      contentEditable={field.editable}
                      suppressContentEditableWarning
                      onClick={() => {
                        if (analysisActive) onAnalyzeValue(displayValue(value));
                      }}
                      onBlur={(event) => {
                        if (!field.editable || field.type === "auto_id") return;
                        const next = event.currentTarget.textContent ?? "";
                        if (next !== displayValue(value)) mutation.mutate({ row, field, value: next });
                      }}
                    >
                      {displayValue(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="new-row">
              {grid.fields.map((field, index) => {
                if (field.type === "auto_id") {
                  return <td key={field.id}>New row</td>;
                }
                const isReference = field.type === "single_reference" || field.type === "multi_reference";
                if (isReference) {
                  return (
                    <td key={field.id}>
                      <select
                        className="select"
                        multiple={field.type === "multi_reference"}
                        value={(newCells[field.id] as string[]) ?? []}
                        onChange={(event) => {
                          const ids = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                          setNewCells((current) => ({ ...current, [field.id]: field.type === "single_reference" ? ids[0] ?? null : ids }));
                        }}
                      >
                        {refs?.targets.map((target) => (
                          <option key={target.rowId} value={target.rowId}>
                            {target.visibleId} - {target.sheetName}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                }
                return (
                  <td key={field.id}>
                    <input
                      className="input"
                      placeholder={index === 1 ? "Always-visible new row" : ""}
                      value={String(newCells[field.id] ?? "")}
                      onChange={(event) => setNewCells((current) => ({ ...current, [field.id]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") createMutation.mutate();
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10 }}>
        <button className="button primary" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          Add Row
        </button>
      </div>
    </>
  );
}
