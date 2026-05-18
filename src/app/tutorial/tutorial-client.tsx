"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode
} from "react";
import { Icon } from "@/components/saberx/icon";
import { PageHeader } from "@/components/saberx/page-header";
import { Avatar } from "@/components/saberx/avatar";
import { ThemeProvider, accentVars, useTweaks } from "@/components/saberx/theme-provider";
import { finishTutorial } from "./actions";

/* ============================================================
   Mock data — entirely client-side; nothing touches the DB.
   ============================================================ */

type View = "documents" | "document" | "audit" | "profile";

const MOCK_DOCS = [
  {
    id: "tut-d1",
    code: "CONOPS",
    title: "Concept of Operations — Falcon Program",
    type: "CONOPS",
    status: "baselined",
    baseline: "baselined",
    sheets: 4,
    issues: 0,
    updated: "2 days ago"
  },
  {
    id: "tut-d2",
    code: "ICD-001",
    title: "Interface Control Document — Comms Bus",
    type: "ICD",
    status: "under_review",
    baseline: "draft",
    sheets: 3,
    issues: 2,
    updated: "5 hr ago"
  },
  {
    id: "tut-d3",
    code: "RTM-12",
    title: "Requirements Traceability Matrix",
    type: "RTM",
    status: "draft",
    baseline: "draft",
    sheets: 6,
    issues: 0,
    updated: "1 week ago"
  },
  {
    id: "tut-d4",
    code: "DOC-09",
    title: "Verification & Validation Plan",
    type: "DOC",
    status: "draft",
    baseline: "draft",
    sheets: 2,
    issues: 1,
    updated: "3 days ago"
  }
];

const MOCK_SHEETS = [
  { id: "s1", name: "Requirements" },
  { id: "s2", name: "Interfaces" },
  { id: "s3", name: "Verification" },
  { id: "s4", name: "Open Issues" }
];

const MOCK_FIELDS: { name: string; type: string }[] = [
  { name: "ID", type: "auto_id" },
  { name: "Title", type: "short_text" },
  { name: "Priority", type: "single_enum" },
  { name: "Owner", type: "single_reference" },
  { name: "Due", type: "date" },
  { name: "Verified", type: "boolean" }
];

const MOCK_ROWS: (string | boolean)[][] = [
  ["REQ-001", "System shall boot in < 5s", "High", "S. Michelakakis", "2026-06-01", true],
  ["REQ-002", "Comms bus must support CAN-FD", "High", "A. Patel", "2026-06-15", false],
  ["REQ-003", "Telemetry sample rate ≥ 200Hz", "Medium", "J. Rivera", "2026-07-01", false],
  ["REQ-004", "Encrypted storage for logs", "Critical", "M. Sato", "2026-05-20", true],
  ["REQ-005", "Recovery from cold boot < 30s", "Medium", "S. Michelakakis", "2026-08-10", false]
];

const MOCK_AUDIT: { who: string; what: string; entity: string; when: string }[] = [
  { who: "smichelakakis", what: "Edited REQ-002.priority", entity: "Requirements", when: "2 min ago" },
  { who: "apatel", what: "Created sheet", entity: "Interfaces", when: "1 hr ago" },
  { who: "msato", what: "Added 3 rows", entity: "Verification", when: "3 hr ago" },
  { who: "smichelakakis", what: "Snapshot taken", entity: "v1.2 — baseline", when: "Yesterday" },
  { who: "jrivera", what: "Updated field type", entity: "Priority", when: "2 days ago" }
];

const TYPE_PILL: Record<string, string> = {
  CONOPS: "pill pill-violet",
  ICD: "pill pill-accent",
  RTM: "pill pill-green",
  DOC: "pill"
};
const STATUS_PILL: Record<string, string> = {
  draft: "pill",
  baselined: "pill pill-green",
  under_review: "pill pill-amber"
};

/* ============================================================
   Tutorial steps — each declares which mock view to show,
   which data-tour selector to spotlight, and the tooltip body.
   ============================================================ */

type Placement = "top" | "bottom" | "left" | "right" | "auto";
type Step = {
  title: string;
  body: ReactNode;
  view: View;
  selector?: string;
  placement?: Placement;
};

