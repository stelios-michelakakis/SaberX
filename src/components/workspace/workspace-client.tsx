"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalysisOverlay } from "./analysis-overlay";
import { DocumentTree } from "./document-tree";
import { SheetSurface } from "./sheet-surface";
import { useWorkspaceStore } from "./store";
import { WorkspaceToolbar } from "./toolbar";
import type { DocumentVm } from "./types";

export function WorkspaceClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { activeDocumentId, activeSheetId, setActive, mode, setMode, analysisOpen, toggleAnalysis } = useWorkspaceStore();
  const [analysisQuery, setAnalysisQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: async () => {
      const response = await fetch("/api/documents?workspace=1");
      if (response.status === 401) {
        router.push("/");
        return { documents: [] };
      }
      if (!response.ok) throw new Error((await response.json()).error ?? "Workspace load failed");
      return response.json() as Promise<{ documents: DocumentVm[] }>;
    }
  });

  const documents = data?.documents ?? [];
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0] ?? null;
  const activeSheet = activeDocument?.sheets.find((sheet) => sheet.id === activeSheetId) ?? activeDocument?.sheets[0] ?? null;

  useEffect(() => {
    if (!activeDocumentId && activeDocument && activeSheet) setActive(activeDocument.id, activeSheet.id);
  }, [activeDocument, activeDocumentId, activeSheet, setActive]);

  const createDocument = useMutation({
    mutationFn: async () => {
      const title = window.prompt("Document title");
      if (!title) return null;
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description: "", classification: "unclassified" })
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not create document");
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace"] }),
    onError: (err) => setError(err instanceof Error ? err.message : "Could not create document")
  });

  const importFile = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/import-jobs", { method: "POST", body: form });
      if (!response.ok) throw new Error((await response.json()).error ?? "Import failed");
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace"] }),
    onError: (err) => setError(err instanceof Error ? err.message : "Import failed")
  });

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const exportActive = () => {
    if (!activeDocument) return;
    window.location.href = `/api/documents/${activeDocument.id}/export-jobs`;
  };

  return (
    <div className="workspace">
      <WorkspaceToolbar
        mode={mode}
        onModeChange={setMode}
        onNewDocument={() => createDocument.mutate()}
        onImport={() => fileRef.current?.click()}
        onExport={exportActive}
        onAnalysis={toggleAnalysis}
        onLogout={logout}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importFile.mutate(file);
          event.currentTarget.value = "";
        }}
      />
      <DocumentTree documents={documents} activeSheetId={activeSheet?.id ?? null} onSelect={setActive} />
      <SheetSurface
        activeDocumentId={activeDocument?.id ?? null}
        activeSheet={activeSheet}
        mode={mode}
        analysisActive={analysisOpen}
        onAnalyzeValue={(value) => {
          setAnalysisQuery(value);
          if (!analysisOpen) toggleAnalysis();
        }}
      />
      <AnalysisOverlay open={analysisOpen} initialQuery={analysisQuery} onClose={toggleAnalysis} />
      <div className="statusbar">
        <span>{isLoading ? "Loading repository" : `${documents.length} document(s)`}</span>
        <span>{error ?? "Traceability on · UUID links · Audit trail active"}</span>
      </div>
    </div>
  );
}
