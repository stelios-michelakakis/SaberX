// Mock data — Sentinel-7 ISR UAV program

const PROGRAM = "Sentinel-7 ISR";

const DOCS = [
  { id: "doc-conops", code: "CONOPS-S7", title: "Sentinel-7 Concept of Operations", type: "CONOPS", status: "Baselined", baseline: "B1.2", classification: "CUI", owner: "M. Reyes", updated: "2 hours ago", rows: 142, sheets: 6, issues: 3, pinned: true },
  { id: "doc-icd-payload", code: "ICD-PAY-01", title: "Payload ↔ Flight Computer ICD", type: "ICD", status: "Under Review", baseline: "B0.9-rc2", classification: "CUI", owner: "K. Iwasaki", updated: "yesterday", rows: 318, sheets: 9, issues: 11 },
  { id: "doc-rtm", code: "RTM-S7", title: "System Requirements Traceability Matrix", type: "RTM", status: "Draft", baseline: "B0.4", classification: "CUI", owner: "A. Chen", updated: "4 days ago", rows: 612, sheets: 4, issues: 27, pinned: true },
  { id: "doc-icd-gcs", code: "ICD-GCS-02", title: "Air Vehicle ↔ Ground Control Station ICD", type: "ICD", status: "Baselined", baseline: "B2.0", classification: "CUI", owner: "K. Iwasaki", updated: "1 week ago", rows: 264, sheets: 7, issues: 1 },
  { id: "doc-conops-radar", code: "CONOPS-RDR", title: "Wide-Area Radar Surveillance CONOPS", type: "CONOPS", status: "Draft", baseline: "B0.2", classification: "CUI", owner: "M. Reyes", updated: "1 week ago", rows: 88, sheets: 5, issues: 6 },
  { id: "doc-rtm-payload", code: "RTM-PAY", title: "Payload Subsystem RTM", type: "RTM", status: "Superseded", baseline: "B1.0", classification: "CUI", owner: "A. Chen", updated: "Mar 14", rows: 201, sheets: 3, issues: 0 },
  { id: "doc-icd-comms", code: "ICD-COM-03", title: "BLOS Comms Datalink ICD", type: "ICD", status: "Seed", baseline: "—", classification: "CUI", owner: "P. Okafor", updated: "Mar 09", rows: 41, sheets: 4, issues: 14 },
];

const DOC_TYPES = {
  CONOPS: { color: "violet", label: "CONOPS" },
  ICD: { color: "accent", label: "ICD" },
  RTM: { color: "green", label: "RTM" },
};

const STATUS_STYLE = {
  "Seed":         "pill",
  "Draft":        "pill",
  "Under Review": "pill pill-amber",
  "Baselined":    "pill pill-green",
  "Superseded":   "pill",
};

// Sheets within the active document (CONOPS-S7)
const SHEETS = [
  { id: "sh-instr",   name: "INSTRUCTIONS", reserved: true,  rows: 1,   icon: "info" },
  { id: "sh-mission", name: "Mission Phases", reserved: false, rows: 14, icon: "list" },
  { id: "sh-stake",   name: "Stakeholders",   reserved: false, rows: 22, icon: "users" },
  { id: "sh-ops",     name: "Operational Scenarios", reserved: false, rows: 31, icon: "cube", active: true },
  { id: "sh-env",     name: "Operating Environments", reserved: false, rows: 18, icon: "layers" },
  { id: "sh-assum",   name: "Assumptions & Constraints", reserved: false, rows: 24, icon: "flag" },
  { id: "sh-gloss",   name: "GLOSSARY",       reserved: true,  rows: 87, icon: "type" },
  { id: "sh-issues",  name: "OPEN ISSUES",    reserved: true,  rows: 12, icon: "alert" },
];

