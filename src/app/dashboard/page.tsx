import Link from "next/link";
import { PageHeader } from "@/components/saberx/page-header";
import { getWorkspaceData, listIntegrityIssues } from "@/services/repository";
import { requireUser } from "@/services/auth";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<string, string> = {
  draft: "pill",
  baselined: "pill pill-green",
  under_review: "pill pill-amber",
  superseded: "pill",
  seed: "pill"
};

const TYPE_PILL: Record<string, string> = {
  CONOPS: "pill pill-violet",
  ICD: "pill pill-accent",
  RTM: "pill pill-green"
};

function formatStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(date: Date | string | null) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default async function RepositoryPage() {
  await requireUser();
  const [data, issues] = await Promise.all([
    getWorkspaceData(),
    listIntegrityIssues().catch(() => [])
  ]);

  const docs = data.documents;
  const totalDocs = docs.length;
  const baselined = docs.filter((d) => d.baselineState === "baselined").length;
  const underReview = docs.filter((d) => d.status === "under_review").length;
  const totalIssues = issues.length;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Documents"
        subtitle="Engineering workbooks across the program — CONOPS, ICDs, RTMs, and supporting artefacts."
        meta={
          <>
            <span><strong style={{ color: "var(--ink)" }}>{totalDocs}</strong> documents</span>
            <span><strong style={{ color: "var(--ink)" }}>{baselined}</strong> baselined</span>
            <span><strong style={{ color: "var(--ink)" }}>{underReview}</strong> under review</span>
            <span><strong style={{ color: "var(--ink)" }}>{totalIssues}</strong> open integrity issues</span>
          </>
        }
      />

      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          data-tour="documents-table"
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--sx-radius-lg)",
            background: "var(--panel)",
            overflow: "hidden",
            boxShadow: "var(--sx-shadow-sm)"
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--panel-2)" }}>
                <Th>Code</Th>
                <Th>Title</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Baseline</Th>
                <Th>Sheets</Th>
                <Th>Issues</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>
                    No documents yet. Use <strong>Import</strong> or <strong>New document</strong> in the top bar to begin.
                  </td>
                </tr>
              )}
              {docs.map((d) => {
                const code = (d.templateType || "DOC").toUpperCase();
                const type = (d.templateType || "").toUpperCase();
                return (
                  <tr key={d.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <Td>
                      <Link
                        href={`/dashboard/documents/${d.id}`}
                        className="mono"
                        style={{
                          color: "var(--accent-ink)",
                          textDecoration: "none",
                          fontSize: 12
                        }}
                      >
                        {code}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/dashboard/documents/${d.id}`}
                        style={{
                          color: "var(--ink)",
                          fontWeight: 500,
                          textDecoration: "none"
                        }}
                      >
                        {d.title}
                      </Link>
                    </Td>
                    <Td>
                      <span className={TYPE_PILL[type] ?? "pill"}>{type || "DOC"}</span>
                    </Td>
                    <Td>
                      <span className={STATUS_PILL[d.status] ?? "pill"}>{formatStatus(d.status)}</span>
                    </Td>
                    <Td>
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                        {d.baselineState}
                      </span>
                    </Td>
                    <Td muted>{d.sheets.length}</Td>
                    <Td>
                      {d.integrityIssueCount > 0 ? (
                        <span className="pill pill-red">{d.integrityIssueCount}</span>
                      ) : (
                        <span style={{ color: "var(--ink-4)" }}>—</span>
                      )}
                    </Td>
                    <Td muted>{formatTimestamp(d.updatedAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 14px",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--ink-3)",
        borderBottom: "1px solid var(--line)"
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      style={{
        padding: "10px 14px",
        fontSize: 12.5,
        color: muted ? "var(--ink-3)" : "var(--ink-2)",
        verticalAlign: "middle"
      }}
    >
      {children}
    </td>
  );
}
