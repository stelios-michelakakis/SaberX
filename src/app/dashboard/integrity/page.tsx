import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, integrityIssues, sheets } from "@/db/schema";
import { Icon } from "@/components/saberx/icon";
import { PageHeader } from "@/components/saberx/page-header";
import { requireUser } from "@/services/auth";
import { listIntegrityIssues } from "@/services/repository";

export const dynamic = "force-dynamic";

const SEVERITY_PILL: Record<string, string> = {
  error: "pill pill-red",
  warning: "pill pill-amber",
  info: "pill"
};

export default async function IntegrityPage() {
  await requireUser();
  const issues = await listIntegrityIssues();

  const docIds = Array.from(new Set(issues.map((i) => i.documentId).filter(Boolean))) as string[];
  const sheetIds = Array.from(new Set(issues.map((i) => i.sheetId).filter(Boolean))) as string[];

  const [docs, sheetRows] = await Promise.all([
    docIds.length
      ? db
          .select({ id: documents.id, title: documents.title })
          .from(documents)
          .where(sql`${documents.id} IN (${sql.join(docIds.map((id) => sql`${id}`), sql`, `)})`)
      : Promise.resolve([] as { id: string; title: string }[]),
    sheetIds.length
      ? db
          .select({ id: sheets.id, name: sheets.name })
          .from(sheets)
          .where(sql`${sheets.id} IN (${sql.join(sheetIds.map((id) => sql`${id}`), sql`, `)})`)
      : Promise.resolve([] as { id: string; name: string }[])
  ]);

  const docMap = new Map(docs.map((d) => [d.id, d]));
  const sheetMap = new Map(sheetRows.map((s) => [s.id, s]));

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  return (
    <>
      <PageHeader
        eyebrow="Integrity"
        title="Open issues"
        subtitle="Schema, reference, and validation problems detected during edits and integrity checks."
        meta={
          <>
            <span><strong style={{ color: "var(--red)" }}>{errors}</strong> errors</span>
            <span><strong style={{ color: "var(--sx-amber)" }}>{warnings}</strong> warnings</span>
            <span><strong style={{ color: "var(--ink)" }}>{infos}</strong> info</span>
          </>
        }
      />

      <div style={{ padding: "20px 28px" }}>
        <div
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
                <Th>Severity</Th>
                <Th>Issue</Th>
                <Th>Document</Th>
                <Th>Sheet</Th>
                <Th>Row</Th>
                <Th>Opened</Th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}
                  >
                    <Icon name="shield" size={16} style={{ color: "var(--green)" }} />
                    <div style={{ marginTop: 8 }}>No open integrity issues. The repository is clean.</div>
                  </td>
                </tr>
              )}
              {issues.map((issue) => {
                const doc = issue.documentId ? docMap.get(issue.documentId) : null;
                const sheet = issue.sheetId ? sheetMap.get(issue.sheetId) : null;
                return (
                  <tr key={issue.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <Td>
                      <span className={SEVERITY_PILL[issue.severity] ?? "pill"}>
                        {issue.severity}
                      </span>
                    </Td>
                    <Td>{issue.message}</Td>
                    <Td>
                      {doc ? (
                        <Link
                          href={`/dashboard/documents/${doc.id}`}
                          style={{ color: "var(--ink-2)", textDecoration: "none" }}
                        >
                          {doc.title}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--ink-4)" }}>—</span>
                      )}
                    </Td>
                    <Td muted>{sheet?.name ?? "—"}</Td>
                    <Td>
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                        {issue.rowId ? issue.rowId.slice(0, 8) : "—"}
                      </span>
                    </Td>
                    <Td muted>{new Date(issue.createdAt).toLocaleDateString()}</Td>
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