const STEPS: Step[] = [
  {
    title: "Welcome to EDF SABER",
    body: (
      <>
        This is a <strong>sandbox</strong> — every document, sheet and row you see here is fake.
        Click through with <strong>Next / Back / Skip</strong> (or the arrow keys) to learn the
        layout, then we'll drop you back into the real workspace.
      </>
    ),
    view: "documents"
  },
  // --- Top toolbar ---
  {
    title: "Global search",
    body: (
      <>
        Press <span className="kbd">⌘</span> <span className="kbd">K</span> anywhere to search
        across documents, sheets, fields and row content.
      </>
    ),
    view: "documents",
    selector: "[data-tour='topbar-search']",
    placement: "bottom"
  },
  {
    title: "Undo",
    body: (
      <>
        Reverts your last action — cell edits, row/sheet creation, schema changes. Press{" "}
        <span className="kbd">⌘Z</span> outside an input.
      </>
    ),
    view: "documents",
    selector: "[data-tour='topbar-undo']",
    placement: "bottom"
  },
  {
    title: "Help",
    body: (
      <>
        Opens <em>How-to</em> info cards and <em>Show tutorial again</em>. Replay this tour any
        time from there.
      </>
    ),
    view: "documents",
    selector: "[data-tour='topbar-help']",
    placement: "bottom"
  },
  {
    title: "Import from Excel",
    body: (
      <>
        Upload an .xlsx / .xlsm workbook. SaberX parses sheets, columns and rows on the server
        and brings them in with the schema preserved.
      </>
    ),
    view: "documents",
    selector: "[data-tour='topbar-import']",
    placement: "bottom"
  },
  // --- Sidebar ---
  {
    title: "Sidebar",
    body: (
      <>
        Your main navigation. <strong>Workspace</strong> lists your documents; <strong>Tools</strong>{" "}
        gives you Search, Audit log, Integrity, Snapshots, Admin and Profile.
      </>
    ),
    view: "documents",
    selector: "[data-tour='sidebar']",
    placement: "right"
  },
  {
    title: "Documents",
    body: (
      <>
        Every workbook (CONOPS, ICD, RTM…) lives under <strong>Documents</strong>. The{" "}
        <Icon name="plus" size={12} style={{ verticalAlign: "-1px" }} /> next to it creates one
        inline.
      </>
    ),
    view: "documents",
    selector: "[data-tour='nav-documents']",
    placement: "right"
  },
  {
    title: "Sources",
    body: (
      <>
        Upload PDF, DOCX, Markdown or plain-text files (up to 50 MB each) and reference them
        from any cell. The <Icon name="plus" size={12} style={{ verticalAlign: "-1px" }} /> opens
        the upload picker; the list view lets you preview, download or remove existing sources.
        To use a source from a cell, configure a reference field with{" "}
        <strong>Include sources</strong> in the schema tab — the picker then lists files
        alongside row targets.
      </>
    ),
    view: "documents",
    selector: "[data-tour='nav-sources']",
    placement: "right"
  },
  // --- Documents page ---
  {
    title: "Your documents",
    body: (
      <>
        Every workbook listed here — code, title, type, status, baseline, sheet count, issues and
        last update. Click any row to open it.
      </>
    ),
    view: "documents",
    selector: "[data-tour='documents-table']",
    placement: "top"
  },
  // --- Inside a document ---
  {
    title: "Sheets",
    body: (
      <>
        A document is made of <strong>sheets</strong> — each one a typed table. Switch between
        them with these tabs, or click <strong>+ New sheet</strong> to add another.
      </>
    ),
    view: "document",
    selector: "[data-tour='doc-sheets-tabs']",
    placement: "bottom"
  },
  {
    title: "Columns (fields)",
    body: (
      <>
        Columns are typed <strong>fields</strong>: short / long text, integer, decimal, boolean,
        date, enum, reference, status, tag list. Click <strong>+ Add column</strong> in the
        header to extend the schema.
      </>
    ),
    view: "document",
    selector: "[data-tour='doc-add-column']",
    placement: "left"
  },
  {
    title: "Rows & cells",
    body: (
      <>
        Click <strong>+ Add row</strong> to create a record. Double-click any cell to edit it
        inline; reference cells link to a row in another sheet.
      </>
    ),
    view: "document",
    selector: "[data-tour='doc-add-row']",
    placement: "top"
  },
  // --- Audit ---
  {
    title: "Audit log",
    body: (
      <>
        Every mutation — every cell edit, field change, sheet/row create — is written to an
        immutable audit log. Filter by user, document or action.
      </>
    ),
    view: "audit",
    selector: "[data-tour='page-header']",
    placement: "bottom"
  },
  // --- Finish ---
  {
    title: "Set up your account",
    body: (
      <>
        That's the tour. Last step — set your name, organization and password on the{" "}
        <strong>Profile</strong> page. Finish below to go there now.
      </>
    ),
    view: "profile"
  }
];

