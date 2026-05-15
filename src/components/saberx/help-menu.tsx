"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icon";

export function HelpMenu({
  firstDocumentId: _firstDocumentId,
  tutorialSeen
}: {
  firstDocumentId?: string;
  tutorialSeen: boolean;
}) {
  void _firstDocumentId;
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  // First-time landing: redirect to /tutorial only if the user has never
  // completed it. The flag lives on the user record (set by the tutorial
  // route on finish/skip) so it survives across browsers and sessions.
  useEffect(() => {
    if (pathname.startsWith("/tutorial")) return;
    if (!tutorialSeen) router.push("/tutorial");
  }, [router, pathname, tutorialSeen]);

  return (
    <>
      <button
        data-tour="topbar-help"
        className="sx-btn sx-btn-ghost sx-btn-sm"
        onClick={() => setOpen((v) => !v)}
        style={{ padding: 5, position: "relative" }}
        type="button"
        aria-label="Help"
        title="Help"
      >
        <Icon name="question" />
      </button>
      {open && (
        <HelpDropdown
          onClose={() => setOpen(false)}
          onShowInstructions={() => {
            setOpen(false);
            setInstructionsOpen(true);
          }}
          onShowTutorial={() => {
            setOpen(false);
            router.push("/tutorial");
          }}
        />
      )}
      {instructionsOpen && <InstructionsModal onClose={() => setInstructionsOpen(false)} />}
    </>
  );
}

/* ---------- Dropdown ---------- */

function HelpDropdown({
  onClose,
  onShowInstructions,
  onShowTutorial
}: {
  onClose: () => void;
  onShowInstructions: () => void;
  onShowTutorial: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "transparent", zIndex: 60 }}
      />
      <div
        style={{
          position: "fixed",
          right: 56,
          top: 52,
          width: 220,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "var(--sx-radius-lg)",
          boxShadow: "var(--sx-shadow-lg)",
          padding: 6,
          zIndex: 61,
          fontSize: 12.5
        }}
      >
        <DropdownItem icon="info" label="How-to / Instructions" onClick={onShowInstructions} />
        <DropdownItem icon="bolt" label="Show tutorial again" onClick={onShowTutorial} />
      </div>
    </>
  );
}

function DropdownItem({
  icon,
  label,
  onClick
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 10px",
        border: 0,
        borderRadius: 6,
        background: "transparent",
        color: "var(--ink)",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12.5
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-3)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Icon name={icon} size={12} style={{ color: "var(--ink-3)" }} />
      <span>{label}</span>
    </button>
  );
}

/* ---------- Instructions modal (how-to info cards) ---------- */

const HOWTO_CARDS: { icon: string; title: string; body: string }[] = [
  {
    icon: "docs",
    title: "Create a document",
    body: "Click + New document in the top bar. Give it a title and pick a template (CONOPS, ICD, RTM) or leave it blank."
  },
  {
    icon: "upload",
    title: "Import an Excel file",
    body: "Use the Import button to upload .xlsx / .xlsm. SaberX parses sheets, columns, and rows on the server."
  },
  {
    icon: "grid",
    title: "Add a sheet",
    body: "Inside a document, open the sheet tree on the left and click + New sheet. Each sheet has its own schema."
  },
  {
    icon: "schema",
    title: "Define fields (columns)",
    body: "Open the Schema editor from the sheet toolbar. Pick a type — text, number, enum, date, boolean, reference — and cells will be validated for you."
  },
  {
    icon: "rows",
    title: "Add rows & edit cells",
    body: "Click + New row, then double-click any cell to edit inline. Reference cells let you pick a target row from another sheet."
  },
  {
    icon: "link",
    title: "Create references",
    body: "Set a field's type to single_reference or multi_reference, point it at the target sheet, and SaberX preserves the link by row UUID."
  },
  {
    icon: "history",
    title: "Take a snapshot",
    body: "From the Snapshots page, take a snapshot to freeze a baseline. You can diff any two snapshots to see exactly what changed."
  },
  {
    icon: "audit",
    title: "Audit log",
    body: "Every mutation is written to an immutable audit log. Filter by user, document, or action from the sidebar."
  },
  {
    icon: "shield",
    title: "Integrity issues",
    body: "Broken references, type mismatches, or missing required values are listed under Integrity. Click an issue to jump to the offending cell."
  },
  {
    icon: "undo",
    title: "Undo a change",
    body: "Press ⌘Z (or use the undo button in the top bar) to revert your last action. Each user has their own undo stack."
  },
  {
    icon: "search",
    title: "Search everything",
    body: "Press ⌘K to open global search across documents, sheets, fields, and row content."
  },
  {
    icon: "settings",
    title: "Tweaks & theme",
    body: "Use the gear button to switch theme, accent color, density, and toggle the trace column."
  }
];

function InstructionsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How-to instructions"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,10,14,0.5)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
    >
      <div
        style={{
          width: "min(920px, 100%)",
          maxHeight: "90dvh",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "var(--sx-radius-lg)",
          boxShadow: "var(--sx-shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center"
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "var(--ink-4)",
                textTransform: "uppercase"
              }}
            >
              Help
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>How-to / Instructions</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sx-btn sx-btn-ghost sx-btn-sm"
            aria-label="Close"
            style={{ padding: 6 }}
          >
            <Icon name="x" size={12} />
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 18,
            background: "var(--bg-2)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12
          }}
        >
          {HOWTO_CARDS.map((c) => (
            <div
              key={c.title}
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "var(--sx-radius-md)",
                padding: 14,
                boxShadow: "var(--sx-shadow-sm)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon name={c.icon} size={14} style={{ color: "var(--sx-accent)" }} />
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.title}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>{c.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
