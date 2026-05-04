"use client";

import {
  AlertTriangle,
  Archive,
  Bell,
  BookOpen,
  Boxes,
  Check,
  ChevronRight,
  Clock3,
  Database,
  Download,
  FileClock,
  FileSearch,
  FileText,
  Filter,
  GitBranch,
  Grid2X2,
  History,
  KeyRound,
  Layers3,
  Link2,
  Lock,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Rows3,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./saberx-preview.module.css";

type Screen = "repo" | "document" | "schema" | "trace" | "snapshots" | "search" | "audit" | "integrity" | "admin";

const docs = [
  { id: "doc-conops", code: "CONOPS-S7", title: "Sentinel-7 Concept of Operations", type: "CONOPS", status: "Baselined", baseline: "B1.2", classification: "CUI", owner: "M. Reyes", updated: "2 hours ago", rows: 142, sheets: 6, issues: 3 },
  { id: "doc-icd-payload", code: "ICD-PAY-01", title: "Payload to Flight Computer ICD", type: "ICD", status: "Under Review", baseline: "B0.9-rc2", classification: "CUI", owner: "K. Iwasaki", updated: "yesterday", rows: 318, sheets: 9, issues: 11 },
  { id: "doc-rtm", code: "RTM-S7", title: "System Requirements Traceability Matrix", type: "RTM", status: "Draft", baseline: "B0.4", classification: "CUI", owner: "A. Chen", updated: "4 days ago", rows: 612, sheets: 4, issues: 27 },
  { id: "doc-icd-gcs", code: "ICD-GCS-02", title: "Air Vehicle to Ground Control Station ICD", type: "ICD", status: "Baselined", baseline: "B2.0", classification: "CUI", owner: "P. Okafor", updated: "1 week ago", rows: 264, sheets: 7, issues: 1 }
];

const sheets = [
  { id: "instructions", name: "INSTRUCTIONS", rows: 1, reserved: true },
  { id: "mission", name: "Mission Phases", rows: 14, reserved: false },
  { id: "stakeholders", name: "Stakeholders", rows: 22, reserved: false },
  { id: "scenarios", name: "Operational Scenarios", rows: 31, reserved: false },
  { id: "environments", name: "Operating Environments", rows: 18, reserved: false },
  { id: "glossary", name: "GLOSSARY", rows: 87, reserved: true },
  { id: "issues", name: "OPEN ISSUES", rows: 12, reserved: true }
];

const fields = [
  { slug: "scn_id", label: "ID", type: "Auto ID", width: "96px", required: true, unique: true, desc: "Auto-generated scenario identifier." },
  { slug: "title", label: "Title", type: "Short text", width: "230px", required: true, unique: false, desc: "Short scenario name shown in summaries." },
  { slug: "phase", label: "Phase", type: "Reference", width: "140px", required: true, unique: false, desc: "Reference to Mission Phases." },
  { slug: "actors", label: "Actors", type: "Multi reference", width: "170px", required: false, unique: false, desc: "Stakeholders involved in this scenario." },
  { slug: "trigger", label: "Trigger", type: "Long text", width: "230px", required: false, unique: false, desc: "Event or condition that initiates the scenario." },
  { slug: "outcome", label: "Expected Outcome", type: "Long text", width: "310px", required: false, unique: false, desc: "Narrative description of nominal end state." },
  { slug: "priority", label: "Priority", type: "Enum", width: "110px", required: true, unique: false, desc: "Mission criticality." },
  { slug: "status", label: "Status", type: "Status", width: "130px", required: true, unique: false, desc: "Scenario lifecycle state." },
  { slug: "linked_reqs", label: "Linked Reqs", type: "Multi reference", width: "190px", required: false, unique: false, desc: "Requirements traced to this scenario." },
  { slug: "owner", label: "Owner", type: "Reference", width: "130px", required: true, unique: false, desc: "Responsible engineer." }
];

const rows = [
  { scn_id: "SCN-0001", title: "Day-mission ISR over contested coastline", phase: "Cruise", actors: ["Mission Cmdr", "GCS Op", "ISR Analyst"], trigger: "Tasking order received from CAOC", outcome: "Wide-area imagery and SIGINT delivered within 20 min of station arrival.", priority: "P1", status: "Approved", linked_reqs: ["REQ-0142", "REQ-0188", "REQ-0301"], owner: "M. Reyes", flag: "" },
  { scn_id: "SCN-0002", title: "Loss of BLOS link: autonomous return", phase: "Cruise", actors: ["Air Vehicle", "GCS Op"], trigger: "BLOS datalink degraded > 90 s", outcome: "AV transitions to LOST_LINK profile and recovers via planned route.", priority: "P0", status: "Approved", linked_reqs: ["REQ-0044", "REQ-0045"], owner: "K. Iwasaki", flag: "warning" },
  { scn_id: "SCN-0003", title: "Hand-off between adjacent GCS", phase: "Cruise", actors: ["GCS-Alpha Op", "GCS-Bravo Op"], trigger: "Operator initiated hand-off command", outcome: "Control authority transferred with zero command-link interruption.", priority: "P1", status: "Under Review", linked_reqs: ["REQ-0211"], owner: "P. Okafor", flag: "" },
  { scn_id: "SCN-0004", title: "Emergency divert to alternate recovery field", phase: "Recovery", actors: ["Air Vehicle", "GCS Op", "ATC"], trigger: "Primary field NOTAM closure", outcome: "AV diverts and lands within fuel reserve.", priority: "P0", status: "Approved", linked_reqs: ["REQ-0301", "REQ-0312", "REQ-0410"], owner: "M. Reyes", flag: "" },
  { scn_id: "SCN-0005", title: "Dynamic re-tasking mid-mission", phase: "Cruise", actors: ["Mission Cmdr", "GCS Op"], trigger: "Time-sensitive target ATO update", outcome: "AV accepts revised route within 60 s.", priority: "P1", status: "Draft", linked_reqs: ["REQ-0188"], owner: "A. Chen", flag: "error" },
  { scn_id: "SCN-0010", title: "Sensor calibration in-flight", phase: "Cruise", actors: ["ISR Analyst", "Air Vehicle"], trigger: "Calibration window reached", outcome: "Payload completes auto-cal; readiness flag updated.", priority: "P3", status: "Draft", linked_reqs: [], owner: "A. Chen", flag: "error" }
];

const issues = [
  { id: "ISS-014", kind: "Question", title: "Should LOST_LINK profile differ between coastal and inland AOIs?", owner: "K. Iwasaki", status: "Open", updated: "today" },
  { id: "ISS-013", kind: "Decision", title: "Adopt compliant payload bus for B2.0", owner: "M. Reyes", status: "Decided", updated: "yesterday" },
  { id: "ISS-012", kind: "Issue", title: "Trace gap: SCN-0010 has no linked requirements", owner: "A. Chen", status: "Open", updated: "2 days ago" }
];

const audit = [
  { t: "10:42:18", actor: "M. Reyes", action: "CELL_UPDATE", entity: "SCN-0002", before: "P1", after: "P0" },
  { t: "10:39:02", actor: "A. Chen", action: "ROW_CREATE", entity: "SCN-0012", before: "null", after: "draft" },
  { t: "10:14:55", actor: "K. Iwasaki", action: "BINDING_CREATE", entity: "SCN-0009 to REQ-0700", before: "null", after: "linked" },
  { t: "09:51:30", actor: "system", action: "INTEGRITY_WARNING", entity: "CONOPS-S7", before: "clear", after: "3 issues" },
  { t: "09:14:00", actor: "M. Reyes", action: "SNAPSHOT_CREATE", entity: "B1.2", before: "null", after: "PDR release" }
];

const users = [
  { name: "Maya Reyes", username: "m.reyes", role: "Document Manager", status: "Active", last: "2 min ago" },
  { name: "Kenji Iwasaki", username: "k.iwasaki", role: "Editor", status: "Active", last: "12 min ago" },
  { name: "Adaeze Chen", username: "a.chen", role: "Editor", status: "Active", last: "1 hr ago" },
  { name: "Pius Okafor", username: "p.okafor", role: "Reviewer", status: "Active", last: "yesterday" },
  { name: "Rina Sato", username: "r.sato", role: "Reviewer", status: "Disabled", last: "Mar 02" }
];

const integrity = [
  { id: "INT-007", severity: "error", sheet: "Operational Scenarios", row: "SCN-0010", desc: "Required field 'linked_reqs' is empty" },
  { id: "INT-006", severity: "warning", sheet: "Operational Scenarios", row: "SCN-0005", desc: "Reference 'REQ-9999' not found in RTM-S7" },
  { id: "INT-005", severity: "warning", sheet: "Operational Scenarios", row: "SCN-0009", desc: "Stale reference: REQ-0044 changed since linking" }
];

const snapshots = [
  { id: "B1.2", name: "PDR release", by: "M. Reyes", at: "Apr 28, 09:14", state: "Baselined", added: 8, changed: 23, removed: 2 },
  { id: "B1.1", name: "IRR freeze", by: "M. Reyes", at: "Apr 14, 16:02", state: "Baselined", added: 14, changed: 41, removed: 5 },
  { id: "B1.0", name: "Initial baseline", by: "K. Iwasaki", at: "Mar 02, 11:30", state: "Superseded", added: 142, changed: 0, removed: 0 }
];

const searchResults = [
  { doc: "CONOPS-S7", sheet: "Operational Scenarios", row: "SCN-0002", field: "Title", excerpt: "Loss of BLOS link: autonomous return" },
  { doc: "CONOPS-S7", sheet: "Operational Scenarios", row: "SCN-0002", field: "Outcome", excerpt: "AV transitions to LOST_LINK profile and recovers via planned route." },
  { doc: "RTM-S7", sheet: "Functional Reqs", row: "REQ-0044", field: "Statement", excerpt: "The system shall enter LOST_LINK profile within 90 s." },
  { doc: "CONOPS-S7", sheet: "GLOSSARY", row: "GL-LOST", field: "Definition", excerpt: "LOST_LINK: state in which the air vehicle has not received a valid command." }
];

const nav = [
  { id: "repo", label: "Documents", icon: FileText, group: "Workspace" },
  { id: "document", label: "Active document", icon: BookOpen, group: "Workspace" },
  { id: "schema", label: "Schema", icon: SlidersHorizontal, group: "Workspace" },
  { id: "trace", label: "Trace links", icon: GitBranch, group: "Workspace" },
  { id: "snapshots", label: "Snapshots", icon: History, group: "Workspace" },
  { id: "search", label: "Search", icon: Search, group: "Tools" },
  { id: "audit", label: "Audit log", icon: FileClock, group: "Tools" },
  { id: "integrity", label: "Integrity", icon: ShieldCheck, group: "Tools", badge: 3 },
  { id: "admin", label: "Admin", icon: Users, group: "Tools" }
] satisfies Array<{ id: Screen; label: string; icon: typeof FileText; group: string; badge?: number }>;

function cls(...items: Array<string | false | undefined>) {
  return items.filter(Boolean).join(" ");
}

function initials(name: string) {
  return name
    .split(/[ .]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function Pill({ children, tone = "" }: { children: React.ReactNode; tone?: "green" | "amber" | "red" | "violet" | "blue" | "" }) {
  return <span className={cls(styles.pill, tone && styles[tone])}>{children}</span>;
}

function toneForStatus(status: string) {
  if (status === "Baselined" || status === "Approved" || status === "Active") return "green" as const;
  if (status === "Under Review" || status === "Open") return "amber" as const;
  if (status === "Disabled" || status === "Superseded") return "red" as const;
  if (status === "CONOPS") return "violet" as const;
  if (status === "ICD") return "blue" as const;
  if (status === "RTM") return "green" as const;
  return "" as const;
}

function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <div className={styles.label}>{eyebrow}</div>
        <h1 className={styles.pageTitle}>{title}</h1>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}

function Button({ children, primary = false, onClick }: { children: React.ReactNode; primary?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={cls(styles.button, primary && styles.primary)} onClick={onClick}>
      {children}
    </button>
  );
}

export function SaberXPreview() {
  const [screen, setScreen] = useState<Screen>("repo");
  const [filter, setFilter] = useState("All");
  const [sheetId, setSheetId] = useState("scenarios");
  const [selectedRow, setSelectedRow] = useState("SCN-0002");

  const filteredDocs = useMemo(() => (filter === "All" ? docs : docs.filter((doc) => doc.type === filter)), [filter]);
  const selected = rows.find((row) => row.scn_id === selectedRow) ?? rows[1];

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>SX</div>
          <div>
            <div className={styles.brandName}>SaberX</div>
            <div className={styles.brandSub}>Engineering Docs</div>
          </div>
        </div>
        <div className={styles.program}>
          <div className={styles.label}>Program</div>
          <div className={styles.programTitle}>Sentinel-7 ISR</div>
          <div className={styles.brandSub}>CUI · active repository</div>
        </div>
        <nav className={styles.nav} aria-label="Preview navigation">
          {["Workspace", "Tools"].map((group) => (
            <div key={group}>
              <div className={styles.navGroup}>{group}</div>
              {nav
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button" className={cls(styles.navItem, screen === item.id && styles.navActive)} onClick={() => setScreen(item.id)}>
                      <Icon size={16} />
                      <span>{item.label}</span>
                      {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className={styles.userBlock}>
          <div className={styles.avatar}>MR</div>
          <div>
            <div className={styles.programTitle}>Maya Reyes</div>
            <div className={styles.brandSub}>Document Manager</div>
          </div>
        </div>
      </aside>
      <main className={styles.main}>
        <div className={styles.topbar}>
          <button className={styles.button} type="button" aria-label="Toggle navigation">
            <PanelLeft size={16} />
          </button>
          <div className={styles.crumbs}>
            <span>Sentinel-7 ISR</span>
            <ChevronRight size={14} />
            <strong>{nav.find((item) => item.id === screen)?.label}</strong>
          </div>
          <button className={styles.searchButton} type="button" onClick={() => setScreen("search")}>
            <Search size={15} />
            Search documents, fields, rows
          </button>
          <div className={styles.topActions}>
            <Button>
              <Moon size={15} />
            </Button>
            <Button>
              <Bell size={15} />
            </Button>
            <Button>
              <Upload size={15} />
              Import
            </Button>
            <Button primary>
              <Plus size={15} />
              New document
            </Button>
          </div>
        </div>
        <section className={styles.content}>
          {screen === "repo" ? <RepositoryScreen filteredDocs={filteredDocs} filter={filter} setFilter={setFilter} openDocument={() => setScreen("document")} /> : null}
          {screen === "document" ? <DocumentScreen sheetId={sheetId} setSheetId={setSheetId} selectedRow={selectedRow} setSelectedRow={setSelectedRow} selected={selected} /> : null}
          {screen === "schema" ? <SchemaScreen /> : null}
          {screen === "trace" ? <TraceScreen /> : null}
          {screen === "snapshots" ? <SnapshotsScreen /> : null}
          {screen === "search" ? <SearchScreen /> : null}
          {screen === "audit" ? <AuditScreen /> : null}
          {screen === "integrity" ? <IntegrityScreen /> : null}
          {screen === "admin" ? <AdminScreen /> : null}
        </section>
      </main>
    </div>
  );
}

function RepositoryScreen({ filteredDocs, filter, setFilter, openDocument }: { filteredDocs: typeof docs; filter: string; setFilter: (value: string) => void; openDocument: () => void }) {
  return (
    <>
      <PageHeader
        eyebrow="Repository"
        title="Documents"
        subtitle={`${docs.length} documents · PostgreSQL is the system of record · Excel is import/export only`}
        actions={
          <>
            <Button>
              <Upload size={15} />
              Import .xlsx
            </Button>
            <Button primary>
              <Plus size={15} />
              New document
            </Button>
          </>
        }
      />
      <div className={styles.stage}>
        <div className={styles.stats}>
          <Stat label="Total documents" value={docs.length} hint="3 artifact families" />
          <Stat label="Baselined" value={docs.filter((doc) => doc.status === "Baselined").length} hint="ready for downstream use" tone="green" />
          <Stat label="Open issues" value={docs.reduce((sum, doc) => sum + doc.issues, 0)} hint="across all documents" tone="amber" />
          <Stat label="Integrity errors" value={3} hint="2 errors · 1 warning" tone="red" />
        </div>
        <div className={styles.toolbarLine}>
          {["All", "CONOPS", "ICD", "RTM"].map((item) => (
            <button key={item} type="button" className={cls(styles.chip, filter === item && styles.chipActive)} onClick={() => setFilter(item)}>
              {item === "All" ? "All documents" : item}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <Button>
            <Filter size={15} />
            Filter
          </Button>
          <Button>
            <Rows3 size={15} />
            Rows
          </Button>
        </div>
        <div className={styles.panel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Document</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Rows</th>
                <th>Issues</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <Pill tone={toneForStatus(doc.type)}>{doc.type}</Pill>
                  </td>
                  <td>
                    <button className={styles.rowButton} type="button" onClick={openDocument}>
                      <span className={styles.mono}>{doc.code}</span> · <strong>{doc.title}</strong>
                      <div className={styles.brandSub}>
                        {doc.baseline} · {doc.classification} · {doc.sheets} sheets
                      </div>
                    </button>
                  </td>
                  <td>
                    <Pill tone={toneForStatus(doc.status)}>{doc.status}</Pill>
                  </td>
                  <td>{doc.owner}</td>
                  <td className={styles.mono}>{doc.rows.toLocaleString()}</td>
                  <td>{doc.issues ? <Pill tone={doc.issues > 10 ? "amber" : ""}>{doc.issues}</Pill> : "—"}</td>
                  <td>{doc.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cards2}>
          <ActivityCard />
          <IssuesCard />
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, hint, tone = "" }: { label: string; value: number; hint: string; tone?: "green" | "amber" | "red" | "" }) {
  return (
    <div className={styles.stat}>
      <div className={styles.label}>{label}</div>
      <div className={cls(styles.statValue, tone && styles[tone])}>{value}</div>
      <div className={styles.statHint}>{hint}</div>
    </div>
  );
}

function ActivityCard() {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <Clock3 size={15} />
        Recent activity
      </div>
      <table className={styles.table}>
        <tbody>
          {audit.slice(0, 4).map((event) => (
            <tr key={`${event.t}-${event.entity}`}>
              <td className={styles.mono}>{event.t}</td>
              <td>{event.actor}</td>
              <td>{event.action}</td>
              <td className={styles.mono}>{event.entity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssuesCard() {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <AlertTriangle size={15} />
        Open issues
      </div>
      <table className={styles.table}>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td className={styles.mono}>{issue.id}</td>
              <td>{issue.title}</td>
              <td>
                <Pill tone={issue.kind === "Issue" ? "red" : issue.kind === "Decision" ? "violet" : "amber"}>{issue.kind}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentScreen({
  sheetId,
  setSheetId,
  selectedRow,
  setSelectedRow,
  selected
}: {
  sheetId: string;
  setSheetId: (value: string) => void;
  selectedRow: string;
  setSelectedRow: (value: string) => void;
  selected: (typeof rows)[number];
}) {
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", minHeight: "100%" }}>
      <div className={styles.docHeader}>
        <div className={styles.docMeta}>
          <Pill tone="violet">CONOPS</Pill>
          <span className={styles.mono}>CONOPS-S7</span>
          <Pill tone="green">Baselined</Pill>
          <Pill>CUI</Pill>
          <span className={styles.mono}>B1.2</span>
        </div>
        <div className={styles.pageHeader} style={{ padding: 0, border: 0 }}>
          <div>
            <h1 className={styles.pageTitle}>Sentinel-7 Concept of Operations</h1>
            <div className={styles.subtitle}>Owned by Maya Reyes · 142 rows across 6 sheets · last edit 2 hours ago</div>
          </div>
          <div className={styles.actions}>
            <Button>
              <Download size={15} />
              Export .xlsx
            </Button>
            <Button>
              <History size={15} />
              Snapshot
            </Button>
          </div>
        </div>
        <div className={styles.tabs}>
          {sheets.map((sheet) => (
            <button key={sheet.id} type="button" className={cls(styles.tab, sheetId === sheet.id && styles.tabActive)} onClick={() => setSheetId(sheet.id)}>
              {sheet.reserved ? <Lock size={13} /> : <Grid2X2 size={13} />}
              {sheet.name}
              <span className={styles.mono}>{sheet.rows}</span>
            </button>
          ))}
        </div>
      </div>
      {sheetId === "instructions" ? <ReservedPane icon={BookOpen} title="INSTRUCTIONS" text="Document-specific operating guidance, conventions, and editorial notes. This reserved section is always first." /> : null}
      {sheetId === "glossary" ? <GlossaryPane /> : null}
      {sheetId === "issues" ? <OpenIssuesPane /> : null}
      {!["instructions", "glossary", "issues"].includes(sheetId) ? <SheetGrid selectedRow={selectedRow} setSelectedRow={setSelectedRow} selected={selected} /> : null}
    </div>
  );
}

function SheetGrid({ selectedRow, setSelectedRow, selected }: { selectedRow: string; setSelectedRow: (value: string) => void; selected: (typeof rows)[number] }) {
  return (
    <div className={styles.gridArea}>
      <div style={{ minWidth: 0, display: "grid", gridTemplateRows: "48px minmax(0, 1fr)" }}>
        <div className={styles.sheetToolbar}>
          <strong>Operational Scenarios</strong>
          <Pill>31 rows</Pill>
          <span className={styles.brandSub}>{fields.length} fields</span>
          <div style={{ flex: 1 }} />
          <Button>
            <Search size={14} />
            Filter rows
          </Button>
          <Button>
            <Filter size={14} />
            Filter
          </Button>
          <Button primary>
            <Plus size={14} />
            Add row
          </Button>
        </div>
        <div className={styles.gridScroll}>
          <table className={styles.dataGrid}>
            <colgroup>
              <col style={{ width: 42 }} />
              {fields.map((field) => (
                <col key={field.slug} style={{ width: field.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th />
                {fields.map((field) => (
                  <th key={field.slug}>
                    {field.label}
                    {field.required ? <span className={styles.red}> *</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.scn_id} className={row.scn_id === selectedRow ? styles.selected : undefined} onClick={() => setSelectedRow(row.scn_id)}>
                  <td>{row.flag ? <AlertTriangle size={14} className={row.flag === "error" ? styles.red : styles.amber} /> : index + 1}</td>
                  {fields.map((field) => (
                    <td key={field.slug}>{renderCell(row, field.slug)}</td>
                  ))}
                </tr>
              ))}
              <tr className={styles.newRow}>
                <td>
                  <Plus size={14} />
                </td>
                <td colSpan={fields.length}>Always-visible new row</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <aside className={styles.inspector}>
        <div className={styles.panelHead}>
          <FileSearch size={15} />
          Row inspector
        </div>
        <div className={styles.inspectorBody}>
          <div>
            <div className={styles.label}>Selected row</div>
            <h2 style={{ margin: "4px 0" }} className={styles.mono}>
              {selected.scn_id}
            </h2>
            <div className={styles.subtitle}>{selected.title}</div>
          </div>
          <div className={styles.panel} style={{ padding: 12 }}>
            <div className={styles.label}>Trace links</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {selected.linked_reqs.length ? selected.linked_reqs.map((req) => <Pill key={req}>{req}</Pill>) : <Pill tone="red">Missing reference</Pill>}
            </div>
          </div>
          <div className={styles.panel} style={{ padding: 12 }}>
            <div className={styles.label}>Integrity state</div>
            <div style={{ marginTop: 8 }}>{selected.flag === "error" ? <Pill tone="red">Blocked by integrity rule</Pill> : selected.flag === "warning" ? <Pill tone="amber">Review recommended</Pill> : <Pill tone="green">Valid</Pill>}</div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function renderCell(row: (typeof rows)[number], slug: string) {
  const value = row[slug as keyof typeof row];
  if (Array.isArray(value)) {
    return (
      <span style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {value.length ? value.map((item) => <Pill key={item}>{item}</Pill>) : <span className={styles.muted}>—</span>}
      </span>
    );
  }
  if (slug === "priority") return <Pill tone={value === "P0" ? "red" : value === "P1" ? "amber" : value === "P3" ? "" : "blue"}>{String(value)}</Pill>;
  if (slug === "status") return <Pill tone={toneForStatus(String(value))}>{String(value)}</Pill>;
  if (slug === "scn_id") return <span className={styles.mono}>{String(value)}</span>;
  return String(value ?? "—");
}

function ReservedPane({ icon: Icon, title, text }: { icon: typeof BookOpen; title: string; text: string }) {
  return (
    <div className={styles.stage}>
      <div className={styles.empty}>
        <Icon size={28} />
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}

function GlossaryPane() {
  const entries = fields.map((field) => ({ block: "Operational Scenarios", code: field.label, meaning: field.desc }));
  return (
    <div className={styles.stage}>
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <Database size={15} />
          System-generated glossary
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Block</th>
              <th>Field or Code</th>
              <th>Value or Meaning</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.code}>
                <td>{entry.block}</td>
                <td>{entry.code}</td>
                <td>{entry.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpenIssuesPane() {
  return (
    <div className={styles.stage}>
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <AlertTriangle size={15} />
          OPEN ISSUES
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>OP_ID</th>
              <th>Topic</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Related Field</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.id}>
                <td className={styles.mono}>{issue.id}</td>
                <td>{issue.title}</td>
                <td>
                  <Pill tone={toneForStatus(issue.status)}>{issue.status}</Pill>
                </td>
                <td>{issue.owner}</td>
                <td>
                  <Pill>
                    <Link2 size={12} />
                    SCN-0010
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SchemaScreen() {
  return (
    <>
      <PageHeader
        eyebrow="CONOPS-S7 · Operational Scenarios"
        title="Schema"
        subtitle="Field metadata feeds glossary generation, validation, search indexing, and field legends."
        actions={
          <>
            <Button>
              <ShieldCheck size={15} />
              Preview impact
            </Button>
            <Button primary>
              <Plus size={15} />
              Add field
            </Button>
          </>
        }
      />
      <div className={styles.stage}>
        <div className={styles.fieldList}>
          {fields.map((field) => (
            <div className={styles.fieldRow} key={field.slug}>
              <div>
                <strong>{field.label}</strong>
                <div className={styles.brandSub}>{field.desc}</div>
              </div>
              <Pill>{field.type}</Pill>
              {field.required ? <Pill tone="amber">Required</Pill> : <Pill>Optional</Pill>}
              {field.unique ? <Pill tone="green">Unique</Pill> : <Pill>Reusable</Pill>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TraceScreen() {
  const targets = ["REQ-0044", "REQ-0045", "REQ-0142", "REQ-0188", "REQ-0211", "REQ-0301", "REQ-0312", "REQ-0410"];
  return (
    <>
      <PageHeader eyebrow="CONOPS-S7" title="Trace links" subtitle="Scenarios to requirements. Stored as immutable UUID links; visible IDs are human-facing labels." />
      <div className={styles.stage}>
        <div className={styles.traceMap}>
          <div>
            <div className={styles.label} style={{ marginBottom: 10 }}>
              CONOPS Scenarios
            </div>
            {rows.slice(0, 5).map((row) => (
              <div className={styles.traceNode} key={row.scn_id}>
                <span className={styles.mono}>{row.scn_id}</span>
                <span>{row.title}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap: 12, paddingTop: 29 }}>
            {rows.slice(0, 5).map((row) => (
              <div className={styles.traceLine} key={row.scn_id} />
            ))}
          </div>
          <div>
            <div className={styles.label} style={{ marginBottom: 10 }}>
              RTM Requirements
            </div>
            {targets.slice(0, 5).map((target) => (
              <div className={styles.traceNode} key={target}>
                <span className={styles.mono}>{target}</span>
                <span>Requirement statement and verification context</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function SnapshotsScreen() {
  return (
    <>
      <PageHeader
        eyebrow="CONOPS-S7"
        title="Snapshots"
        subtitle="Named baselines preserve reconstructable document state and support diff review."
        actions={
          <Button primary>
            <Plus size={15} />
            Create snapshot
          </Button>
        }
      />
      <div className={styles.stage}>
        <div className={styles.cards2}>
          {snapshots.map((snapshot) => (
            <div className={styles.panel} key={snapshot.id} style={{ padding: 16 }}>
              <Pill tone={toneForStatus(snapshot.state)}>{snapshot.state}</Pill>
              <h2>
                <span className={styles.mono}>{snapshot.id}</span> · {snapshot.name}
              </h2>
              <div className={styles.subtitle}>
                Created by {snapshot.by} · {snapshot.at}
              </div>
              <div className={styles.toolbarLine}>
                <Pill tone="green">+{snapshot.added}</Pill>
                <Pill tone="amber">{snapshot.changed} changed</Pill>
                <Pill tone="red">-{snapshot.removed}</Pill>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SearchScreen() {
  return (
    <>
      <PageHeader eyebrow="Analysis" title="Search" subtitle="Search spans documents, sheets, fields, row values, glossary content, and open issues." />
      <div className={styles.stage}>
        <div className={styles.panel} style={{ padding: 16, marginBottom: 14 }}>
          <div className={styles.searchButton} style={{ width: "100%" }}>
            <Search size={15} />
            lost link
          </div>
        </div>
        <div className={styles.panel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Document</th>
                <th>Sheet</th>
                <th>Row</th>
                <th>Field</th>
                <th>Matched excerpt</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((result) => (
                <tr key={`${result.doc}-${result.row}-${result.field}`}>
                  <td>{result.doc}</td>
                  <td>{result.sheet}</td>
                  <td className={styles.mono}>{result.row}</td>
                  <td>{result.field}</td>
                  <td>{result.excerpt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function AuditScreen() {
  return (
    <>
      <PageHeader eyebrow="Traceability" title="Audit log" subtitle="Every security, data, schema, import, export, snapshot, and derived update is captured." />
      <div className={styles.stage}>
        <div className={styles.panel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((event) => (
                <tr key={`${event.t}-${event.action}`}>
                  <td className={styles.mono}>{event.t}</td>
                  <td>{event.actor}</td>
                  <td>{event.action}</td>
                  <td className={styles.mono}>{event.entity}</td>
                  <td>{event.before}</td>
                  <td>{event.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function IntegrityScreen() {
  return (
    <>
      <PageHeader eyebrow="Integrity" title="Consistency checks" subtitle="Impact analysis prevents broken references and unsafe destructive changes." />
      <div className={styles.stage}>
        <div className={styles.panel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Severity</th>
                <th>Sheet</th>
                <th>Row</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {integrity.map((item) => (
                <tr key={item.id}>
                  <td className={styles.mono}>{item.id}</td>
                  <td>
                    <Pill tone={item.severity === "error" ? "red" : "amber"}>{item.severity}</Pill>
                  </td>
                  <td>{item.sheet}</td>
                  <td className={styles.mono}>{item.row}</td>
                  <td>{item.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function AdminScreen() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Users and invitations"
        subtitle="Closed access only. Users are created by administrator invitation and all security events are audited."
        actions={
          <Button primary>
            <Plus size={15} />
            Create invitation
          </Button>
        }
      />
      <div className={styles.stage}>
        <div className={styles.panel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.username}>
                  <td>
                    <span className={styles.avatar} style={{ width: 26, height: 26, marginRight: 8 }}>
                      {initials(user.name)}
                    </span>
                    {user.name}
                  </td>
                  <td className={styles.mono}>{user.username}</td>
                  <td>{user.role}</td>
                  <td>
                    <Pill tone={toneForStatus(user.status)}>{user.status}</Pill>
                  </td>
                  <td>{user.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