/* ============================================================
   Entry point — wraps everything in ThemeProvider so the mock
   sidebar/topbar pick up the same tokens as the real app.
   ============================================================ */

export function TutorialClient({ userName, userRole }: { userName: string; userRole: string }) {
  return (
    <ThemeProvider>
      <TutorialInner userName={userName} userRole={userRole} />
    </ThemeProvider>
  );
}

function TutorialInner({ userName, userRole }: { userName: string; userRole: string }) {
  const { tweaks } = useTweaks();
  const dark = tweaks.theme === "dark";
  const accent = accentVars(tweaks.accent, dark);

  const [stepIdx, setStepIdx] = useState(0);
  const [exiting, startTransition] = useTransition();
  const step = STEPS[stepIdx];
  const last = STEPS.length - 1;

  const exit = useCallback((skip: boolean) => {
    // Server action flips the flag, invalidates the dashboard layout cache,
    // and redirects in one round-trip. No client fetch, no router.push.
    startTransition(() => {
      void finishTutorial(skip);
    });
  }, []);
  void exiting;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.body.style.background;
    document.body.style.background = dark ? "#0e0e0d" : "#fbfbfa";
    return () => {
      document.body.style.background = previous;
    };
  }, [dark]);

  return (
    <div
      className="sx-shell"
      data-theme={tweaks.theme}
      data-density={tweaks.density}
      style={{
        ...accent,
        display: "flex",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--bg)"
      }}
    >
      <MockSidebar userName={userName} userRole={userRole} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden"
        }}
      >
        <MockTopbar view={step.view} />
        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            minHeight: 0
          }}
        >
          {step.view === "documents" && <DocumentsView />}
          {step.view === "document" && <DocumentView />}
          {step.view === "audit" && <AuditView />}
          {step.view === "profile" && <ProfileView userName={userName} />}
        </div>
      </div>

      <TutorialOverlay
        stepIdx={stepIdx}
        setStepIdx={setStepIdx}
        last={last}
        step={step}
        onExit={exit}
      />
    </div>
  );
}

/* ============================================================
   Mock Sidebar — visually identical to the real one, but inert.
   ============================================================ */

