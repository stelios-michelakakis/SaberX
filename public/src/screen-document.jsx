// Document detail — the centerpiece. Sheet picker + grid editor + inspector.

function ReservedBanner({ kind }) {
  if (kind === "instr") return null;
  const data = {
    glossary: { icon: "type", title: "GLOSSARY", desc: "System-generated from document, schema, field, enum, and ID-policy metadata. Read-only." },
    issues:   { icon: "alert", title: "OPEN ISSUES", desc: "Built-in tracking for issues, questions, and decisions. Always present." },
  }[kind];
  if (!data) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 16px", margin: "12px 16px 0",
      background: "var(--accent-soft)", color: "var(--accent-ink)",
      borderRadius: 7, fontSize: 12.5,
    }}>
      <Icon name="lock" className="ic-sm" />
      <b style={{ fontWeight: 600 }}>{data.title}</b>
      <span style={{ opacity: 0.85 }}>· {data.desc}</span>
    </div>
  );
}

function FieldTypeBadge({ type }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "1px 6px", borderRadius: 4,
      background: "var(--bg-2)", border: "1px solid var(--line)",
      fontFamily: "var(--font-mono)", fontSize: 10.5,
      color: "var(--ink-3)",
    }}>
      <Icon name={FIELD_TYPE_ICON[type] || "type"} size={10} />
      {type}
    </span>
  );
}

function CellPriority({ value }) {
  const color = PRIORITIES[value];
  if (!color) return <span style={{ fontSize: 12 }}>{value}</span>;
  return <span className={`pill pill-${color}`} style={{ fontSize: 10.5 }}>{value}</span>;
}
function CellStatus({ value }) {
  const color = STATUSES[value];
  return (
    <span className={`pill ${color ? "pill-" + color : ""}`} style={{ fontSize: 10.5 }}>
      <span className="dot" />{value}
    </span>
  );
}
function CellRefs({ values }) {
  if (!values || values.length === 0) return <span style={{ color: "var(--ink-4)", fontSize: 12 }}>—</span>;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
      {values.slice(0,2).map(v => (
        <span key={v} className="mono" style={{
          fontSize: 10.5, padding: "1px 5px",
          border: "1px solid var(--line)", borderRadius: 4,
          background: "var(--panel-2)", color: "var(--ink-2)",
          display: "inline-flex", alignItems: "center", gap: 3,
        }}>
          <Icon name="link" size={9} style={{ color: "var(--ink-4)" }} />{v}
        </span>
      ))}
      {values.length > 2 && <span style={{ fontSize: 11, color: "var(--ink-3)" }}>+{values.length - 2}</span>}
    </span>
  );
}
function CellActors({ values }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {values.slice(0,3).map((a, i) => (
        <span key={i} title={a} style={{ marginLeft: i ? -6 : 0 }}><Avatar name={a} size={18} /></span>
      ))}
      {values.length > 3 && <span style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: 4 }}>+{values.length - 3}</span>}
    </span>
  );
}

