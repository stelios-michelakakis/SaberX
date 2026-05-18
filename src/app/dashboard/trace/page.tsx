import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cellValueLinks,
  cellValuesScalar,
  documents,
  fields,
  referenceBindings,
  rows,
  sheets
} from "@/db/schema";
import { PageHeader, Empty } from "@/components/saberx/page-header";
import { requireUser } from "@/services/auth";
import { TraceClient, type TraceLink, type TraceRow, type TraceSheet } from "./trace-client";

export const dynamic = "force-dynamic";

export default async function TracePage({
  searchParams
}: {
  searchParams: Promise<{ document?: string }>;
}) {
  await requireUser();
  const { document: docFilter } = await searchParams;

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
    .limit(2000);

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

  const allRowIds = Array.from(
    new Set(linkRows.flatMap((l) => [l.sourceRowId, l.targetRowId]))
  );
  const rowRows = allRowIds.length
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
        .where(sql`${rows.id} IN (${sql.join(allRowIds.map((id) => sql`${id}`), sql`, `)})`)
    : [];

  const sheetIds = Array.from(new Set(rowRows.map((r) => r.sheetId)));
  const sheetRows = sheetIds.length
    ? await db
        .select({
          id: sheets.id,
          name: sheets.name,
          sheetKind: sheets.sheetKind,
          documentId: sheets.documentId,
          documentTitle: documents.title
        })
        .from(sheets)
        .innerJoin(documents, eq(documents.id, sheets.documentId))
        .where(sql`${sheets.id} IN (${sql.join(sheetIds.map((id) => sql`${id}`), sql`, `)})`)
    : [];

  const fieldIds = Array.from(new Set(linkRows.map((l) => l.sourceFieldId)));
  const fieldRows = fieldIds.length
    ? await db
        .select({ id: fields.id, label: fields.label })
        .from(fields)
        .where(sql`${fields.id} IN (${sql.join(fieldIds.map((id) => sql`${id}`), sql`, `)})`)
    : [];

  const [{ orphans }] = await db
    .select({ orphans: count() })
    .from(rows)
    .leftJoin(cellValueLinks, eq(cellValueLinks.sourceRowId, rows.id))
    .where(and(isNull(rows.deletedAt), isNull(cellValueLinks.sourceRowId)));

  // Resolve a display value per link based on the source field's binding.
  const sourceFieldIds = Array.from(new Set(linkRows.map((l) => l.sourceFieldId)));
  const bindingRows = sourceFieldIds.length
    ? await db
        .select({
          fieldId: referenceBindings.fieldId,
          allowedSheetId: referenceBindings.allowedSheetId,
          displayFieldId: referenceBindings.displayFieldId
        })
        .from(referenceBindings)
        .where(inArray(referenceBindings.fieldId, sourceFieldIds))
    : [];
  const displayBySourceAndTargetSheet = new Map<string, string>();
  for (const b of bindingRows) {
    if (b.allowedSheetId && b.displayFieldId) {
      displayBySourceAndTargetSheet.set(`${b.fieldId}|${b.allowedSheetId}`, b.displayFieldId);
    }
  }
  const targetRowSheetById = new Map<string, string>();
  for (const r of rowRows) targetRowSheetById.set(r.id, r.sheetId);

  const neededScalar = new Set<string>();
  for (const l of linkRows) {
    const targetSheet = targetRowSheetById.get(l.targetRowId);
    if (!targetSheet) continue;
    const df = displayBySourceAndTargetSheet.get(`${l.sourceFieldId}|${targetSheet}`);
    if (df) neededScalar.add(`${l.targetRowId}|${df}`);
  }
  const scalarLookup = new Map<string, string>();
  if (neededScalar.size) {
    const rowIdsNeeded = Array.from(new Set(Array.from(neededScalar).map((k) => k.split("|")[0])));
    const fieldIdsNeeded = Array.from(new Set(Array.from(neededScalar).map((k) => k.split("|")[1])));
    const scalarRows = await db
      .select({
        rowId: cellValuesScalar.rowId,
        fieldId: cellValuesScalar.fieldId,
        displayText: cellValuesScalar.displayText
      })
      .from(cellValuesScalar)
      .where(and(inArray(cellValuesScalar.rowId, rowIdsNeeded), inArray(cellValuesScalar.fieldId, fieldIdsNeeded)));
    for (const s of scalarRows) scalarLookup.set(`${s.rowId}|${s.fieldId}`, s.displayText);
  }

  const traceLinks: TraceLink[] = linkRows.map((l) => {
    const targetSheet = targetRowSheetById.get(l.targetRowId);
    const df = targetSheet ? displayBySourceAndTargetSheet.get(`${l.sourceFieldId}|${targetSheet}`) : null;
    const dv = df ? scalarLookup.get(`${l.targetRowId}|${df}`) : null;
    return {
      sourceRowId: l.sourceRowId,
      sourceFieldId: l.sourceFieldId,
      targetRowId: l.targetRowId,
      targetDisplay: dv && dv.trim().length > 0 ? dv : null
    };
  });
  const traceRows: TraceRow[] = rowRows.map((r) => ({
    id: r.id,
    visibleId: r.visibleId,
    sheetId: r.sheetId,
    sheetName: r.sheetName,
    documentId: r.documentId,
    documentTitle: r.documentTitle
  }));
  const traceSheets: TraceSheet[] = sheetRows.map((s) => ({
    id: s.id,
    name: s.name,
    sheetKind: s.sheetKind,
    documentId: s.documentId,
    documentTitle: s.documentTitle
  }));

  const docIds = Array.from(new Set(rowRows.map((r) => r.documentId)));
  const docs = docIds
    .map((id) => {
      const r = rowRows.find((rr) => rr.documentId === id);
      return r ? { id: r.documentId, title: r.documentTitle } : null;
    })
    .filter((d): d is { id: string; title: string } => d !== null);

  const totalLinks = linkRows.length;
  const totalSources = new Set(linkRows.map((l) => l.sourceRowId)).size;
  const docCount = docs.length;

  return (
    <>
      <PageHeader
        eyebrow="Trace links"
        title="Trace coverage"
        subtitle="Cross-document references — edit reference cells in any sheet to keep this graph current."
        meta={
          <>
            <span>
              <strong style={{ color: "var(--ink)" }}>{totalLinks}</strong>{" "}
              {totalLinks === 1 ? "link" : "links"}
            </span>
            <span>
              <strong style={{ color: "var(--ink)" }}>{totalSources}</strong>{" "}
              {totalSources === 1 ? "source row" : "source rows"}
            </span>
            <span>
              <strong style={{ color: "var(--ink)" }}>{docCount}</strong>{" "}
              {docCount === 1 ? "document involved" : "documents involved"}
            </span>
            <span>
              <strong style={{ color: "var(--ink)" }}>{Number(orphans)}</strong>{" "}
              {Number(orphans) === 1
                ? "row without outgoing links"
                : "rows without outgoing links"}
            </span>
          </>
        }
      />
      <TraceClient
        links={traceLinks}
        rows={traceRows}
        sheets={traceSheets}
        fields={fieldRows.map((f) => ({ id: f.id, label: f.label }))}
        documents={docs}
        initialDocumentId={docFilter ?? ""}
      />
    </>
  );
}