// Schema for the active sheet "Operational Scenarios"
const FIELDS = [
  { slug: "scn_id",      label: "ID",           type: "auto-id",   width: 96,  required: true,  unique: true,  desc: "Auto-generated scenario identifier (SCN-####)." },
  { slug: "title",       label: "Title",        type: "text",      width: 220, required: true,  unique: false, desc: "Short scenario name shown in summaries." },
  { slug: "phase",       label: "Phase",        type: "ref",       width: 140, required: true,  unique: false, desc: "Reference to Mission Phases sheet." },
  { slug: "actors",      label: "Actors",       type: "multi-ref", width: 160, required: false, unique: false, desc: "Stakeholders involved in this scenario." },
  { slug: "trigger",     label: "Trigger",      type: "text",      width: 220, required: false, unique: false, desc: "Event or condition that initiates the scenario." },
  { slug: "outcome",     label: "Expected Outcome", type: "rich",  width: 280, required: false, unique: false, desc: "Narrative description of nominal end state." },
  { slug: "priority",    label: "Priority",     type: "enum",      width: 110, required: true,  unique: false, desc: "Mission criticality." },
  { slug: "status",      label: "Status",       type: "status",    width: 130, required: true,  unique: false, desc: "Scenario lifecycle state." },
  { slug: "linked_reqs", label: "Linked Reqs",  type: "multi-ref", width: 180, required: false, unique: false, desc: "Requirements (RTM-S7) traced to this scenario." },
  { slug: "owner",       label: "Owner",        type: "ref",       width: 140, required: true,  unique: false, desc: "Responsible engineer." },
  { slug: "updated",     label: "Updated",      type: "date",      width: 120, required: false, unique: false, desc: "Last edit timestamp." },
];

const FIELD_TYPE_ICON = {
  "auto-id": "hash", "text": "type", "rich": "type",
  "ref": "link", "multi-ref": "link",
  "enum": "tag", "status": "flag",
  "date": "calendar", "number": "number", "boolean": "bool",
  "url": "external",
};

// Rows for "Operational Scenarios"
const ROWS = [
  { scn_id: "SCN-0001", title: "Day-mission ISR over contested coastline", phase: "Cruise",   actors: ["Mission Cmdr","GCS Op","ISR Analyst"], trigger: "Tasking order received from CAOC", outcome: "Wide-area imagery and SIGINT delivered within 20 min of station arrival.", priority: "P1", status: "Approved", linked_reqs: ["REQ-0142","REQ-0188","REQ-0301"], owner: "M. Reyes", updated: "2026-04-28", flags: [] },
  { scn_id: "SCN-0002", title: "Loss of BLOS link — autonomous return",    phase: "Cruise",   actors: ["Air Vehicle","GCS Op"], trigger: "BLOS datalink degraded > 90 s", outcome: "AV transitions to LOST_LINK profile and recovers via planned route.", priority: "P0", status: "Approved", linked_reqs: ["REQ-0044","REQ-0045"], owner: "K. Iwasaki", updated: "2026-04-26", flags: ["link-warn"] },
  { scn_id: "SCN-0003", title: "Hand-off between adjacent GCS",             phase: "Cruise",   actors: ["GCS-Alpha Op","GCS-Bravo Op"], trigger: "Operator-initiated hand-off command", outcome: "Control authority transferred with zero command-link interruption.", priority: "P1", status: "Under Review", linked_reqs: ["REQ-0211"], owner: "P. Okafor", updated: "2026-04-25", flags: [] },
  { scn_id: "SCN-0004", title: "Emergency divert to alternate recovery field", phase: "Recovery", actors: ["Air Vehicle","GCS Op","ATC"], trigger: "Primary field NOTAM closure", outcome: "AV diverts and lands within fuel reserve.", priority: "P0", status: "Approved", linked_reqs: ["REQ-0301","REQ-0312","REQ-0410"], owner: "M. Reyes", updated: "2026-04-22", flags: [] },
  { scn_id: "SCN-0005", title: "Dynamic re-tasking mid-mission",             phase: "Cruise",   actors: ["Mission Cmdr","GCS Op"], trigger: "Time-sensitive target ATO update", outcome: "AV accepts revised route within 60 s.", priority: "P1", status: "Draft", linked_reqs: ["REQ-0188"], owner: "A. Chen", updated: "2026-04-21", flags: ["missing-ref"] },
  { scn_id: "SCN-0006", title: "Pre-flight built-in test (BIT) failure",     phase: "Pre-flight", actors: ["Maintainer","GCS Op"], trigger: "BIT reports payload subsystem fault", outcome: "Mission scrubbed; fault report logged.", priority: "P2", status: "Approved", linked_reqs: ["REQ-0512"], owner: "P. Okafor", updated: "2026-04-19", flags: [] },
  { scn_id: "SCN-0007", title: "Coordinated multi-ship surveillance",        phase: "Cruise",   actors: ["AV-1","AV-2","Mission Cmdr"], trigger: "Multi-aircraft ATO", outcome: "Two AVs maintain deconflicted orbit and combine sensor coverage.", priority: "P1", status: "Draft", linked_reqs: ["REQ-0188","REQ-0211"], owner: "A. Chen", updated: "2026-04-18", flags: [] },
  { scn_id: "SCN-0008", title: "Adverse weather route replanning",           phase: "Cruise",   actors: ["GCS Op","Met"], trigger: "Convective SIGMET intersects route", outcome: "GCS proposes replan; AV accepts; mission continues.", priority: "P2", status: "Under Review", linked_reqs: ["REQ-0410"], owner: "M. Reyes", updated: "2026-04-17", flags: [] },
  { scn_id: "SCN-0009", title: "Cybersecurity event — anomalous command",    phase: "Cruise",   actors: ["GCS Op","Sec Officer"], trigger: "Command authentication failure", outcome: "AV rejects command; security event logged and escalated.", priority: "P0", status: "Approved", linked_reqs: ["REQ-0044","REQ-0700"], owner: "K. Iwasaki", updated: "2026-04-15", flags: ["link-warn"] },
  { scn_id: "SCN-0010", title: "Sensor calibration in-flight",               phase: "Cruise",   actors: ["ISR Analyst","Air Vehicle"], trigger: "Calibration window reached", outcome: "Payload completes auto-cal; readiness flag updated.", priority: "P3", status: "Draft", linked_reqs: [], owner: "A. Chen", updated: "2026-04-12", flags: ["missing-ref"] },
  { scn_id: "SCN-0011", title: "Runway incursion abort during takeoff",      phase: "Launch",   actors: ["GCS Op","ATC"], trigger: "Incursion detected by tower", outcome: "Takeoff aborted before V1; AV holds short.", priority: "P0", status: "Approved", linked_reqs: ["REQ-0312"], owner: "P. Okafor", updated: "2026-04-10", flags: [] },
  { scn_id: "SCN-0012", title: "Live SIGINT cueing of full-motion video",    phase: "Cruise",   actors: ["ISR Analyst"], trigger: "RF emitter detected", outcome: "EO/IR slewed to emitter LOB; track established.", priority: "P1", status: "Draft", linked_reqs: ["REQ-0142"], owner: "A. Chen", updated: "2026-04-09", flags: [] },
];