function MockSidebar({ userName, userRole }: { userName: string; userRole: string }) {
  const { tweaks } = useTweaks();
  const collapsed = tweaks.sidebarCollapsed;
  const W = collapsed ? 56 : 240;

  return (
    <aside
      data-tour="sidebar"
      style={{
        width: W,
        flex: "none",
        borderRight: "1px solid var(--line)",
        background: "var(--panel-2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          height: 48,
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--line)"
        }}
      >
        {!collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "var(--ink)" }}>
              EDF SABER
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: "var(--ink-3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em"
              }}
            >
              Engineering Docs
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink-2)",
              fontFamily: "var(--font-mono)"
            }}
          >
            EDF
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: 8, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {!collapsed && <SectionLabel label="Workspace" />}
        <DocumentsRow collapsed={collapsed} />
        {!collapsed &&
          MOCK_DOCS.map((d) => (
            <div
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "5px 8px 5px 22px",
                borderRadius: 6,
                color: "var(--ink-2)",
                fontSize: 12.5
              }}
            >
              <Icon name="doc" size={12} style={{ color: "var(--ink-4)", flex: "none" }} />
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {d.title}
              </span>
            </div>
          ))}
        {!collapsed && <SectionLabel label="Tools" pad />}
        {[
          { icon: "search", label: "Search" },
          { icon: "audit", label: "Audit log" },
          { icon: "shield", label: "Integrity" },
          { icon: "history", label: "Snapshots" },
          { icon: "users", label: "Admin" },
          { icon: "user", label: "Profile" }
        ].map((it) => (
          <div
            key={it.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: collapsed ? "7px 8px" : "6px 8px",
              borderRadius: 6,
              color: "var(--ink-2)",
              fontSize: 12.5,
              justifyContent: collapsed ? "center" : "flex-start"
            }}
          >
            <Icon name={it.icon} size={12} style={{ color: "var(--ink-3)", flex: "none" }} />
            {!collapsed && <span style={{ flex: 1 }}>{it.label}</span>}
          </div>
        ))}
      </nav>

      <div
        style={{
          borderTop: "1px solid var(--line)",
          padding: 10,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}
      >
        <Avatar name={userName} size={26} />
        {!collapsed && (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {userName}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{userRole}</div>
          </div>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({ label, pad }: { label: string; pad?: boolean }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: "var(--ink-4)",
        textTransform: "uppercase",
        padding: pad ? "16px 8px 4px" : "8px 8px 4px"
      }}
    >
      {label}
    </div>
  );
}

