// App shell: sidebar + topbar + theme system + persisted nav.
// Exposes <Shell screen onScreen> as the host wrapper.

const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;

const NAV = [
  { id: "repo",      label: "Documents",     icon: "docs", group: "main" },
  { id: "document",  label: "Active document", icon: "doc",  group: "main", indent: true, hint: "CONOPS-S7" },
  { id: "schema",    label: "Schema",        icon: "schema", group: "main", indent: true },
  { id: "trace",     label: "Trace links",   icon: "trace",  group: "main", indent: true },
  { id: "snapshots", label: "Snapshots",     icon: "history",group: "main", indent: true },
  { id: "search",    label: "Search",        icon: "search", group: "tools" },
  { id: "audit",     label: "Audit log",     icon: "audit",  group: "tools" },
  { id: "integrity", label: "Integrity",     icon: "shield", group: "tools", badge: 3 },
  { id: "admin",     label: "Admin",         icon: "users",  group: "tools" },
];

function Avatar({ name, size = 22 }) {
  const initials = name.split(" ").map(s => s[0]).slice(0,2).join("");
  // deterministic color from name
  const seed = [...name].reduce((a,c)=>a+c.charCodeAt(0),0);
  const hue = seed % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `oklch(0.78 0.06 ${hue})`,
      color: `oklch(0.32 0.07 ${hue})`,
      fontSize: size * 0.42, fontWeight: 600,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      flex: "none", letterSpacing: "0.01em",
      border: "1px solid rgba(0,0,0,0.06)",
    }}>{initials}</div>
  );
}