const PRIORITIES = { "P0":"red", "P1":"amber", "P2":"accent", "P3":"" };
const STATUSES   = { "Draft":"", "Under Review":"amber", "Approved":"green", "Rejected":"red" };

const OPEN_ISSUES = [
  { id: "ISS-014", kind: "Question", title: "Should LOST_LINK profile differ between coastal and inland AOIs?", owner: "K. Iwasaki", status: "Open",       updated: "today" },
  { id: "ISS-013", kind: "Decision", title: "Adopt MIL-STD-1553B-compliant payload bus for B2.0",                owner: "M. Reyes",   status: "Decided",    updated: "yesterday" },
  { id: "ISS-012", kind: "Issue",    title: "Trace gap: SCN-0010 has no linked requirements",                    owner: "A. Chen",    status: "Open",       updated: "2 days ago" },
  { id: "ISS-011", kind: "Question", title: "Define 'time-sensitive target' threshold for dynamic retasking",     owner: "A. Chen",    status: "In Review",  updated: "3 days ago" },
];

const SNAPSHOTS = [
  { id: "snap-b12", name: "Baseline 1.2 — PDR release",  by: "M. Reyes",   at: "Apr 28, 09:14", state: "Baselined",   delta: { added: 8,  changed: 23, removed: 2 } },
  { id: "snap-b11", name: "Baseline 1.1 — IRR freeze",    by: "M. Reyes",   at: "Apr 14, 16:02", state: "Baselined",   delta: { added: 14, changed: 41, removed: 5 } },
  { id: "snap-b10", name: "Baseline 1.0 — initial",       by: "K. Iwasaki", at: "Mar 02, 11:30", state: "Superseded",  delta: { added: 142,changed: 0,  removed: 0 } },
];

const AUDIT_EVENTS = [
  { t: "10:42:18", actor: "M. Reyes",   action: "row.update",      entity: "SCN-0002", before: "P1", after: "P0", note: "priority raised after PDR" },
  { t: "10:39:02", actor: "A. Chen",    action: "row.create",      entity: "SCN-0012", before: "—",  after: "draft", note: "new scenario" },
  { t: "10:14:55", actor: "K. Iwasaki", action: "ref.add",         entity: "SCN-0009 → REQ-0700", before: "—", after: "linked", note: "" },
  { t: "09:51:30", actor: "system",     action: "integrity.check", entity: "doc-conops",  before: "—", after: "3 issues", note: "scheduled run" },
  { t: "09:14:00", actor: "M. Reyes",   action: "snapshot.create", entity: "snap-b12",    before: "—", after: "Baseline 1.2", note: "PDR release" },
  { t: "08:48:11", actor: "P. Okafor",  action: "schema.update",   entity: "field:linked_reqs", before: "optional", after: "required", note: "" },
  { t: "08:30:42", actor: "A. Chen",    action: "row.update",      entity: "SCN-0007", before: "Draft", after: "Under Review", note: "" },
  { t: "08:02:09", actor: "system",     action: "import.complete", entity: "icd-payload-r4.xlsx", before: "—", after: "318 rows", note: "from K. Iwasaki" },
  { t: "Yesterday 17:22", actor: "M. Reyes", action: "permission.grant", entity: "user:p.okafor", before: "reviewer", after: "editor", note: "scope: doc-conops" },
];

