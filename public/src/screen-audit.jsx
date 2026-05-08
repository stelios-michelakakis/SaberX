function ScreenAudit() {
  const [tab, setTab] = useState("audit");
  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <PageHeader eyebrow="System" title={tab === "audit" ? "Audit log" : "Integrity issues"}
        subtitle={tab === "audit"
          ? "Immutable record of every meaningful action — actor, timestamp, before/after, transaction correlation."
          : "Open issues from automated integrity checks. Resolve to keep traceability intact."}
        actions={<>
          <button className="btn btn-sm"><Icon name="filter" className="ic-sm" />Filter</button>
          <button className="btn btn-sm"><Icon name="download" className="ic-sm" />Export</button>
        </>}
      />
      <div style={{ padding: "16px 28px 0", display: "flex", borderBottom: "1px solid var(--line)" }}>
        {[["audit", `Events · ${AUDIT_EVENTS.length}`], ["integrity", `Issues · ${INTEGRITY_ISSUES.length}`]].map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "8px 14px", background: "transparent", border: "none",
            borderBottom: "2px solid " + (k === tab ? "var(--ink)" : "transparent"),
            marginBottom: -1, color: k === tab ? "var(--ink)" : "var(--ink-3)",
            fontSize: 12.5, fontWeight: k === tab ? 600 : 500,
            cursor: "default", fontFamily: "inherit",
          }}>{lbl}</button>
        ))}
      </div>
      <div style={{ padding: "20px 28px" }}>
        {tab === "audit" ? (
          <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "130px 160px 150px 1fr 220px",
              gap: 14, padding: "8px 16px",
              background: "var(--panel-2)", borderBottom: "1px solid var(--line)",
              fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)",
            }}>
              <div>Time</div><div>Actor</div><div>Action</div><div>Entity</div><div>Change</div>
            </div>
            {AUDIT_EVENTS.map((e, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "130px 160px 150px 1fr 220px",
                gap: 14, padding: "10px 16px", alignItems: "center",
                borderBottom: i < AUDIT_EVENTS.length - 1 ? "1px solid var(--line)" : "none",
                fontSize: 12.5,
              }}>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{e.t}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {e.actor === "system"
                    ? <span style={{ width: 18, height: 18, borderRadius: 4, background: "var(--ink-2)", color: "var(--bg)", display: "grid", placeItems: "center", fontSize: 10, fontFamily: "var(--font-mono)" }}>S</span>
                    : <Avatar name={e.actor} size={18} />}
                  <span style={{ color: "var(--ink-2)" }}>{e.actor}</span>
                </span>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--accent-ink)" }}>{e.action}</span>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.entity}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, overflow: "hidden", whiteSpace: "nowrap" }}>
                  {e.before !== "—" && <span className="mono" style={{ background: "var(--red-soft)", color: "var(--red)", padding: "1px 5px", borderRadius: 3 }}>{e.before}</span>}
                  {e.before !== "—" && e.after !== "—" && <Icon name="arrowR" size={10} style={{ color: "var(--ink-4)" }} />}
                  {e.after !== "—" && <span className="mono" style={{ background: "var(--green-soft)", color: "var(--green)", padding: "1px 5px", borderRadius: 3 }}>{e.after}</span>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "90px 90px 200px 130px 1fr 100px", gap: 14, padding: "8px 16px", background: "var(--panel-2)", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)" }}>
              <div>ID</div><div>Severity</div><div>Sheet</div><div>Row</div><div>Description</div><div>Opened</div>
            </div>
            {INTEGRITY_ISSUES.map((iss, i) => (
              <div key={iss.id} style={{ display: "grid", gridTemplateColumns: "90px 90px 200px 130px 1fr 100px", gap: 14, padding: "12px 16px", alignItems: "center", borderBottom: i < INTEGRITY_ISSUES.length - 1 ? "1px solid var(--line)" : "none", fontSize: 12.5 }}>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{iss.id}</span>
                <span className={"pill " + (iss.severity === "error" ? "pill-red" : iss.severity === "warning" ? "pill-amber" : "")} style={{ fontSize: 10.5 }}>
                  <Icon name={iss.severity === "error" ? "alert" : iss.severity === "warning" ? "warning" : "info"} size={10} />{iss.severity}
                </span>
                <span style={{ color: "var(--ink-2)" }}>{iss.sheet}</span>
                <span className="mono" style={{ fontSize: 11.5 }}>{iss.row}</span>
                <span style={{ color: "var(--ink-2)" }}>{iss.desc}</span>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{iss.opened}</span>
              </div>
            ))}
            <div style={{ padding: "14px 16px", background: "var(--bg-2)", borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="info" className="ic-sm" />
              Integrity checks run on schedule and after every commit. Detects broken links, type violations, missing required values, duplicate visible IDs, and orphaned records.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
Object.assign(window, { ScreenAudit });
