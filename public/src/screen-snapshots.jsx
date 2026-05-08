// Snapshots & diff screen

function ScreenSnapshots() {
  const [active, setActive] = useState("snap-b12");
  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <PageHeader
        eyebrow="CONOPS-S7"
        title="Snapshots & baselines"
        subtitle="Named, audit-tracked captures. Compare any two to see structural diffs."
        actions={<>
          <button className="btn btn-sm"><Icon name="download" className="ic-sm" />Export diff</button>
          <button className="btn btn-primary btn-sm"><Icon name="plus" className="ic-sm" />Take snapshot</button>
        </>}
      />
      <div style={{ padding: "20px 28px", display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 10 }}>Timeline</div>
          <div style={{ position: "relative", paddingLeft: 14 }}>
            <div style={{ position: "absolute", left: 5, top: 8, bottom: 8, width: 1, background: "var(--line-2)" }} />
            {SNAPSHOTS.map(s => (
              <button key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  position: "relative", display: "block", width: "100%", textAlign: "left",
                  padding: "10px 12px", marginBottom: 8,
                  background: active === s.id ? "var(--accent-soft)" : "var(--panel)",
                  border: "1px solid " + (active === s.id ? "var(--accent)" : "var(--line)"),
                  borderRadius: 7, cursor: "default", fontFamily: "inherit",
                }}
              >
                <span style={{
                  position: "absolute", left: -14, top: 14,
                  width: 10, height: 10, borderRadius: "50%",
                  border: "2px solid var(--bg)",
                  background: active === s.id ? "var(--accent)" : "var(--ink-4)",
                }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{s.by} · {s.at}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, fontSize: 11, alignItems: "center" }}>
                  <StatusPill status={s.state} />
                  <span style={{ color: "var(--green)" }}>+{s.delta.added}</span>
                  <span style={{ color: "var(--amber)" }}>~{s.delta.changed}</span>
                  <span style={{ color: "var(--red)" }}>−{s.delta.removed}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="diff" className="ic-sm" style={{ color: "var(--ink-3)" }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Diff</span>
            <span className="pill" style={{ fontSize: 11 }}>Baseline 1.1</span>
            <Icon name="arrowR" size={11} style={{ color: "var(--ink-4)" }} />
            <span className="pill pill-accent" style={{ fontSize: 11 }}>Baseline 1.2</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>33 changes</span>
          </div>
          {[
            { kind: "added", row: "SCN-0012", title: "Live SIGINT cueing of FMV" },
            { kind: "changed", row: "SCN-0002", title: "Loss of BLOS link", field: "priority", from: "P1", to: "P0" },
            { kind: "changed", row: "SCN-0009", title: "Anomalous command", field: "linked_reqs", from: "[REQ-0044]", to: "[REQ-0044, REQ-0700]" },
            { kind: "removed", row: "SCN-0004A", title: "Manual divert (deprecated)" },
            { kind: "changed", row: "field:linked_reqs", title: "Linked Reqs", field: "required", from: "false", to: "true" },
            { kind: "added", row: "SCN-0011", title: "Runway incursion abort" },
            { kind: "changed", row: "SCN-0007", title: "Multi-ship surveillance", field: "status", from: "Draft", to: "Under Review" },
          ].map((d, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "30px 130px 1fr 30px",
              gap: 14, padding: "10px 16px", alignItems: "center",
              borderBottom: i < 6 ? "1px solid var(--line)" : "none",
              fontSize: 12.5,
            }}>
              <DiffMark kind={d.kind} />
              <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{d.row}</span>
              <div>
                <span style={{ color: "var(--ink-2)" }}>{d.title}</span>
                {d.field && (
                  <div style={{ marginTop: 4, fontSize: 11.5, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span className="mono" style={{ color: "var(--ink-3)" }}>{d.field}:</span>
                    <span className="mono" style={{ background: "var(--red-soft)", color: "var(--red)", padding: "1px 5px", borderRadius: 3, textDecoration: "line-through" }}>{d.from}</span>
                    <Icon name="arrowR" size={10} style={{ color: "var(--ink-4)" }} />
                    <span className="mono" style={{ background: "var(--green-soft)", color: "var(--green)", padding: "1px 5px", borderRadius: 3 }}>{d.to}</span>
                  </div>
                )}
              </div>
              <Icon name="external" className="ic-sm" style={{ color: "var(--ink-4)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiffMark({ kind }) {
  const map = { added: { color: "green", sym: "+" }, removed: { color: "red", sym: "−" }, changed: { color: "amber", sym: "~" } };
  const v = map[kind];
  return <span className={`pill pill-${v.color}`} style={{ fontSize: 12, justifyContent: "center", width: 22, height: 22, padding: 0, fontWeight: 700 }}>{v.sym}</span>;
}

Object.assign(window, { ScreenSnapshots, DiffMark });