const USERS = [
  { name: "Maya Reyes",        username: "m.reyes",   role: "Document Manager", status: "Active",   last: "2 min ago" },
  { name: "Kenji Iwasaki",     username: "k.iwasaki", role: "Editor",           status: "Active",   last: "12 min ago" },
  { name: "Adaeze Chen",       username: "a.chen",    role: "Editor",           status: "Active",   last: "1 hr ago" },
  { name: "Pius Okafor",       username: "p.okafor",  role: "Reviewer",         status: "Active",   last: "yesterday" },
  { name: "Theo Lindqvist",    username: "t.lindqvist", role: "Administrator", status: "Active",   last: "3 days ago" },
  { name: "Rina Sato",         username: "r.sato",    role: "Reviewer",         status: "Disabled", last: "Mar 02" },
];

const INVITATIONS = [
  { email: "j.boateng@saberx.gov", role: "Editor", invitedBy: "T. Lindqvist", expires: "in 41h", status: "Pending" },
  { email: "n.varga@saberx.gov",   role: "Reviewer", invitedBy: "T. Lindqvist", expires: "in 12h", status: "Pending" },
  { email: "h.ortiz@saberx.gov",   role: "Editor", invitedBy: "T. Lindqvist", expires: "expired", status: "Expired" },
];

const INTEGRITY_ISSUES = [
  { id: "INT-007", severity: "error",   sheet: "Operational Scenarios", row: "SCN-0010", desc: "Required field 'linked_reqs' is empty",          opened: "today" },
  { id: "INT-006", severity: "warning", sheet: "Operational Scenarios", row: "SCN-0005", desc: "Reference 'REQ-9999' not found in RTM-S7",       opened: "today" },
  { id: "INT-005", severity: "warning", sheet: "Operational Scenarios", row: "SCN-0009", desc: "Stale reference: REQ-0044 changed since linking", opened: "yesterday" },
  { id: "INT-004", severity: "info",    sheet: "Glossary",              row: "—",         desc: "12 terms defined but never referenced",         opened: "2d ago" },
];

const SEARCH_QUERY = "lost link";
const SEARCH_RESULTS = [
  { doc: "CONOPS-S7", sheet: "Operational Scenarios", row: "SCN-0002", field: "Title",            excerpt: "Loss of BLOS link — autonomous return" },
  { doc: "CONOPS-S7", sheet: "Operational Scenarios", row: "SCN-0002", field: "Outcome",          excerpt: "AV transitions to LOST_LINK profile and recovers via planned route." },
  { doc: "ICD-PAY-01", sheet: "Datalink Messages",   row: "MSG-1144", field: "Description",      excerpt: "Heartbeat timeout triggers LOST_LINK behaviour…" },
  { doc: "RTM-S7",     sheet: "Functional Reqs",     row: "REQ-0044", field: "Statement",        excerpt: "The system shall enter LOST_LINK profile within 90 s of …" },
  { doc: "RTM-S7",     sheet: "Functional Reqs",     row: "REQ-0045", field: "Statement",        excerpt: "Recovery from LOST_LINK shall not require operator command if …" },
  { doc: "CONOPS-S7", sheet: "GLOSSARY",             row: "GL-LOST",  field: "Definition",        excerpt: "LOST_LINK: state in which the air vehicle has not received a valid …" },
];

Object.assign(window, {
  PROGRAM, DOCS, DOC_TYPES, STATUS_STYLE,
  SHEETS, FIELDS, FIELD_TYPE_ICON, ROWS,
  PRIORITIES, STATUSES,
  OPEN_ISSUES, SNAPSHOTS, AUDIT_EVENTS,
  USERS, INVITATIONS, INTEGRITY_ISSUES,
  SEARCH_QUERY, SEARCH_RESULTS,
});
