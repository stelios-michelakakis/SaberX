"use client";

import { create } from "zustand";

type Mode = "inspect" | "edit";

type WorkspaceState = {
  activeDocumentId: string | null;
  activeSheetId: string | null;
  mode: Mode;
  analysisOpen: boolean;
  setActive: (documentId: string, sheetId: string) => void;
  setMode: (mode: Mode) => void;
  toggleAnalysis: () => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeDocumentId: null,
  activeSheetId: null,
  mode: "inspect",
  analysisOpen: false,
  setActive: (documentId, sheetId) => set({ activeDocumentId: documentId, activeSheetId: sheetId }),
  setMode: (mode) => set({ mode }),
  toggleAnalysis: () => set((state) => ({ analysisOpen: !state.analysisOpen }))
}));
