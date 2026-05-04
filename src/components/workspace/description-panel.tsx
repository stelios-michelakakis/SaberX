"use client";

import type { FieldVm, SheetVm } from "./types";

export function SheetDescriptionPanel({ sheet, fields }: { sheet: SheetVm; fields: FieldVm[] }) {
  if (sheet.sheetKind !== "standard") return null;
  return (
    <details className="description-panel" open>
      <summary>Description and Field Legend</summary>
      <div className="description-body">
        <div>
          <label className="field-label">
            Description
            <textarea className="textarea" value={sheet.description ?? ""} readOnly />
          </label>
        </div>
        <div className="legend">
          {fields.map((field) => (
            <div className="legend-row" key={field.id}>
              <strong>{field.label}</strong>
              <span>{field.description || field.type}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
