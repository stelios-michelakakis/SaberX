// Schema editor screen — fields of the active sheet.

function ScreenSchema() {
  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <PageHeader
        eyebrow="CONOPS-S7 · Operational Scenarios"
        title="Schema"
        subtitle="Field metadata feeds glossary generation, validation, search indexing, and field legends."
        actions={<>
          <button className="btn btn-sm"><Icon name="flask" className="ic-sm" />Preview impact</button>
          <button className="btn btn-primary btn-sm"><Icon name="plus" className="ic-sm" />Add field</button>
        </>}
        meta={<>
          <span><Icon name="hash" className="ic-sm" style={{verticalAlign:"text-bottom",marginRight:4}}/>ID policy: <span className="mono">SCN-</span> · zero-padded 4</span>
          <span><Icon name="check" className="ic-sm" style={{verticalAlign:"text-bottom",marginRight:4,color:"var(--green)"}}/>Compound prefixes: disabled</span>
          <span>{FIELDS.length} fields · {FIELDS.filter(f=>f.required).length} required · {FIELDS.filter(f=>f.unique).length} unique</span>
        </>}
      />
      <div style={{ padding: "20px 28px" }}>
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", overflow: "hidden" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "32px 200px 140px 120px 80px 80px 80px 1fr",
            padding: "8px 14px", gap: 12, alignItems: "center",
            background: "var(--panel-2)", borderBottom: "1px solid var(--line)",
            fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)", fontWeight: 500,
          }}>
            <div></div><div>Field</div><div>Slug</div><div>Type</div><div>Req</div><div>Unique</div><div>Visible</div><div>Description</div>
          </div>
          {FIELDS.map((f, i) => (
            <div key={f.slug} style={{
              display: "grid", gridTemplateColumns: "32px 200px 140px 120px 80px 80px 80px 1fr",
              padding: "10px 14px", gap: 12, alignItems: "center",
              borderBottom: i < FIELDS.length - 1 ? "1px solid var(--line)" : "none",
              fontSize: 12.5,
            }}>
              <Icon name="dragHandle" className="ic-sm" style={{ color: "var(--ink-4)" }} />
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <Icon name={FIELD_TYPE_ICON[f.type]} size={11} style={{ color: "var(--ink-4)" }} />
                <span style={{ fontWeight: 500 }}>{f.label}</span>
                {f.required && <span style={{ color: "var(--red)" }}>*</span>}
              </div>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{f.slug}</span>
              <FieldTypeBadge type={f.type} />
              <div>{f.required ? <Icon name="check" size={12} style={{color:"var(--green)"}}/> : <span style={{color:"var(--ink-4)"}}>—</span>}</div>
              <div>{f.unique ? <Icon name="check" size={12} style={{color:"var(--green)"}}/> : <span style={{color:"var(--ink-4)"}}>—</span>}</div>
              <div><Icon name="eye" size={12} style={{color:"var(--ink-3)"}}/></div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.ScreenSchema = ScreenSchema;
