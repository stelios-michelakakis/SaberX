"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "./avatar";
import { Icon } from "./icon";
import { useTweaks } from "./theme-provider";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  group: "main" | "tools";
  indent?: boolean;
  hint?: string;
  badge?: number;
  matchPrefix?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Documents", icon: "docs", group: "main" },
  { href: "/dashboard/documents", label: "Active document", icon: "doc", group: "main", indent: true, matchPrefix: true },
  { href: "/dashboard/schema", label: "Schema", icon: "schema", group: "main", indent: true, matchPrefix: true },
  { href: "/dashboard/trace", label: "Trace links", icon: "trace", group: "main", indent: true },
  { href: "/dashboard/snapshots", label: "Snapshots", icon: "history", group: "main", indent: true },
  { href: "/dashboard/search", label: "Search", icon: "search", group: "tools" },
  { href: "/dashboard/audit", label: "Audit log", icon: "audit", group: "tools" },
  { href: "/dashboard/integrity", label: "Integrity", icon: "shield", group: "tools" },
  { href: "/dashboard/admin", label: "Admin", icon: "users", group: "tools" },
  { href: "/dashboard/profile", label: "Profile", icon: "user", group: "tools" }
];

type Props = {
  user: { name: string; role: string };
  programName: string;
  integrityCount?: number;
};

export function Sidebar({ user, programName, integrityCount = 0 }: Props) {
  const { tweaks } = useTweaks();
  const collapsed = tweaks.sidebarCollapsed;
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const W = collapsed ? 56 : 240;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const isActive = (item: NavItem) => {
    if (item.href === "/dashboard") return pathname === "/dashboard";
    if (item.matchPrefix) return pathname.startsWith(item.href);
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <aside
      style={{
        width: W,
        flex: "none",
        borderRight: "1px solid var(--line)",
        background: "var(--panel-2)",
        display: "flex",
        flexDirection: "column",
        transition: "width .18s ease",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          height: 48,
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--line)"
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            background: "var(--ink)",
            color: "var(--bg)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 11,
            flex: "none"
          }}
        >
          S
        </div>
        {!collapsed && (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>SaberX</div>
            <div
              style={{
                fontSize: 10.5,
                color: "var(--ink-3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em"
              }}
            >
              Engineering Docs
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div style={{ padding: "10px 10px 4px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--panel)"
            }}
          >
            <Icon name="package" size={12} style={{ color: "var(--sx-accent)" }} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.15,
                minWidth: 0,
                flex: 1
              }}
            >
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Program</div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {programName}
              </div>
            </div>
          </div>
        </div>
      )}

      <nav
        style={{
          flex: 1,
          padding: "8px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflowY: "auto"
        }}
      >
        {!collapsed && <SectionLabel label="Workspace" />}
        {NAV.filter((n) => n.group === "main").map((n) => (
          <NavLink key={n.href} item={n} active={isActive(n)} collapsed={collapsed} />
        ))}
        {!collapsed && <SectionLabel label="Tools" pad />}
        {collapsed && <div style={{ height: 1, background: "var(--line)", margin: "8px 6px" }} />}
        {NAV.filter((n) => n.group === "tools").map((n) => (
          <NavLink
            key={n.href}
            item={n.href === "/dashboard/integrity" && integrityCount > 0 ? { ...n, badge: integrityCount } : n}
            active={isActive(n)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div
        style={{
          borderTop: "1px solid var(--line)",
          padding: 10,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}
      >
        <Avatar name={user.name} size={26} />
        {!collapsed && (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.15,
                minWidth: 0,
                flex: 1
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {user.name}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{user.role}</div>
            </div>
            <button
              className="sx-btn sx-btn-ghost sx-btn-sm"
              style={{ padding: 4 }}
              title="Sign out"
              type="button"
              onClick={handleLogout}
            >
              <Icon name="lock" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({ label, pad }: { label: string; pad?: boolean }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: "var(--ink-4)",
        textTransform: "uppercase",
        padding: pad ? "16px 8px 4px" : "8px 8px 4px"
      }}
    >
      {label}
    </div>
  );
}

function NavLink({
  item,
  active,
  collapsed
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "7px 8px" : item.indent ? "6px 8px 6px 22px" : "6px 8px",
        borderRadius: 6,
        background: active ? "var(--bg-3)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-2)",
        textDecoration: "none",
        fontSize: 12.5,
        fontWeight: active ? 500 : 400,
        position: "relative",
        justifyContent: collapsed ? "center" : "flex-start"
      }}
    >
      <Icon
        name={item.icon}
        size={12}
        style={{ color: active ? "var(--ink)" : "var(--ink-3)", flex: "none" }}
      />
      {!collapsed && (
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {item.label}
        </span>
      )}
      {!collapsed && item.hint && (
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>
          {item.hint}
        </span>
      )}
      {!collapsed && item.badge != null && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 6px",
            borderRadius: 999,
            background: "var(--red-soft)",
            color: "var(--red)"
          }}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
