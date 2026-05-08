// Repository / dashboard screen — the documents list

function StatBox({ label, value, hint, accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      padding: "12px 14px",
      border: "1px solid var(--line)",
      borderRadius: 8, background: "var(--panel)",
    }}>
      <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 600, color: accent || "var(--ink)", letterSpacing: "-0.015em", fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {hint && <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--ink-3)" }}>{hint}</div>}
    </div>
  );
}

function DocTypeChip({ type }) {
  const t = DOC_TYPES[type];
  return <span className={`pill pill-${t.color}`}>{t.label}</span>;
}

function StatusPill({ status }) {
  const cls = STATUS_STYLE[status] || "pill";
  const colorMap = {
    "Baselined": "var(--green)",
    "Under Review": "var(--amber)",
    "Draft": "var(--ink-3)",
    "Seed": "var(--ink-3)",
    "Superseded": "var(--ink-3)",
  };
  return (
    <span className={cls} style={{ opacity: status === "Superseded" ? 0.6 : 1 }}>
      <span className="dot" style={{ background: colorMap[status] }} />
      {status}
    </span>
  );
}

function ScreenRepository({ onOpenDoc }) {
  const [filter, setFilter] = useState("All");
  const filtered = filter === "All" ? DOCS : DOCS.filter(d => d.type === filter);

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <PageHeader
        eyebrow="Repository"
        title="Documents"
        subtitle={`${DOCS.length} documents in ${PROGRAM} · PostgreSQL is the system of record`}
        actions={<>
          <button className="btn btn-sm"><Icon name="upload" className="ic-sm" />Import .xlsx</button>
          <button className="btn btn-primary btn-sm"><Icon name="plus" className="ic-sm" />New document</button>
        </>}
      />

      <div style={{ padding: "20px 28px 8px", display: "flex", gap: 10 }}>
        <StatBox label="Total documents" value={DOCS.length} hint="across 3 artifact families" />
        <StatBox label="Baselined" value={DOCS.filter(d => d.status === "Baselined").length} hint="ready for downstream use" accent="var(--green)" />
        <StatBox label="Open issues" value={DOCS.reduce((a,d)=>a+d.issues,0)} hint="across all documents" accent="var(--amber)" />
        <StatBox label="Integrity errors" value={3} hint="2 errors · 1 warning" accent="var(--red)" />
      </div>

      <div style={{ padding: "12px 28px 0", display: "flex", alignItems: "center", gap: 8 }}>
        {["All", "CONOPS", "ICD", "RTM"].map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 12px", borderRadius: 6,
              border: "1px solid " + (filter === f ? "var(--ink)" : "var(--line)"),
              background: filter === f ? "var(--ink)" : "var(--panel)",
              color: filter === f ? "var(--bg)" : "var(--ink-2)",
              fontSize: 12.5, fontWeight: 500, cursor: "default",
              fontFamily: "inherit",
            }}
          >{f === "All" ? "All documents" : f}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm"><Icon name="filter" className="ic-sm" />Filter</button>
        <button className="btn btn-ghost btn-sm"><Icon name="sort" className="ic-sm" />Updated</button>
        <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
          <button className="btn-sm" style={{ background: "var(--bg-2)", border: "none", padding: "5px 8px" }}><Icon name="rows" className="ic-sm" /></button>
          <button className="btn-sm" style={{ background: "var(--panel)", border: "none", padding: "5px 8px" }}><Icon name="grid" className="ic-sm" /></button>
        </div>
      </div>

      <div style={{ padding: "12px 28px 28px", flex: 1 }}>
        <div style={{
          border: "1px solid var(--line)", borderRadius: 8,
          background: "var(--panel)", overflow: "hidden",
        }}>
          {/* table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr 110px 120px 100px 110px 130px 30px",
            alignItems: "center", gap: 14,
            padding: "8px 16px",
            fontSize: 11, fontWeight: 500,
            textTransform: "uppercase", letterSpacing: "0.05em",
            color: "var(--ink-3)",
            borderBottom: "1px solid var(--line)",
            background: "var(--panel-2)",
          }}>
            <div style={{ width: 60 }}>Type</div>
            <div>Document</div>
            <div>Status</div>
            <div>Owner</div>
            <div>Rows</div>
            <div>Issues</div>
            <div>Updated</div>
            <div></div>
          </div>
          {filtered.map((d, i) => (
            <button
              key={d.id}
              onClick={() => onOpenDoc(d.id)}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr 110px 120px 100px 110px 130px 30px",
                alignItems: "center", gap: 14,
                padding: "12px 16px",
                width: "100%", textAlign: "left",
                background: "transparent",
                border: "none",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--line)" : "none",
                cursor: "default", color: "var(--ink)",
                fontFamily: "inherit", fontSize: 13,
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ width: 60 }}><DocTypeChip type={d.type} /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {d.pinned && <Icon name="pin" size={12} style={{ color: "var(--accent)", flex: "none" }} />}
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)", flex: "none" }}>{d.code}</span>
                  <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 10 }}>
                  <span><span className="mono">{d.baseline}</span> · {d.classification}</span>
                  <span>{d.sheets} sheets</span>
                </div>
              </div>
              <div><StatusPill status={d.status} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <Avatar name={d.owner} size={20} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.owner}</span>
              </div>
              <div className="mono" style={{ fontSize: 12, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{d.rows.toLocaleString()}</div>
              <div>{d.issues > 0 ? (
                <span className={"pill " + (d.issues > 10 ? "pill-amber" : "")} style={{ fontSize: 11 }}>
                  <Icon name="alert" size={11} />{d.issues}
                </span>
              ) : <span style={{ color: "var(--ink-4)", fontSize: 12 }}>—</span>}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{d.updated}</div>
              <Icon name="chevronR" className="ic-sm" style={{ color: "var(--ink-4)" }} />
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card title="Recent activity" icon="history">
            {AUDIT_EVENTS.slice(0,5).map((e,i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: i < 4 ? "1px solid var(--line)" : "none", fontSize: 12.5 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)", width: 56 }}>{e.t}</span>
                <Avatar name={e.actor === "system" ? "Sx" : e.actor} size={18} />
                <span style={{ flex: 1, color: "var(--ink-2)" }}>
                  <b style={{ fontWeight: 500 }}>{e.actor}</b> {e.action.replace(".", " ")} <span className="mono" style={{ color: "var(--ink-3)" }}>{e.entity}</span>
                </span>
              </div>
            ))}
          </Card>
          <Card title="Open issues" icon="alert" badge={OPEN_ISSUES.filter(i=>i.status==="Open").length}>
            {OPEN_ISSUES.slice(0,4).map((iss, i) => (
              <div key={iss.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: i < 3 ? "1px solid var(--line)" : "none", fontSize: 12.5 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)", width: 60 }}>{iss.id}</span>
                <span className={`pill pill-${iss.kind === "Issue" ? "red" : iss.kind === "Decision" ? "violet" : "amber"}`} style={{ fontSize: 10.5 }}>{iss.kind}</span>
                <span style={{ flex: 1, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{iss.title}</span>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{iss.updated}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, icon, badge, children, action }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <Icon name={icon} className="ic-sm" style={{ color: "var(--ink-3)" }} />}
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</span>
        {badge != null && <span className="pill pill-amber" style={{ fontSize: 10.5 }}>{badge}</span>}
        <div style={{ flex: 1 }} />
        {action}
      </div>
      <div style={{ padding: "4px 14px 10px" }}>{children}</div>
    </div>
  );
}

Object.assign(window, { ScreenRepository, DocTypeChip, StatusPill, Card, StatBox });
