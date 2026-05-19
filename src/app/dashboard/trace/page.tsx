import { alias } from "drizzle-orm/pg-core";
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

  const targetRows = alias(rows, "target_rows");
  const sourceSheets = alias(sheets, "source_sheets");
  const targetSheets = alias(sheets, "target_sheets");
  const sourceDocs = alias(documents, "source_documents");
  const targetDocs = alias(documents, "target_documents");

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
    .innerJoin(sourceSheets, eq(sourceSheets.id, rows.sheetId))
    .innerJoin(sourceDocs, eq(sourceDocs.id, sourceSheets.documentId))
    .innerJoin(targetRows, eq(targetRows.id, cellValueLinks.targetRowId))
    .innerJoin(targetSheets, eq(targetSheets.id, targetRows.sheetId))
    .innerJoin(targetDocs, eq(targetDocs.id, targetSheets.documentId))
    .where(
      and(
        isNull(rows.deletedAt),
        isNull(sourceSheets.deletedAt),
        isNull(sourceDocs.deletedAt),
        isNull(targetRows.deletedAt),
        isNull(targetSheets.deletedAt),
        isNull(targetDocs.deletedAt)
      )
    )
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
    new Set(
      linkRows
        .flatMap((l) => [l.sourceRowId, l.targetRowId])
        .filter((id): id is string => Boolean(id))
    )
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
        .where(
          and(
            inArray(rows.id, allRowIds),
            isNull(rows.deletedAt),
            isNull(sheets.deletedAt),
            isNull(documents.deletedAt)
          )
        )
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
        .where(
          and(
            inArray(sheets.id, sheetIds),
            isNull(sheets.deletedAt),
            isNull(documents.deletedAt)
          )
        )
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
    .innerJoin(sheets, eq(sheets.id, rows.sheetId))
    .innerJoin(documents, eq(documents.id, sheets.documentId))
    .leftJoin(cellValueLinks, eq(cellValueLinks.sourceRowId, rows.id))
    .where(
      and(
        isNull(rows.deletedAt),
        isNull(sheets.deletedAt),
        isNull(documents.deletedAt),
        isNull(cellValueLinks.sourceRowId)
      )
    );

  // Resolve a display value per link. Priority:
  //   1. The per-binding displayFieldId chosen on the source field.
  //   2. A sensible default per sheet — first non-ID short/long-text field.
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
  const bindingDisplayBySourceAndTargetSheet = new Map<string, string>();
  for (const b of bindingRows) {
    if (b.allowedSheetId && b.displayFieldId) {
      bindingDisplayBySourceAndTargetSheet.set(
        `${b.fieldId}|${b.allowedSheetId}`,
        b.displayFieldId
      );
    }
  }
  const rowSheetById = new Map<string, string>();
  for (const r of rowRows) rowSheetById.set(r.id, r.sheetId);

  const involvedSheetIds = Array.from(new Set(rowRows.map((r) => r.sheetId)));
  const candidateFields = involvedSheetIds.length
    ? await db
        .select({
          id: fields.id,
          sheetId: fields.sheetId,
          isIdField: fields.isIdField,
          type: fields.type,
          archived: fields.archived,
          displayOrder: fields.displayOrder
        })
        .from(fields)
        .where(inArray(fields.sheetId, involvedSheetIds))
    : [];
  const defaultDisplayBySheet = new Map<string, string>();
  for (const sheetId of involvedSheetIds) {
    const candidate = candidateFields
      .filter(
        (f) =>
          f.sheetId === sheetId &&
          !f.isIdField &&
          !f.archived &&
          (f.type === "short_text" || f.type === "long_text" || f.type === "rich_note")
      )
      .sort((a, b) => a.displayOrder - b.displayOrder)[0];
    if (candidate) defaultDisplayBySheet.set(sheetId, candidate.id);
  }

  const resolveDisplayFieldId = (rowId: string, sourceFieldId: string | null): string | null => {
    const sheetId = rowSheetById.get(rowId);
    if (!sheetId) return null;
    if (sourceFieldId) {
      const perBinding = bindingDisplayBySourceAndTargetSheet.get(`${sourceFieldId}|${sheetId}`);
      if (perBinding) return perBinding;
    }
    return defaultDisplayBySheet.get(sheetId) ?? null;
  };

  const neededScalar = new Set<string>();
  for (const l of linkRows) {
    const tgtDf = l.targetRowId ? resolveDisplayFieldId(l.targetRowId, l.sourceFieldId) : null;
    if (tgtDf && l.targetRowId) neededScalar.add(`${l.targetRowId}|${tgtDf}`);
    const srcDf = resolveDisplayFieldId(l.sourceRowId, null);
    if (srcDf) neededScalar.add(`${l.sourceRowId}|${srcDf}`);
  }
  const scalarLookup = new Map<string, string>();
  if (neededScalar.size) {
    const rowIdsNeeded = Array.from(
      new Set(Array.from(neededScalar).map((k) => k.split("|")[0]))
    );
    const fieldIdsNeeded = Array.from(
      new Set(Array.from(neededScalar).map((k) => k.split("|")[1]))
    );
    const scalarRows = await db
      .select({
        rowId: cellValuesScalar.rowId,
        fieldId: cellValuesScalar.fieldId,
        displayText: cellValuesScalar.displayText
      })
      .from(cellValuesScalar)
      .where(
        and(
          inArray(cellValuesScalar.rowId, rowIdsNeeded),
          inArray(cellValuesScalar.fieldId, fieldIdsNeeded)
        )
      );
    for (const s of scalarRows) scalarLookup.set(`${s.rowId}|${s.fieldId}`, s.displayText);
  }

  // Resolve labels for the chosen display fields, so the table can show
  // "Field name: value" rather than just the bare value.
  const displayFieldIdsUsed = new Set<string>();
  for (const f of candidateFields) {
    if (defaultDisplayBySheet.get(f.sheetId) === f.id) displayFieldIdsUsed.add(f.id);
  }
  for (const fieldId of bindingDisplayBySourceAndTargetSheet.values()) {
    displayFieldIdsUsed.add(fieldId);
  }
  const displayFieldLabelById = new Map<string, string>();
  if (displayFieldIdsUsed.size > 0) {
    const labelRows = await db
      .select({ id: fields.id, label: fields.label })
      .from(fields)
      .where(inArray(fields.id, Array.from(displayFieldIdsUsed)));
    for (const r of labelRows) displayFieldLabelById.set(r.id, r.label);
  }

  const resolveDisplay = (
    rowId: string,
    sourceFieldId: string | null
  ): { value: string | null; fieldLabel: string | null } => {
    const df = resolveDisplayFieldId(rowId, sourceFieldId);
    if (!df) return { value: null, fieldLabel: null };
    const dv = scalarLookup.get(`${rowId}|${df}`);
    return {
      value: dv && dv.trim().length > 0 ? dv : null,
      fieldLabel: displayFieldLabelById.get(df) ?? null
    };
  };

  // Trace view shows row-to-row links only; cell-level source attachments are
  // surfaced on the document grid as chips and on the Sources page.
  const traceLinks: TraceLink[] = linkRows
    .filter((l): l is typeof l & { targetRowId: string } => Boolean(l.targetRowId))
    .map((l) => {
      const src = resolveDisplay(l.sourceRowId, null);
      const tgt = resolveDisplay(l.targetRowId, l.sourceFieldId);
      return {
        sourceRowId: l.sourceRowId,
        sourceFieldId: l.sourceFieldId,
        targetRowId: l.targetRowId,
        sourceDisplay: src.value,
        sourceDisplayField: src.fieldLabel,
        targetDisplay: tgt.value,
        targetDisplayField: tgt.fieldLabel
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