function ScreenDocument({ showTraceColumns }) {
  const [sheetId, setSheetId] = useState("sh-ops");
  const [selected, setSelected] = useState("SCN-0002");
  const sheet = SHEETS.find(s => s.id === sheetId);
  const isReserved = sheet?.reserved;
  const reservedKind = sheetId === "sh-instr" ? "instr" : sheetId === "sh-gloss" ? "glossary" : sheetId === "sh-issues" ? "issues" : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Document header */}
      <div style={{ borderBottom: "1px solid var(--line)", background: "var(--panel)", padding: "16px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <DocTypeChip type="CONOPS" />
              <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>CONOPS-S7</span>
              <StatusPill status="Baselined" />
              <span className="pill" style={{ fontSize: 10.5 }}>CUI</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>baseline B1.2</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Sentinel-7 Concept of Operations</h1>
              <button className="btn btn-ghost btn-sm" style={{ padding: 4 }}><Icon name="edit" className="ic-sm" /></button>
            </div>
            <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--ink-3)" }}>
              Owned by Maya Reyes · 142 rows across 6 sheets · last edit 2 hours ago
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button className="btn btn-sm"><Icon name="download" className="ic-sm" />Export .xlsx</button>
            <button className="btn btn-sm"><Icon name="history" className="ic-sm" />Snapshot</button>
            <button className="btn btn-sm"><Icon name="more" /></button>
          </div>
        </div>

        {/* Sheet tabs */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "flex-end", gap: 0, overflowX: "auto" }}>
          {SHEETS.map(s => (
            <button
              key={s.id}
              onClick={() => setSheetId(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px",
                background: "transparent",
                border: "none",
                borderBottom: "2px solid " + (s.id === sheetId ? "var(--ink)" : "transparent"),
                color: s.id === sheetId ? "var(--ink)" : "var(--ink-3)",
                fontSize: 12.5, fontWeight: s.id === sheetId ? 600 : 500,
                cursor: "default", whiteSpace: "nowrap",
                fontFamily: "inherit",
                marginBottom: -1,
              }}
            >
              {s.reserved && <Icon name="lock" size={11} style={{ color: s.reserved ? "var(--accent)" : "inherit" }} />}
              <Icon name={s.icon} className="ic-sm" />
              <span>{s.name}</span>
              <span style={{
                fontSize: 10.5, color: "var(--ink-4)",
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
              }}>{s.rows}</span>
            </button>
          ))}
          <button style={{ padding: "8px 12px", background: "transparent", border: "none", color: "var(--ink-4)", fontSize: 12.5, cursor: "default" }}>
            <Icon name="plus" className="ic-sm" />
          </button>
        </div>
      </div>

      {/* Sheet content */}
      {reservedKind === "instr" ? (
        <InstructionsPane />
      ) : reservedKind === "glossary" ? (
        <GlossaryPane />
      ) : reservedKind === "issues" ? (
        <OpenIssuesPane />
      ) : (
        <SheetGrid sheet={sheet} selected={selected} setSelected={setSelected} showTraceColumns={showTraceColumns} />
      )}
    </div>
  );
}

