function ScreenSearch() {
  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <PageHeader eyebrow="Search"
        title={<>Results for <span className="mono" style={{ fontSize: 18, color: "var(--accent-ink)", background: "var(--accent-soft)", padding: "2px 8px", borderRadius: 5 }}>{SEARCH_QUERY}</span></>}
        subtitle="PostgreSQL full-text + trigram. Relation-aware expansion surfaces linked records."
        meta={<>
          <span><b>{SEARCH_RESULTS.length}</b> direct</span>
          <span><b style={{ color: "var(--accent)" }}>14</b> linked</span>
          <span>3 documents</span>
          <span style={{ color: "var(--ink-4)" }}>· 18 ms</span>
        </>}
      />
      <div style={{ padding: "16px 28px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["All", 6, true],["Row values", 5],["Glossary", 1],["Field labels", 0],["Open issues", 0]].map(([lbl,n,on]) => (
          <button key={lbl} style={{
            padding: "5px 12px", borderRadius: 999,
            border: "1px solid " + (on ? "var(--ink)" : "var(--line)"),
            background: on ? "var(--ink)" : "var(--panel)",
            color: on ? "var(--bg)" : "var(--ink-2)",
            fontSize: 12, fontWeight: 500, cursor: "default", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 6,
          }}>{lbl}<span style={{ opacity: 0.7, fontFamily: "var(--font-mono)", fontSize: 10.5 }}>{n}</span></button>
        ))}
      </div>
      <div style={{ padding: "16px 28px" }}>
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", overflow: "hidden" }}>
          {SEARCH_RESULTS.map((r, i) => (
            <div key={i} style={{ padding: "14px 18px", borderBottom: i < SEARCH_RESULTS.length - 1 ? "1px solid var(--line)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>
                <span className="mono" style={{ color: "var(--ink-2)", fontWeight: 500 }}>{r.doc}</span>
                <Icon name="chevronR" size={10} style={{ color: "var(--ink-4)" }} />
                <span>{r.sheet}</span>
                <Icon name="chevronR" size={10} style={{ color: "var(--ink-4)" }} />
                <span className="mono" style={{ color: "var(--accent-ink)" }}>{r.row}</span>
                <Icon name="chevronR" size={10} style={{ color: "var(--ink-4)" }} />
                <span>{r.field}</span>
                <div style={{ flex: 1 }} />
                <Icon name="external" size={11} style={{ color: "var(--ink-4)" }} />
              </div>
              <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }} dangerouslySetInnerHTML={{
                __html: r.excerpt.replace(/(lost.link|LOST_LINK)/gi, '<mark style="background:var(--accent-soft);color:var(--accent-ink);padding:1px 3px;border-radius:3px;font-weight:500">$1</mark>')
              }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { ScreenSearch });