function DocumentsRow({ collapsed }: { collapsed: boolean }) {
  return (
    <div data-tour="nav-documents" style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: collapsed ? "7px 8px" : "6px 8px",
          borderRadius: 6,
          background: "var(--accent-soft)",
          color: "var(--ink)",
          fontSize: 12.5,
          fontWeight: 500,
          justifyContent: collapsed ? "center" : "flex-start"
        }}
      >
        <Icon name="docs" size={12} style={{ color: "var(--ink)", flex: "none" }} />
        {!collapsed && <span style={{ flex: 1 }}>Documents</span>}
      </div>
      {!collapsed && (
        <div className="sx-btn sx-btn-ghost sx-btn-sm" style={{ padding: 4, cursor: "default" }} aria-hidden>
          <Icon name="plus" size={12} />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Mock Topbar — same buttons as the real one (search, undo,
   help, import, new document), but inert. Theme + tweaks
   buttons omitted to match the simplified flow.
   ============================================================ */

function MockTopbar({ view }: { view: View }) {
  const breadcrumbs = useMemo(() => {
    switch (view) {
      case "documents":
        return ["Documents"];
      case "document":
        return ["Documents", MOCK_DOCS[0].title];
      case "audit":
        return ["Audit log"];
      case "profile":
        return ["Profile"];
    }
  }, [view]);

  return (
    <div
      style={{
        height: 48,
        flex: "none",
        borderBottom: "1px solid var(--line)",
        background: "var(--panel)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 14px"
      }}
    >
      <div className="sx-btn sx-btn-ghost sx-btn-sm" style={{ padding: 5, cursor: "default" }} aria-hidden>
        <Icon name="panelL" />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          color: "var(--ink-3)",
          flex: 1,
          minWidth: 0,
          overflow: "hidden"
        }}
      >
        {breadcrumbs.map((c, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <Icon name="chevronR" size={12} style={{ color: "var(--ink-4)" }} />}
            <span
              style={{
                color: i === breadcrumbs.length - 1 ? "var(--ink)" : "var(--ink-3)",
                fontWeight: i === breadcrumbs.length - 1 ? 500 : 400,
                whiteSpace: "nowrap"
              }}
            >
              {c}
            </span>
          </span>
        ))}
      </div>

      <div
        data-tour="topbar-search"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: "0 1 320px",
          minWidth: 200,
          maxWidth: 360,
          height: 30,
          padding: "0 8px 0 10px",
          borderRadius: 7,
          border: "1px solid var(--line)",
          background: "var(--bg-2)",
          color: "var(--ink-3)",
          fontSize: 12.5
        }}
      >
        <Icon name="search" size={12} style={{ flex: "none" }} />
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          Search documents, fields, rows…
        </span>
        <span style={{ display: "flex", gap: 3 }}>
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </span>
      </div>

      <div style={{ width: 1, height: 18, background: "var(--line)", margin: "0 2px" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div
          data-tour="topbar-undo"
          className="sx-btn sx-btn-ghost sx-btn-sm"
          style={{ padding: 5, cursor: "default" }}
          aria-hidden
        >
          <Icon name="undo" />
        </div>
        <div
          data-tour="topbar-help"
          className="sx-btn sx-btn-ghost sx-btn-sm"
          style={{ padding: 5, cursor: "default" }}
          aria-hidden
        >
          <Icon name="question" />
        </div>
        <div style={{ width: 1, height: 18, background: "var(--line)", margin: "0 4px" }} />
        <div
          data-tour="topbar-import"
          className="sx-btn sx-btn-sm"
          style={{ cursor: "default" }}
          aria-hidden
        >
          <Icon name="upload" size={12} />
          Import
        </div>
        <div
          data-tour="topbar-new-doc"
          className="sx-btn sx-btn-primary sx-btn-sm"
          style={{ cursor: "default" }}
          aria-hidden
        >
          <Icon name="plus" size={12} />
          New document
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Mock views
   ============================================================ */

function DocumentsView() {
  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Documents"
        subtitle="Engineering workbooks across the program — CONOPS, ICDs, RTMs, and supporting artefacts."
        meta={
          <>
            <span>
              <strong style={{ color: "var(--ink)" }}>{MOCK_DOCS.length}</strong> documents
            </span>
            <span>
              <strong style={{ color: "var(--ink)" }}>1</strong> baselined
            </span>
            <span>
              <strong style={{ color: "var(--ink)" }}>1</strong> under review
            </span>
            <span>
              <strong style={{ color: "var(--ink)" }}>3</strong> open integrity issues
            </span>
          </>
        }
      />
      <div style={{ padding: "20px 28px" }}>
        <div
          data-tour="documents-table"
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--sx-radius-lg)",
            background: "var(--panel)",
            overflow: "hidden",
            boxShadow: "var(--sx-shadow-sm)"
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--panel-2)" }}>
                <Th>Code</Th>
                <Th>Title</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Baseline</Th>
                <Th>Sheets</Th>
                <Th>Issues</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {MOCK_DOCS.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <Td>
                    <span className="mono" style={{ color: "var(--accent-ink)", fontSize: 12 }}>
                      {d.code}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ color: "var(--ink)", fontWeight: 500 }}>{d.title}</span>
                  </Td>
                  <Td>
                    <span className={TYPE_PILL[d.type] ?? "pill"}>{d.type}</span>
                  </Td>
                  <Td>
                    <span className={STATUS_PILL[d.status] ?? "pill"}>
                      {d.status.replace(/_/g, " ")}
                    </span>
                  </Td>
                  <Td muted>
                    <span className="mono" style={{ fontSize: 11.5 }}>
                      {d.baseline}
                    </span>
                  </Td>
                  <Td muted>{d.sheets}</Td>
                  <Td>
                    {d.issues > 0 ? (
                      <span className="pill pill-red">{d.issues}</span>
                    ) : (
                      <span style={{ color: "var(--ink-4)" }}>—</span>
                    )}
                  </Td>
                  <Td muted>{d.updated}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function DocumentView() {
  const doc = MOCK_DOCS[0];
  const activeSheetId = MOCK_SHEETS[0].id;
  return (
    <>
      <PageHeader
        eyebrow={doc.type}
        title={doc.title}
        subtitle="Sandbox copy — explore freely; no edits are saved."
        meta={
          <>
            <span className={STATUS_PILL[doc.status] ?? "pill"}>
              {doc.status.replace(/_/g, " ")}
            </span>
            <span className="pill mono">{doc.baseline}</span>
            <span className="pill">v1</span>
          </>
        }
      />
      <div
        data-tour="doc-sheets-tabs"
        style={{
          display: "flex",
          gap: 2,
          padding: "0 28px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)"
        }}
      >
        {MOCK_SHEETS.map((s) => (
          <div
            key={s.id}
            style={{
              padding: "10px 14px",
              fontSize: 12.5,
              color: s.id === activeSheetId ? "var(--ink)" : "var(--ink-3)",
              borderBottom: s.id === activeSheetId ? "2px solid var(--ink)" : "2px solid transparent",
              fontWeight: s.id === activeSheetId ? 500 : 400,
              cursor: "default",
              whiteSpace: "nowrap"
            }}
          >
            {s.name}
          </div>
        ))}
        <div
          style={{
            padding: "10px 12px",
            fontSize: 12.5,
            color: "var(--ink-3)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "default"
          }}
        >
          <Icon name="plus" size={12} /> New sheet
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 28px" }}>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--sx-radius-lg)",
            background: "var(--panel)",
            overflow: "auto",
            boxShadow: "var(--sx-shadow-sm)"
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--panel-2)" }}>
                {MOCK_FIELDS.map((f) => (
                  <Th key={f.name}>{f.name}</Th>
                ))}
                <th
                  style={{
                    padding: 0,
                    borderBottom: "1px solid var(--line)",
                    background: "var(--panel-2)",
                    width: 130
                  }}
                >
                  <div
                    data-tour="doc-add-column"
                    className="sx-btn sx-btn-ghost sx-btn-sm"
                    style={{
                      width: "100%",
                      padding: "4px 8px",
                      justifyContent: "flex-start",
                      color: "var(--ink-3)",
                      fontSize: 11,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      cursor: "default"
                    }}
                    aria-hidden
                  >
                    <Icon name="plus" size={12} /> Add column
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ROWS.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                  <Td>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--accent-ink)" }}>
                      {r[0]}
                    </span>
                  </Td>
                  <Td>{r[1]}</Td>
                  <Td>
                    <span
                      className={`pill ${
                        r[2] === "Critical" ? "pill-red" : r[2] === "High" ? "pill-amber" : ""
                      }`}
                    >
                      {r[2]}
                    </span>
                  </Td>
                  <Td muted>{r[3]}</Td>
                  <Td muted>
                    <span className="mono" style={{ fontSize: 11.5 }}>
                      {r[4]}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ color: r[5] ? "var(--green)" : "var(--ink-4)" }}>
                      {r[5] ? "✓" : "—"}
                    </span>
                  </Td>
                  <td />
                </tr>
              ))}
              <tr
                data-tour="doc-add-row"
                style={{
                  borderTop: "1px dashed var(--line-strong)",
                  background: "var(--panel-2)",
                  cursor: "default"
                }}
              >
                <td
                  colSpan={MOCK_FIELDS.length + 1}
                  style={{ padding: "10px 12px", color: "var(--ink-3)", fontSize: 12.5, fontWeight: 500 }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Icon name="plus" size={12} /> Add row
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function AuditView() {
  return (
    <>
      <PageHeader
        eyebrow="Tools"
        title="Audit log"
        subtitle="Every mutation across the workspace, in order. Immutable."
      />
      <div style={{ padding: "20px 28px" }}>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--sx-radius-lg)",
            background: "var(--panel)",
            overflow: "hidden",
            boxShadow: "var(--sx-shadow-sm)"
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--panel-2)" }}>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
              </tr>
            </thead>
            <tbody>
              {MOCK_AUDIT.map((e, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                  <Td muted>{e.when}</Td>
                  <Td>
                    <span className="mono" style={{ fontSize: 11.5 }}>
                      {e.who}
                    </span>
                  </Td>
                  <Td>{e.what}</Td>
                  <Td muted>{e.entity}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ProfileView({ userName }: { userName: string }) {
  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title="Set up your account"
        subtitle="In the real app, this is where you'll set your name, organization and password."
      />
      <div style={{ padding: "20px 28px" }}>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--sx-radius-lg)",
            background: "var(--panel)",
            padding: 20,
            boxShadow: "var(--sx-shadow-sm)",
            display: "grid",
            gap: 12,
            maxWidth: 540
          }}
        >
          <ProfileField label="Display name" value={userName} />
          <ProfileField label="Organization" value="—" />
          <ProfileField label="Password" value="••••••••" />
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 4 }}>
            Click <strong>Finish</strong> below to go to the real Profile page and update these for
            real.
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "var(--ink-4)",
          textTransform: "uppercase"
        }}
      >
        {label}
      </span>
      <div
        style={{
          padding: "8px 10px",
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          fontSize: 12.5,
          color: "var(--ink)"
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 14px",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--ink-3)",
        borderBottom: "1px solid var(--line)"
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <td
      style={{
        padding: "10px 14px",
        fontSize: 12.5,
        color: muted ? "var(--ink-3)" : "var(--ink-2)",
        verticalAlign: "middle"
      }}
    >
      {children}
    </td>
  );
}

