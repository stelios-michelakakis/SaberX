"use client";

import { BookOpen, FileLock2, FileText, HelpCircle, KeyRound } from "lucide-react";
import type { DocumentVm } from "./types";

function SheetIcon({ kind }: { kind: string }) {
  if (kind === "instructions") return <FileText size={15} />;
  if (kind === "glossary") return <BookOpen size={15} />;
  if (kind === "open_issues") return <HelpCircle size={15} />;
  return <KeyRound size={15} />;
}

export function DocumentTree({
  documents,
  activeSheetId,
  onSelect
}: {
  documents: DocumentVm[];
  activeSheetId: string | null;
  onSelect: (documentId: string, sheetId: string) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sheet-tree">
        {documents.map((document) => (
          <section className="document-node" key={document.id}>
            <div className="document-head">
              <div className="document-name">{document.title}</div>
              <div className="document-meta">
                {document.classification} · {document.status}
                {document.integrityIssueCount ? ` · ${document.integrityIssueCount} open issue(s)` : ""}
              </div>
            </div>
            <div className="sheet-list">
              {document.sheets.map((sheet) => (
                <button
                  className={`sheet-row ${sheet.isSystemReserved ? "reserved" : ""} ${sheet.id === activeSheetId ? "active" : ""}`}
                  key={sheet.id}
                  onClick={() => onSelect(document.id, sheet.id)}
                >
                  <SheetIcon kind={sheet.sheetKind} />
                  <span>{sheet.name}</span>
                  {sheet.isSystemReserved ? <FileLock2 size={13} aria-label="reserved" /> : null}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
