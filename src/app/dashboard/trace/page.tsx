import Link from "next/link";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { cellValueLinks, documents, fields, rows, sheets } from "@/db/schema";
import { Icon } from "@/components/saberx/icon";
import { PageHeader, Empty } from "@/components/saberx/page-header";
import { requireUser } from "@/services/auth";

export const dynamic = "force-dynamic";

export default async function TracePage() {
  await requireUser();

  const linkRows = await db
    .select({
      sourceRowId: cellValueLinks.sourceRowId,
      sourceFieldId: cellValueLinks.sourceFieldId,
      targetRowId: cellValueLinks.targetRowId,
      sourceVisibleId: rows.visibleId,
      sourceSheetId: rows.sheetId
    })
    .from(cellValueLinks)
    .innerJoin(rows, eq(rows.id, cellValueLinks.sourceRowId))
    .where(isNull(rows.deletedAt))
    .limit(500);

  if (linkRows.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Trace links"
          title="Trace coverage"
          subtitle="Cross-document references between rows. Edit reference cells in any sheet to seed this graph."
        />
        <div style={{ padding: "40px 28px" }}>
          <Empty
            title="No trace links yet"
            hint="Create a single_reference or multi_reference field in a sheet, then link rows from the document grid."
          />
        </div>
      </>
    );
  }

  const targetIds = Array.from(new Set(linkRows.map((l) => l.targetRowId)));
  const targetRows = targetIds.length
    ? await db
        .select({
          id: rows.id,
          visibleId: rows.visibleId,
          sheetId: rows.sheetId,
          sheetName: sheets.name,
          documentId: sheets.documentId,
          documentTitle: documents.title
        })
        .from(rows)
        .innerJoin(sheets, eq(sheets.id, rows.sheetId))
        .innerJoin(documents, eq(documents.id, sheets.documentId))
        .where(sql`${rows.id} IN (${sql.join(targetIds.map((id) => sql`${id}`), sql`, `)})`)
    : [];
  const targetMap = new Map(targetRows.map((r) => [r.id, r]));

  const sourceSheetIds = Array.from(new Set(linkRows.map((l) => l.sourceSheetId)));
  const sourceSheets = sourceSheetIds.length
    ? await db
        .select({
          id: sheets.id,
          name: sheets.name,
          documentId: sheets.documentId,
          documentTitle: documents.title
        })
        .from(sheets)
        .innerJoin(documents, eq(documents.id, sheets.documentId))
        .where(sql`${sheets.id} IN (${sql.join(sourceSheetIds.map((id) => sql`${id}`), sql`, `)})`)
    : [];
  const sourceSheetMap = new Map(sourceSheets.map((s) => [s.id, s]));

  const fieldIds = Array.from(new Set(linkRows.map((l) => l.sourceFieldId)));
  const fieldRows = fieldIds.length
    ? await db
        .select({ id: fields.id, label: fields.label })
        .from(fields)
        .where(sql`${fields.id} IN (${sql.join(fieldIds.map((id) => sql`${id}`), sql`, `)})`)
    : [];
  const fieldMap = new Map(fieldRows.map((f) => [f.id, f]));

  const grouped = new Map<string, typeof linkRows>();
  for (const link of linkRows) {
    const list = grouped.get(link.sourceRowId) ?? [];
    list.push(link);
    grouped.set(link.sourceRowId, list);
  }

  const totalLinks = linkRows.length;
  const totalSources = grouped.size;
  const docCount = new Set(
    [...sourceSheetMap.values()].map((s) => s.documentId).concat(targetRows.map((r) => r.documentId))
  ).size;

  const [{ orphans }] = await db
    .select({ orphans: count() })
    .from(rows)
    .leftJoin(cellValueLinks, eq(cellValueLinks.sourceRowId, rows.id))
    .where(and(isNull(rows.deletedAt), isNull(cellValueLinks.sourceRowId)));

  return (
    <>
      <PageHeader
        eyebrow="Trace links"
        title="Trace coverage"
        subtitle="Cross-document references — edit reference cells in any sheet to keep this graph current."
        meta={
          <>
            <span><strong style={{ color: "var(--ink)" }}>{totalLinks}</strong> links</span>
            <span><strong style={{ color: "var(--ink)" }}>{totalSources}</strong> source rows</span>
            <span><strong style={{ color: "var(--ink)" }}>{docCount}</strong> documents involved</span>
            <span><strong style={{ color: "var(--ink)" }}>{Number(orphans)}</strong> rows without outgoing links</span>
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
                <Th>Source</Th>
                <Th>From sheet</Th>
                <Th>Field</Th>
                <Th>→</Th>
                <Th>Target</Th>
                <Th>To sheet</Th>
              </tr>
            </thead>
            <tbody>
              {linkRows.map((link, i) => {
                const src = sourceSheetMap.get(link.sourceSheetId);
                const tgt = targetMap.get(link.targetRowId);
                const field = fieldMap.get(link.sourceFieldId);
                return (
                  <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                    <Td>
                      <span className="mono" style={{ color: "var(--accent-ink)", fontSize: 11.5 }}>
                        {link.sourceVisibleId || link.sourceRowId.slice(0, 8)}
                      </span>
                    </Td>
                    <Td muted>
                      {src ? (
                        <Link
                          href={`/dashboard/documents/${src.documentId}?sheet=${src.id}`}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          {src.documentTitle} · {src.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td muted>{field?.label ?? "—"}</Td>
                    <Td>
                      <Icon name="arrowR" size={12} style={{ color: "var(--ink-4)" }} />
                    </Td>
                    <Td>
                      {tgt ? (
                        <Link
                          href={`/dashboard/documents/${tgt.documentId}?sheet=${tgt.sheetId}`}
                          className="mono"
                          style={{
                            color: "var(--accent-ink)",
                            textDecoration: "none",
                            fontSize: 11.5
                          }}
                        >
                          {tgt.visibleId || link.targetRowId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="mono" style={{ color: "var(--ink-4)", fontSize: 11.5 }}>
                          missing
                        </span>
                      )}
                    </Td>
                    <Td muted>
                      {tgt ? `${tgt.documentTitle} · ${tgt.sheetName}` : "—"}
                    </Td>
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
