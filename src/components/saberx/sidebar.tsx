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
  { href: "/dashboard/search", label: "Search", icon: "search", group: "tools" },
  { href: "/dashboard/audit", label: "Audit log", icon: "audit", group: "tools" },
  { href: "/dashboard/integrity", label: "Integrity", icon: "shield", group: "tools" },
  { href: "/dashboard/snapshots", label: "Snapshots", icon: "history", group: "tools" },
  { href: "/dashboard/admin", label: "Admin", icon: "users", group: "tools" },
  { href: "/dashboard/profile", label: "Profile", icon: "user", group: "tools" }
];

type Props = {
  user: { name: string; role: string };
  programName?: string;
  integrityCount?: number;
  documents?: { id: string; title: string }[];
};

export function Sidebar({ user, integrityCount = 0, documents = [] }: Props) {
  const { tweaks } = useTweaks();
  const collapsed = tweaks.sidebarCollapsed;
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const W = collapsed ? 56 : 240;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const handleNewDocument = async () => {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled document" })
    });
    if (!res.ok) return;
    const data: { document: { id: string } } = await res.json();
    router.push(`/dashboard/documents/${data.document.id}?renameTitle=1`);
    router.refresh();
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
          borderBottom: "1px solid var(--line)",
          justifyContent: collapsed ? "center" : "flex-start"
        }}
      >
        {!collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "var(--ink)"
              }}
            >
              EDF SABER
            </div>
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
        ) : (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "var(--ink-2)",
              fontFamily: "var(--font-mono)"
            }}
            title="EDF SABER"
          >
            EDF
          </div>
        )}
      </div>

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
        {NAV.filter((n) => n.group === "main").map((n) =>
          n.href === "/dashboard" ? (
            <DocumentsRow
              key={n.href}
              item={n}
              active={isActive(n)}
              collapsed={collapsed}
              onAdd={handleNewDocument}
            />
          ) : (
            <NavLink key={n.href} item={n} active={isActive(n)} collapsed={collapsed} />
          )
        )}
        {documents.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {documents.map((d) => {
              const href = `/dashboard/documents/${d.id}`;
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={d.id}
                  href={href}
                  title={collapsed ? d.title : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: collapsed ? "6px 8px" : "5px 8px 5px 22px",
                    borderRadius: 6,
                    background: active ? "var(--bg-3)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-2)",
                    textDecoration: "none",
                    fontSize: 12.5,
                    fontWeight: active ? 500 : 400,
                    justifyContent: collapsed ? "center" : "flex-start"
                  }}
                >
                  <Icon
                    name="doc"
                    size={12}
                    style={{ color: active ? "var(--ink)" : "var(--ink-4)", flex: "none" }}
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
                      {d.title || "Untitled document"}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
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
              <Icon name="logout" />
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

function DocumentsRow({
  item,
  active,
  collapsed,
  onAdd
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onAdd: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: collapsed ? 0 : "0 0 0 0"
      }}
    >
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: collapsed ? "7px 8px" : "6px 8px",
          borderRadius: 6,
          background: active ? "var(--bg-3)" : "transparent",
          color: active ? "var(--ink)" : "var(--ink-2)",
          textDecoration: "none",
          fontSize: 12.5,
          fontWeight: active ? 500 : 400,
          justifyContent: collapsed ? "center" : "flex-start"
        }}
      >
        <Icon
          name={item.icon}
          size={12}
          style={{ color: active ? "var(--ink)" : "var(--ink-3)", flex: "none" }}
        />
        {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
      </Link>
      {!collapsed && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="New document"
          title="New document"
          className="sx-btn sx-btn-ghost sx-btn-sm"
          style={{ padding: 4 }}
        >
          <Icon name="plus" size={12} />
        </button>
      )}
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
