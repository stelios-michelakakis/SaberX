function ScreenTrace() {
  const sources = [
    { id: "SCN-0001", title: "Day-mission ISR", links: 3 },
    { id: "SCN-0002", title: "Loss of BLOS link", links: 2, hi: true },
    { id: "SCN-0003", title: "GCS hand-off", links: 1 },
    { id: "SCN-0009", title: "Cyber: anomalous cmd", links: 2 },
    { id: "SCN-0010", title: "Sensor calibration", links: 0, warn: true },
  ];
  const reqs = [
    { id: "REQ-0044", title: "LOST_LINK timing", hi: true },
    { id: "REQ-0045", title: "Recovery autonomy" },
    { id: "REQ-0142", title: "Imagery delivery" },
    { id: "REQ-0188", title: "Re-tasking response" },
    { id: "REQ-0211", title: "Hand-off authority" },
    { id: "REQ-0700", title: "Cmd authentication" },
  ];
  const links = [[1,0],[1,1],[0,2],[0,3],[2,4],[3,0],[3,5]];
  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <PageHeader eyebrow="Cross-document" title="Trace links"
        subtitle="UUID-stable references between rows. Renumbering visible IDs never breaks traceability."
        meta={<>
          <span><b>973</b> links</span>
          <span><b style={{ color: "var(--green)" }}>968</b> resolved</span>
          <span><b style={{ color: "var(--amber)" }}>4</b> stale</span>
          <span><b style={{ color: "var(--red)" }}>1</b> orphan</span>
        </>}
      />
      <div style={{ padding: "20px 28px" }}>
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", padding: 32, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: "260px 200px 260px" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 10 }}>CONOPS · Scenarios</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sources.map(s => (
                  <div key={s.id} style={{
                    padding: "10px 12px", height: 46, boxSizing: "border-box",
                    border: "1px solid " + (s.warn ? "var(--red)" : s.hi ? "var(--accent)" : "var(--line)"),
                    background: s.hi ? "var(--accent-soft)" : "var(--panel-2)",
                    borderRadius: 7, fontSize: 12,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="mono" style={{ fontWeight: 600 }}>{s.id}</span>
                      {s.warn && <Icon name="warning" size={11} style={{ color: "var(--red)" }} />}
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{s.links} →</span>
                    </div>
                    <div style={{ color: "var(--ink-2)", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                  </div>
                ))}
              </div>
            </div>
            <svg width={200} height={5 * 56}>
              {links.map(([si, ti], i) => {
                const y1 = 23 + si * 56;
                const y2 = 23 + ti * 46;
                const isHi = sources[si].hi || reqs[ti].hi;
                return (<path key={i} d={`M 0 ${y1} C 100 ${y1}, 100 ${y2}, 200 ${y2}`}
                  fill="none" stroke={isHi ? "oklch(0.6 0.16 255)" : "var(--line-strong)"}
                  strokeWidth={isHi ? 1.6 : 1} opacity={isHi ? 0.7 : 0.4} />);
              })}
            </svg>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 10 }}>RTM · Functional Reqs</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {reqs.map(r => (
                  <div key={r.id} style={{
                    padding: "8px 12px", height: 40, boxSizing: "border-box",
                    border: "1px solid " + (r.hi ? "var(--accent)" : "var(--line)"),
                    background: r.hi ? "var(--accent-soft)" : "var(--panel-2)",
                    borderRadius: 7, fontSize: 12,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="mono" style={{ fontWeight: 600 }}>{r.id}</span>
                    </div>
                    <div style={{ color: "var(--ink-2)", fontSize: 11.5 }}>{r.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { ScreenTrace });
