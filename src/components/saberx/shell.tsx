"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { accentVars, useTweaks } from "./theme-provider";
import { ToastProvider } from "./toast";

const ROUTE_LABELS: Record<string, string> = {
  "": "Documents",
  documents: "Documents",
  schema: "Schema",
  trace: "Trace links",
  snapshots: "Snapshots",
  audit: "Audit log",
  integrity: "Integrity",
  search: "Search",
  admin: "Administration"
};

function buildBreadcrumbs(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return ["Documents"];
  const tail = parts.slice(1);
  const crumbs: string[] = [];
  for (const seg of tail) {
    if (ROUTE_LABELS[seg]) crumbs.push(ROUTE_LABELS[seg]);
    else if (seg.length > 14) crumbs.push(seg.slice(0, 8) + "…");
    else crumbs.push(seg);
  }
  return crumbs;
}

export function Shell({
  children,
  user,
  integrityCount,
  documents,
  tutorialSeen
}: {
  children: ReactNode;
  user: { name: string; role: string };
  integrityCount: number;
  documents: { id: string; title: string }[];
  tutorialSeen: boolean;
}) {
  const { tweaks } = useTweaks();
  const dark = tweaks.theme === "dark";
  const accent = accentVars(tweaks.accent, dark);
  const pathname = usePathname() ?? "/dashboard";
  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.body.style.background;
    document.body.style.background = dark ? "#0e0e0d" : "#fbfbfa";
    return () => {
      document.body.style.background = previous;
    };
  }, [dark]);

  return (
    <div
      className="sx-shell"
      data-theme={tweaks.theme}
      data-density={tweaks.density}
      style={{
        ...accent,
        display: "flex",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--bg)"
      }}
    >
      <ToastProvider>
        <Sidebar user={user} integrityCount={integrityCount} documents={documents} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden"
          }}
        >
          <Topbar
            breadcrumbs={breadcrumbs}
            firstDocumentId={documents[0]?.id}
            tutorialSeen={tutorialSeen}
          />
          <div
            style={{
              flex: 1,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              minHeight: 0
            }}
          >
            {children}
          </div>
        </div>
      </ToastProvider>
    </div>
  );
}
