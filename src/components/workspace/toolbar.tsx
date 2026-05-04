"use client";

import { Download, History, Import, LayoutDashboard, LogOut, Plus, Search, ShieldCheck } from "lucide-react";

export function WorkspaceToolbar({
  mode,
  onModeChange,
  onNewDocument,
  onImport,
  onExport,
  onAnalysis,
  onLogout
}: {
  mode: "inspect" | "edit";
  onModeChange: (mode: "inspect" | "edit") => void;
  onNewDocument: () => void;
  onImport: () => void;
  onExport: () => void;
  onAnalysis: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <div className="brand-mark">SX</div>
        <div>
          <div className="workspace-title">Engineering Workbook Repository</div>
        </div>
      </div>
      <div className="toolbar-group">
        <button className={`button ${mode === "inspect" ? "primary" : ""}`} onClick={() => onModeChange("inspect")}>
          <LayoutDashboard size={16} /> Inspect
        </button>
        <button className={`button ${mode === "edit" ? "primary" : ""}`} onClick={() => onModeChange("edit")}>
          <ShieldCheck size={16} /> Create/Edit
        </button>
        <button className="button icon" onClick={onNewDocument} title="New document" aria-label="New document">
          <Plus size={17} />
        </button>
        <button className="button icon" onClick={onImport} title="Import Excel" aria-label="Import Excel">
          <Import size={17} />
        </button>
        <button className="button icon" onClick={onExport} title="Export Excel" aria-label="Export Excel">
          <Download size={17} />
        </button>
        <a className="button icon" href="/audit" title="Audit history" aria-label="Audit history">
          <History size={17} />
        </a>
        <button className="button icon" onClick={onAnalysis} title="Analysis" aria-label="Analysis">
          <Search size={17} />
        </button>
        <button className="button icon danger" onClick={onLogout} title="Logout" aria-label="Logout">
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
