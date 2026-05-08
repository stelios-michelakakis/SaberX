import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "20px 28px 16px",
        borderBottom: "1px solid var(--line)",
        background: "var(--panel)"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow && (
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                fontWeight: 500,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: 4
              }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--ink)"
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)" }}>{subtitle}</div>
          )}
        </div>
        {actions && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
            {actions}
          </div>
        )}
      </div>
      {meta && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            fontSize: 12,
            color: "var(--ink-3)"
          }}
        >
          {meta}
        </div>
      )}
    </div>
  );
}

export function Empty({ icon: _icon, title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
        color: "var(--ink-3)",
        textAlign: "center"
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-2)" }}>{title}</div>
      {hint && <div style={{ marginTop: 4, fontSize: 12.5 }}>{hint}</div>}
    </div>
  );
}