/* ============================================================
   Overlay — spotlight cutout + positioned tooltip with controls.
   Same approach as before; lives here now so the tutorial route
   owns its own flow.
   ============================================================ */

type Rect = { x: number; y: number; width: number; height: number };

function findElement(selector: string, timeoutMs = 3000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        resolve(el);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function TutorialOverlay({
  stepIdx,
  setStepIdx,
  last,
  step,
  onExit
}: {
  stepIdx: number;
  setStepIdx: (n: number | ((s: number) => number)) => void;
  last: number;
  step: Step;
  onExit: (skip: boolean) => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [tipSize, setTipSize] = useState<{ w: number; h: number }>({ w: 380, h: 200 });
  const [resolving, setResolving] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    const myToken = ++tokenRef.current;
    let cancelled = false;
    setResolving(true);

    const run = async () => {
      if (!step.selector) {
        if (!cancelled && myToken === tokenRef.current) {
          setRect(null);
          setResolving(false);
        }
        return;
      }
      const el = await findElement(step.selector);
      if (cancelled || myToken !== tokenRef.current) return;
      if (!el) {
        setRect(null);
        setResolving(false);
        return;
      }
      try {
        el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      } catch {
        /* ignore */
      }
      const measure = () => {
        const r = el.getBoundingClientRect();
        setRect({ x: r.left, y: r.top, width: r.width, height: r.height });
      };
      measure();
      setResolving(false);
      const onScrollOrResize = () => measure();
      window.addEventListener("scroll", onScrollOrResize, true);
      window.addEventListener("resize", onScrollOrResize);
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => {
        window.removeEventListener("scroll", onScrollOrResize, true);
        window.removeEventListener("resize", onScrollOrResize);
        ro.disconnect();
      };
    };

    let cleanup: (() => void) | undefined;
    run().then((c) => {
      if (cancelled || myToken !== tokenRef.current) {
        c?.();
      } else {
        cleanup = c;
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [stepIdx, step.selector]);

  useLayoutEffect(() => {
    if (!tooltipRef.current) return;
    const r = tooltipRef.current.getBoundingClientRect();
    if (Math.abs(r.width - tipSize.w) > 2 || Math.abs(r.height - tipSize.h) > 2) {
      setTipSize({ w: r.width, h: r.height });
    }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit(true);
      if (e.key === "ArrowRight" && stepIdx < last) setStepIdx((s) => Math.min(last, s + 1));
      if (e.key === "ArrowLeft" && stepIdx > 0) setStepIdx((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepIdx, last, onExit, setStepIdx]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const pad = 8;

  let tipTop = vh / 2 - tipSize.h / 2;
  let tipLeft = vw / 2 - tipSize.w / 2;
  if (rect) {
    let placement: Placement = step.placement ?? "auto";
    if (placement === "auto") {
      if (rect.y + rect.height + 16 + tipSize.h < vh) placement = "bottom";
      else if (rect.y - 16 - tipSize.h > 0) placement = "top";
      else if (rect.x + rect.width + 16 + tipSize.w < vw) placement = "right";
      else placement = "left";
    }
    const gap = 14;
    switch (placement) {
      case "bottom":
        tipTop = rect.y + rect.height + gap;
        tipLeft = rect.x + rect.width / 2 - tipSize.w / 2;
        break;
      case "top":
        tipTop = rect.y - gap - tipSize.h;
        tipLeft = rect.x + rect.width / 2 - tipSize.w / 2;
        break;
      case "right":
        tipLeft = rect.x + rect.width + gap;
        tipTop = rect.y + rect.height / 2 - tipSize.h / 2;
        break;
      case "left":
        tipLeft = rect.x - gap - tipSize.w;
        tipTop = rect.y + rect.height / 2 - tipSize.h / 2;
        break;
    }
    tipLeft = Math.max(12, Math.min(vw - tipSize.w - 12, tipLeft));
    tipTop = Math.max(12, Math.min(vh - tipSize.h - 12, tipTop));
  }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 290, pointerEvents: "auto" }} />
      <svg
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 291,
          pointerEvents: "none"
        }}
      >
        {rect ? (
          <>
            <path
              d={`M0 0 H${vw} V${vh} H0 Z M${Math.max(0, rect.x - pad)} ${Math.max(0, rect.y - pad)} V${rect.y + rect.height + pad} H${rect.x + rect.width + pad} V${Math.max(0, rect.y - pad)} Z`}
              fill="rgba(8,10,14,0.55)"
              fillRule="evenodd"
            />
            <rect
              x={rect.x - pad}
              y={rect.y - pad}
              width={rect.width + pad * 2}
              height={rect.height + pad * 2}
              rx={8}
              ry={8}
              fill="none"
              stroke="var(--sx-accent)"
              strokeWidth={2}
            />
          </>
        ) : (
          <rect width="100%" height="100%" fill="rgba(8,10,14,0.55)" />
        )}
      </svg>

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tutorial"
        style={tooltipStyle(tipTop, tipLeft)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--ink-4)",
              textTransform: "uppercase"
            }}
          >
            Step {stepIdx + 1} / {last + 1}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => onExit(true)}
            className="sx-btn sx-btn-ghost sx-btn-sm"
            aria-label="Close tutorial"
            style={{ padding: 4 }}
          >
            <Icon name="x" size={12} />
          </button>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
          {step.title}
        </div>
        <div style={{ marginBottom: 12 }}>
          {resolving && step.selector ? "Loading…" : step.body}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ProgressDots
            count={last + 1}
            active={stepIdx}
            onJump={(i) => setStepIdx(i)}
          />
          <div style={{ flex: 1 }} />
          <button type="button" className="sx-btn sx-btn-ghost sx-btn-sm" onClick={() => onExit(true)}>
            Skip
          </button>
          <button
            type="button"
            className="sx-btn sx-btn-sm"
            onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
            disabled={stepIdx === 0}
          >
            <Icon name="arrowL" size={12} />
            Back
          </button>
          {stepIdx < last ? (
            <button
              type="button"
              className="sx-btn sx-btn-primary sx-btn-sm"
              onClick={() => setStepIdx((s) => Math.min(last, s + 1))}
            >
              Next
              <Icon name="arrowR" size={12} />
            </button>
          ) : (
            <button
              type="button"
              className="sx-btn sx-btn-primary sx-btn-sm"
              onClick={() => onExit(false)}
            >
              <Icon name="check" size={12} />
              Finish
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function tooltipStyle(top: number, left: number): CSSProperties {
  return {
    position: "fixed",
    top,
    left,
    width: 380,
    maxWidth: "calc(100vw - 24px)",
    zIndex: 292,
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "var(--sx-radius-lg)",
    boxShadow: "var(--sx-shadow-lg)",
    padding: 16,
    pointerEvents: "auto",
    transition: "top .2s ease, left .2s ease",
    fontSize: 12.5,
    color: "var(--ink-2)",
    lineHeight: 1.55
  };
}

function ProgressDots({
  count,
  active,
  onJump
}: {
  count: number;
  active: number;
  onJump: (i: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Go to step ${i + 1}`}
          onClick={() => onJump(i)}
          style={{
            width: i === active ? 18 : 6,
            height: 6,
            padding: 0,
            border: 0,
            borderRadius: 999,
            background: i === active ? "var(--sx-accent)" : "var(--line-strong)",
            cursor: "pointer",
            transition: "width .15s"
          }}
        />
      ))}
    </div>
  );
}
