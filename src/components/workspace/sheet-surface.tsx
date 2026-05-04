"use client";

import { useQuery } from "@tanstack/react-query";
import { SheetDescriptionPanel } from "./description-panel";
import { DataGrid } from "./data-grid";
import { SchemaEditor } from "./schema-editor";
import type { SheetGridVm, SheetVm } from "./types";

export function SheetSurface({
  activeDocumentId,
  activeSheet,
  mode,
  analysisActive,
  onAnalyzeValue
}: {
  activeDocumentId: string | null;
  activeSheet: SheetVm | null;
  mode: "inspect" | "edit";
  analysisActive: boolean;
  onAnalyzeValue: (value: string) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["sheet", activeSheet?.id],
    enabled: Boolean(activeSheet?.id),
    queryFn: async () => {
      const response = await fetch(`/api/sheets/${activeSheet?.id}`);
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not load sheet");
      return response.json() as Promise<SheetGridVm>;
    }
  });

  if (!activeSheet) {
    return (
      <main className="main-pane">
        <div className="sheet-header">
          <div>
            <h1>No document selected</h1>
            <p>Create or import a document to begin.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="main-pane">
      <div className="sheet-header">
        <div>
          <h1>{activeSheet.name}</h1>
          <p>
            {activeSheet.isSystemReserved ? "System reserved" : "User-created"} · {activeSheet.sheetKind}
          </p>
        </div>
      </div>
      <div className="content-scroll">
        {mode === "edit" ? <SchemaEditor documentId={activeDocumentId} sheet={activeSheet} /> : null}
        {isLoading ? <p>Loading sheet...</p> : null}
        {error ? <p className="error">{error instanceof Error ? error.message : "Sheet failed to load"}</p> : null}
        {data ? (
          <>
            {data.sheet.sheetKind === "instructions" ? (
              <InstructionEditor sheet={data.sheet} />
            ) : (
              <>
                <SheetDescriptionPanel sheet={data.sheet} fields={data.fields} />
                <DataGrid grid={data} analysisActive={analysisActive} onAnalyzeValue={onAnalyzeValue} />
              </>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

function InstructionEditor({ sheet }: { sheet: SheetVm }) {
  return (
    <div className="panel">
      <label className="field-label">
        Instructions
        <textarea className="textarea" value={sheet.description ?? ""} readOnly />
      </label>
    </div>
  );
}