function Sidebar({ screen, onScreen, collapsed }) {
  const W = collapsed ? 56 : 240;
  return (
    <aside style={{
      width: W, flex: "none",
      borderRight: "1px solid var(--line)",
      background: "var(--panel-2)",
      display: "flex", flexDirection: "column",
      transition: "width .18s ease",
      overflow: "hidden",
    }}>
      {/* Logo / program */}
      <div style={{
        height: 48, padding: "0 14px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5,
          background: "var(--ink)",
          color: "var(--bg)",
          display: "grid", placeItems: "center",
          fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11,
          flex: "none",
        }}>S</div>
        {!collapsed && (
          <>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>SaberX</div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Engineering Docs</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Icon name="chevronD" className="ic-sm" style={{ color: "var(--ink-4)" }} />
            </div>
          </>
        )}
      </div>

      {/* Program selector */}
      {!collapsed && (
        <div style={{ padding: "10px 10px 4px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 8px", borderRadius: 6,
            border: "1px solid var(--line)",
            background: "var(--panel)",
          }}>
            <Icon name="package" className="ic-sm" style={{ color: "var(--accent)" }} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Program</div>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{PROGRAM}</div>
            </div>
            <Icon name="chevronD" size={12} style={{ color: "var(--ink-4)" }} />
          </div>
        </div>
      )}

      <nav style={{ flex: 1, padding: "8px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {!collapsed && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--ink-4)", textTransform: "uppercase", padding: "8px 8px 4px" }}>Workspace</div>}
        {NAV.filter(n => n.group === "main").map(n => (
          <NavItem key={n.id} item={n} active={screen===n.id} onClick={() => onScreen(n.id)} collapsed={collapsed} />
        ))}
        {!collapsed && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--ink-4)", textTransform: "uppercase", padding: "16px 8px 4px" }}>Tools</div>}
        {collapsed && <div style={{ height: 1, background: "var(--line)", margin: "8px 6px" }} />}
        {NAV.filter(n => n.group === "tools").map(n => (
          <NavItem key={n.id} item={n} active={screen===n.id} onClick={() => onScreen(n.id)} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer / user */}
      <div style={{ borderTop: "1px solid var(--line)", padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name="Maya Reyes" size={26} />
        {!collapsed && (
          <>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Maya Reyes</div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>Document Manager</div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ padding: 4 }}>
              <Icon name="settings" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

function NavItem({ item, active, onClick, collapsed }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: collapsed ? "7px 8px" : (item.indent ? "6px 8px 6px 22px" : "6px 8px"),
        borderRadius: 6,
        background: active ? "var(--bg-3)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-2)",
        border: "none", textAlign: "left", cursor: "default",
        fontSize: 12.5, fontWeight: active ? 500 : 400,
        position: "relative",
        justifyContent: collapsed ? "center" : "flex-start",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--bg-2)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <Icon name={item.icon} className="ic-sm" style={{ color: active ? "var(--ink)" : "var(--ink-3)", flex: "none" }} />
      {!collapsed && <span style={{ flex: 1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.label}</span>}
      {!collapsed && item.hint && <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{item.hint}</span>}
      {!collapsed && item.badge != null && (
        <span style={{
          fontSize: 10, fontWeight: 600,
          padding: "1px 6px", borderRadius: 999,
          background: "var(--red-soft)", color: "var(--red)",
        }}>{item.badge}</span>
      )}
    </button>
  );
}

function Topbar({ breadcrumb, onToggleSidebar, onToggleTheme, theme, onSearch }) {
  return (
    <div style={{
      height: 48, flex: "none",
      borderBottom: "1px solid var(--line)",
      background: "var(--panel)",
      display: "flex", alignItems: "center", gap: 12,
      padding: "0 14px",
    }}>
      <button className="btn btn-ghost btn-sm" onClick={onToggleSidebar} style={{ padding: 5 }}>
        <Icon name="panelL" />
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-3)", flex: 1, minWidth: 0, overflow: "hidden" }}>
        {breadcrumb.map((c, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <Icon name="chevronR" size={12} style={{ color: "var(--ink-4)" }} />}
            <span style={{
              color: i === breadcrumb.length - 1 ? "var(--ink)" : "var(--ink-3)",
              fontWeight: i === breadcrumb.length - 1 ? 500 : 400,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{c}</span>
          </span>
        ))}
      </div>

      <button onClick={() => onSearch()}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: 280, height: 30, padding: "0 10px",
          borderRadius: 7, border: "1px solid var(--line)",
          background: "var(--bg-2)", color: "var(--ink-3)",
          fontFamily: "inherit", fontSize: 12.5,
          cursor: "text",
        }}
      >
        <Icon name="search" className="ic-sm" />
        <span>Search documents, fields, rows…</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
          <span className="kbd">⌘</span><span className="kbd">K</span>
        </span>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button className="btn btn-ghost btn-sm" onClick={onToggleTheme} title="Toggle theme" style={{ padding: 5 }}>
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
        <button className="btn btn-ghost btn-sm" style={{ padding: 5, position: "relative" }} title="Notifications">
          <Icon name="bell" />
          <span style={{
            position: "absolute", top: 4, right: 4,
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--red)",
          }} />
        </button>
        <div style={{ width: 1, height: 18, background: "var(--line)", margin: "0 4px" }} />
        <button className="btn btn-sm">
          <Icon name="upload" className="ic-sm" />
          Import
        </button>
        <button className="btn btn-primary btn-sm">
          <Icon name="plus" className="ic-sm" />
          New document
        </button>
      </div>
    </div>
  );
}

// Generic page header used by every screen
function PageHeader({ eyebrow, title, subtitle, actions, meta }) {
  return (
    <div style={{
      padding: "20px 28px 16px",
      borderBottom: "1px solid var(--line)",
      background: "var(--panel)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow && (
            <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>{eyebrow}</div>
          )}
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--ink)" }}>{title}</h1>
          {subtitle && <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)" }}>{subtitle}</div>}
        </div>
        {actions && <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>{actions}</div>}
      </div>
      {meta && <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "var(--ink-3)" }}>{meta}</div>}
    </div>
  );
}

function Empty({ icon, title, hint }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 60, color: "var(--ink-3)", textAlign: "center",
    }}>
      <Icon name={icon} size={28} style={{ color: "var(--ink-4)", marginBottom: 12 }} />
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-2)" }}>{title}</div>
      {hint && <div style={{ marginTop: 4, fontSize: 12.5 }}>{hint}</div>}
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, PageHeader, Empty, Avatar, NAV });
