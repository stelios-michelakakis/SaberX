"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  { href: "/dashboard/sources", label: "Sources", icon: "folder", group: "main" },
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
  sources?: { id: string; title: string }[];
};

export function Sidebar({ user, integrityCount = 0, documents = [], sources = [] }: Props) {
  const { tweaks } = useTweaks();
  const collapsed = tweaks.sidebarCollapsed;
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const W = collapsed ? 56 : 240;
  const [documentsOpen, setDocumentsOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(true);

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
    if (item.href === "/dashboard/sources") return pathname === "/dashboard/sources";
    if (item.matchPrefix) return pathname.startsWith(item.href);
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <aside
      data-tour="sidebar"
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
        {NAV.filter((n) => n.group === "main").map((n) => {
          if (n.href === "/dashboard") {
            return (
              <div key={n.href} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <ExpandableNavRow
                  tour="nav-documents"
                  item={n}
                  active={isActive(n)}
                  collapsed={collapsed}
                  open={documentsOpen}
                  onToggle={() => setDocumentsOpen((v) => !v)}
                  onAdd={handleNewDocument}
                  addLabel="New document"
                />
                {!collapsed && documentsOpen && documents.length > 0 && (
                  <ChildList
                    items={documents}
                    pathname={pathname}
                    hrefBase="/dashboard/documents"
                    iconName="doc"
                    collapsed={collapsed}
                  />
                )}
              </div>
            );
          }
          if (n.href === "/dashboard/sources") {
            return (
              <div key={n.href} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <ExpandableNavRow
                  tour="nav-sources"
                  item={n}
                  active={isActive(n)}
                  collapsed={collapsed}
                  open={sourcesOpen}
                  onToggle={() => setSourcesOpen((v) => !v)}
                  onAdd={() => router.push("/dashboard/sources?upload=1")}
                  addLabel="Upload source"
                />
                {!collapsed && sourcesOpen && sources.length > 0 && (
                  <ChildList
                    items={sources}
                    pathname={pathname}
                    hrefBase="/dashboard/sources"
                    iconName="doc"
                    collapsed={collapsed}
                  />
                )}
              </div>
            );
          }
          return <NavLink key={n.href} item={n} active={isActive(n)} collapsed={collapsed} />;
        })}
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

function ExpandableNavRow({
  item,
  active,
  collapsed,
  open,
  onToggle,
  onAdd,
  addLabel,
  tour
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
  addLabel: string;
  tour: string;
}) {
  return (
    <div
      data-tour={tour}
      style={{ display: "flex", alignItems: "center", gap: 4 }}
    >
      {!collapsed && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
          aria-expanded={open}
          className="sx-btn sx-btn-ghost sx-btn-sm"
          style={{
            padding: 2,
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none"
          }}
        >
          <Icon name={open ? "chevronD" : "chevronR"} size={12} />
        </button>
      )}
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
          background: active ? "var(--accent-soft)" : "transparent",
          color: active ? "var(--ink)" : "var(--ink-2)",
          textDecoration: "none",
          fontSize: 12.5,
          fontWeight: active ? 500 : 400,
          justifyContent: collapsed ? "center" : "flex-start"
        }}
      >
        {collapsed && (
          <Icon
            name={item.icon}
            size={12}
            style={{ color: active ? "var(--ink)" : "var(--ink-3)", flex: "none" }}
          />
        )}
        {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
      </Link>
      {!collapsed && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          title={addLabel}
          className="sx-btn sx-btn-ghost sx-btn-sm"
          style={{ padding: 4 }}
        >
          <Icon name="plus" size={12} />
        </button>
      )}
    </div>
  );
}

function ChildList({
  items,
  pathname,
  hrefBase,
  iconName,
  collapsed
}: {
  items: { id: string; title: string }[];
  pathname: string;
  hrefBase: string;
  iconName: string;
  collapsed: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((d) => {
        const href = `${hrefBase}/${d.id}`;
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
              padding: "5px 8px 5px 32px",
              borderRadius: 6,
              background: active ? "var(--accent-soft)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink-2)",
              textDecoration: "none",
              fontSize: 12.5,
              fontWeight: active ? 500 : 400
            }}
          >
            <Icon
              name={iconName}
              size={12}
              style={{ color: active ? "var(--ink)" : "var(--ink-4)", flex: "none" }}
            />
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {d.title || "Untitled"}
            </span>
          </Link>
        );
      })}
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
        background: active ? "var(--accent-soft)" : "transparent",
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