function SheetGrid({ sheet, selected, setSelected, showTraceColumns }) {
  const visibleFields = useMemo(() => showTraceColumns ? FIELDS : FIELDS.filter(f => f.slug !== "linked_reqs"), [showTraceColumns]);
  const selectedRow = ROWS.find(r => r.scn_id === selected);

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
      {/* main grid + toolbar */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg)" }}>
        {/* sheet toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 16px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
        }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{sheet.name}</h2>
          <span className="pill" style={{ fontSize: 10.5 }}><span className="mono">{sheet.rows}</span> rows</span>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>· {visibleFields.length} fields</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 8px", borderRight: "1px solid var(--line)", height: 22 }}>
            <Icon name="search" className="ic-sm" style={{ color: "var(--ink-4)" }} />
            <input placeholder="Filter rows…" style={{
              border: "none", outline: "none", background: "transparent",
              fontSize: 12, color: "var(--ink)", width: 130, fontFamily: "inherit",
            }} />
          </div>
          <button className="btn btn-ghost btn-sm"><Icon name="filter" className="ic-sm" />Filter</button>
          <button className="btn btn-ghost btn-sm"><Icon name="sort" className="ic-sm" />Sort</button>
          <button className="btn btn-ghost btn-sm"><Icon name="eye" className="ic-sm" />Fields</button>
          <div style={{ width: 1, height: 18, background: "var(--line)", margin: "0 4px" }} />
          <button className="btn btn-primary btn-sm"><Icon name="plus" className="ic-sm" />Add row</button>
        </div>

        {/* the grid */}
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          <table style={{
            borderCollapse: "separate", borderSpacing: 0,
            width: "100%",
            fontSize: 12.5,
            tableLayout: "fixed",
            minWidth: 1400,
          }}>
            <colgroup>
              <col style={{ width: 32 }} />
              {visibleFields.map(f => <col key={f.slug} style={{ width: f.width }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={hdrStyle}></th>
                {visibleFields.map(f => (
                  <th key={f.slug} style={{ ...hdrStyle, padding: "0 10px", height: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon name={FIELD_TYPE_ICON[f.type] || "type"} size={11} style={{ color: "var(--ink-4)", flex: "none" }} />
                      <span style={{ fontWeight: 500, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</span>
                      {f.required && <span style={{ color: "var(--red)", fontSize: 11 }}>*</span>}
                      <div style={{ flex: 1 }} />
                      <Icon name="chevronD" size={10} style={{ color: "var(--ink-4)", flex: "none" }} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => {
                const isSel = r.scn_id === selected;
                const hasFlag = r.flags && r.flags.length > 0;
                return (
                  <tr key={r.scn_id}
                    onClick={() => setSelected(r.scn_id)}
                    style={{ background: isSel ? "var(--accent-soft)" : "transparent", cursor: "default" }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--bg-2)"; }}
                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ ...cellStyle, textAlign: "center", color: "var(--ink-4)", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
                      {hasFlag ? (
                        <Icon name={r.flags.includes("link-warn") ? "warning" : "alert"} size={11} style={{ color: r.flags.includes("link-warn") ? "var(--amber)" : "var(--red)" }} />
                      ) : (i + 1)}
                    </td>
                    {visibleFields.map(f => (
                      <td key={f.slug} style={{
                        ...cellStyle,
                        borderLeft: isSel && f.slug === visibleFields[0].slug ? "2px solid var(--accent)" : cellStyle.borderLeft,
                        paddingLeft: isSel && f.slug === visibleFields[0].slug ? 8 : 10,
                      }}>
                        <CellRender row={r} field={f} />
                      </td>
                    ))}
                  </tr>
                );
              })}
              {/* phantom row */}
              <tr>
                <td style={{ ...cellStyle, color: "var(--ink-4)" }}><Icon name="plus" size={11} /></td>
                <td colSpan={visibleFields.length} style={{ ...cellStyle, color: "var(--ink-4)", fontStyle: "italic" }}>Add row…</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* inspector */}
      {selectedRow && <RowInspector row={selectedRow} onClose={() => setSelected(null)} />}
    </div>
  );
}

const hdrStyle = {
  position: "sticky", top: 0, zIndex: 1,
  textAlign: "left",
  background: "var(--panel-2)",
  borderBottom: "1px solid var(--line)",
  borderRight: "1px solid var(--line)",
  padding: "0 10px", height: 32,
  fontSize: 11, fontWeight: 500,
  color: "var(--ink-3)",
};
const cellStyle = {
  padding: "0 10px",
  height: "var(--row-h)",
  borderBottom: "1px solid var(--line)",
  borderRight: "1px solid var(--line)",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  verticalAlign: "middle",
};

function CellRender({ row, field }) {
  const v = row[field.slug];
  switch (field.type) {
    case "auto-id":
      return <span className="mono" style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink)" }}>{v}</span>;
    case "ref":
      return <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="link" size={10} style={{ color: "var(--ink-4)" }} />{v}</span>;
    case "multi-ref":
      if (field.slug === "actors") return <CellActors values={v} />;
      return <CellRefs values={v} />;
    case "enum":
      return <CellPriority value={v} />;
    case "status":
      return <CellStatus value={v} />;
    case "date":
      return <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{v}</span>;
    case "rich":
    case "text":
    default:
      return <span style={{ color: "var(--ink-2)" }}>{v}</span>;
  }
}

function RowInspector({ row, onClose }) {
  return (
    <div style={{
      width: 360, flex: "none",
      borderLeft: "1px solid var(--line)",
      background: "var(--panel)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{row.scn_id}</span>
        <CellStatus value={row.status} />
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" style={{ padding: 4 }}><Icon name="external" /></button>
        <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={onClose}><Icon name="x" /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3 }}>{row.title}</h3>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <InspectorField label="Phase" type="ref">
            <span className="mono" style={{ fontSize: 12, display: "inline-flex", gap: 4, alignItems: "center" }}>
              <Icon name="link" size={11} style={{ color: "var(--ink-4)" }} />{row.phase}
            </span>
          </InspectorField>
          <InspectorField label="Priority" type="enum">
            <CellPriority value={row.priority} />
          </InspectorField>
          <InspectorField label="Owner" type="ref">
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Avatar name={row.owner} size={18} />{row.owner}
            </span>
          </InspectorField>
          <InspectorField label="Updated" type="date">
            <span className="mono" style={{ fontSize: 12 }}>{row.updated}</span>
          </InspectorField>
          <InspectorField label="Trigger" type="text">
            <span style={{ fontSize: 12.5 }}>{row.trigger}</span>
          </InspectorField>
          <InspectorField label="Expected outcome" type="rich">
            <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{row.outcome}</span>
          </InspectorField>
          <InspectorField label="Actors" type="multi-ref">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {row.actors.map(a => (
                <span key={a} className="pill" style={{ fontSize: 11 }}><Avatar name={a} size={14} />{a}</span>
              ))}
            </div>
          </InspectorField>
          <InspectorField label="Linked requirements" type="multi-ref" hint={`${row.linked_reqs.length} traced`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {row.linked_reqs.map(req => (
                <div key={req} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", border: "1px solid var(--line)", borderRadius: 5,
                  background: "var(--panel-2)",
                }}>
                  <Icon name="link" size={11} style={{ color: "var(--accent)" }} />
                  <span className="mono" style={{ fontSize: 11.5 }}>{req}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>RTM-S7 / Functional</span>
                  <Icon name="external" size={11} style={{ color: "var(--ink-4)", marginLeft: "auto" }} />
                </div>
              ))}
              {row.linked_reqs.length === 0 && (
                <div style={{
                  padding: "8px 10px", border: "1px dashed var(--red)", borderRadius: 5,
                  fontSize: 11.5, color: "var(--red)", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Icon name="warning" size={11} />No requirements linked — integrity warning
                </div>
              )}
              <button className="btn btn-sm" style={{ alignSelf: "flex-start", marginTop: 4 }}>
                <Icon name="plus" className="ic-sm" />Link requirement
              </button>
            </div>
          </InspectorField>
        </div>

        {/* History trail */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 8 }}>History</div>
          {[
            { t: "today 10:42", a: "M. Reyes", what: "Priority changed", from: "P1", to: "P0" },
            { t: "Apr 26", a: "K. Iwasaki", what: "Created reference", to: "REQ-0044" },
            { t: "Apr 24", a: "M. Reyes", what: "Approved", to: null },
          ].map((h, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", fontSize: 12 }}>
              <span style={{ width: 8, display: "flex", justifyContent: "center", paddingTop: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--line-strong)" }} />
              </span>
              <div style={{ flex: 1 }}>
                <div><b style={{ fontWeight: 500 }}>{h.a}</b> · {h.what} {h.to && <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{h.from ? `${h.from} → ` : ""}{h.to}</span>}</div>
                <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{h.t}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InspectorField({ label, type, children, hint }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-4)" }}>{label}</span>
        {hint && <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>· {hint}</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function InstructionsPane() {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 28px", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <ReservedBanner kind="instr" />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name="lock" className="ic-sm" style={{ color: "var(--accent)" }} />
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-3)" }}>Reserved · Instructions</h2>
      </div>
      <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>How to use this CONOPS</h1>
      <p style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.6 }}>
        This document captures operational scenarios, environments, and assumptions for the Sentinel-7 ISR platform. Edit the structured sheets — never paste prose into them. The system enforces field-level types and cross-document references.
      </p>
      <div style={{ marginTop: 24, padding: "16px 18px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel-2)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>Authoring conventions</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)" }}>
          <li>Every operational scenario must trace to at least one functional requirement in <b>RTM-S7</b>.</li>
          <li>Use <span className="mono" style={{ fontSize: 12 }}>P0</span>–<span className="mono" style={{ fontSize: 12 }}>P3</span> consistently — see the GLOSSARY for definitions.</li>
          <li>References to GCS or AV components must point at canonical rows in <b>ICD-GCS-02</b>.</li>
          <li>Submit terminology questions in OPEN ISSUES rather than redefining glossary terms inline.</li>
        </ol>
      </div>
    </div>
  );
}

function GlossaryPane() {
  const terms = [
    { term: "AV",        kind: "abbrev", def: "Air Vehicle. The unmanned aircraft itself, distinct from the air system." },
    { term: "BLOS",      kind: "abbrev", def: "Beyond Line-of-Sight. Communication relay required outside RF horizon." },
    { term: "GCS",       kind: "abbrev", def: "Ground Control Station. The fixed or mobile facility from which the AV is commanded." },
    { term: "ISR",       kind: "abbrev", def: "Intelligence, Surveillance, and Reconnaissance." },
    { term: "LOST_LINK", kind: "enum",   def: "Air vehicle behavior profile entered when valid command messages have not been received within the link-loss timeout." },
    { term: "P0",        kind: "enum",   def: "Highest priority. Loss-of-mission or loss-of-vehicle level scenarios." },
    { term: "Phase",     kind: "field",  def: "Reference field on Operational Scenarios pointing at the Mission Phases sheet." },
    { term: "SCN-####",  kind: "id",     def: "Visible engineering ID for Operational Scenario rows. Auto-generated, never used as primary key." },
  ];
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <ReservedBanner kind="glossary" />
      <div style={{ padding: "20px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Glossary</h2>
          <span className="pill" style={{ fontSize: 11 }}>{terms.length} terms · auto-generated</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm"><Icon name="refresh" className="ic-sm" />Regenerate</button>
        </div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
          {terms.map((t, i) => (
            <div key={t.term} style={{
              display: "grid", gridTemplateColumns: "180px 90px 1fr",
              gap: 16, padding: "12px 16px",
              borderBottom: i < terms.length - 1 ? "1px solid var(--line)" : "none",
              background: "var(--panel)",
            }}>
              <div className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{t.term}</div>
              <div><span className="pill" style={{ fontSize: 10.5 }}>{t.kind}</span></div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{t.def}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OpenIssuesPane() {
  const allIssues = [...OPEN_ISSUES,
    { id: "ISS-010", kind: "Issue", title: "Inconsistent phase naming between Mission Phases and Scenarios", owner: "K. Iwasaki", status: "Open", updated: "4 days ago" },
    { id: "ISS-009", kind: "Question", title: "Are coastal vs. inland AOIs treated the same in P0 scenarios?", owner: "M. Reyes", status: "Open", updated: "1 week ago" },
    { id: "ISS-008", kind: "Decision", title: "Use MIL-STD-1553 for payload bus", owner: "T. Lindqvist", status: "Decided", updated: "Mar 28" },
  ];
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <ReservedBanner kind="issues" />
      <div style={{ padding: "20px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Open Issues</h2>
          <span className="pill pill-amber" style={{ fontSize: 11 }}>{allIssues.filter(i=>i.status==="Open").length} open</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm"><Icon name="plus" className="ic-sm" />New issue</button>
        </div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "var(--panel)" }}>
          {allIssues.map((iss, i) => (
            <div key={iss.id} style={{
              display: "grid", gridTemplateColumns: "70px 90px 1fr 130px 110px",
              alignItems: "center", gap: 12,
              padding: "12px 16px",
              borderBottom: i < allIssues.length - 1 ? "1px solid var(--line)" : "none",
              fontSize: 12.5,
            }}>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{iss.id}</span>
              <span className={`pill pill-${iss.kind === "Issue" ? "red" : iss.kind === "Decision" ? "violet" : "amber"}`} style={{ fontSize: 10.5 }}>{iss.kind}</span>
              <span style={{ color: "var(--ink-2)" }}>{iss.title}</span>
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <Avatar name={iss.owner} size={18} />{iss.owner}
              </span>
              <span style={{
                fontSize: 11, color: iss.status === "Open" ? "var(--amber)" : "var(--ink-3)",
              }}>{iss.status} · {iss.updated}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenDocument });
