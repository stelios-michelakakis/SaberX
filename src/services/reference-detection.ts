import { and, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  cellValuesScalar,
  documents,
  fields,
  idPolicies,
  rows,
  sheets
} from "@/db/schema";

export type DetectedCandidate = {
  rowId: string;
  visibleId: string;
  sheetId: string;
  sheetName: string;
  documentId: string;
  documentTitle: string;
  display: string | null;
};

export type DetectedToken = {
  token: string;
  // Index range inside the source cell's text. Useful for highlighting.
  start: number;
  end: number;
  candidates: DetectedCandidate[];
};

export type DetectedCell = {
  rowId: string;
  rowVisibleId: string | null;
  rawText: string;
  tokens: DetectedToken[];
};

export type DetectedColumn = {
  sheetId: string;
  sheetName: string;
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  cells: DetectedCell[];
  // Convenience aggregates the UI can use to score the column.
  totalCells: number;
  cellsWithTokens: number;
  totalTokens: number;
  ambiguousTokens: number;
  unresolvedTokens: number;
  // Sheets the resolved tokens point at, ranked by occurrence count. The UI
  // uses this to seed binding suggestions when the user converts the column.
  suggestedTargetSheets: { sheetId: string; sheetName: string; documentId: string; documentTitle: string; hits: number }[];
};

export type DetectionResult = {
  documentId: string;
  columns: DetectedColumn[];
};

const SCANNABLE_TYPES = new Set(["short_text", "long_text", "rich_note"]);

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function detectDocumentReferences(documentId: string): Promise<DetectionResult> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc || doc.deletedAt) throw new Error("Document not found");

  // 1. Build a token regex from every live sheet's id_policy prefix.
  const policies = await db
    .select({ prefix: idPolicies.prefix, zeroPad: idPolicies.zeroPad, sheetId: idPolicies.sheetId })
    .from(idPolicies)
    .innerJoin(sheets, eq(sheets.id, idPolicies.sheetId))
    .where(isNull(sheets.deletedAt));
  if (policies.length === 0) {
    return { documentId, columns: [] };
  }
  const prefixes = Array.from(new Set(policies.map((p) => p.prefix.trim()).filter(Boolean)));
  const prefixGroup = prefixes.map(escapeForRegex).join("|");
  // Single-token: `PREFIX-123` / `PREFIX123` / `PREFIX 123` (case-insensitive,
  // anchored at word-ish boundaries).
  const tokenRegex = new RegExp(`\\b(${prefixGroup})[\\s-]?(\\d+)\\b`, "gi");
  // Range: `UC-01 to UC-07`, `UC-01 - UC-07`, `UC-01 – UC-07`, or the same
  // prefix dropped on the right side (`UC-01 to 07`). The trailing prefix is
  // optional; when present it must equal the leading prefix to count as a
  // range — otherwise both ends are picked up as separate single tokens.
  const rangeRegex = new RegExp(
    `\\b(${prefixGroup})[\\s-]?(\\d+)\\s*(?:to|through|thru|[-–—])\\s*(?:(${prefixGroup})[\\s-]?)?(\\d+)\\b`,
    "gi"
  );
  // Hard cap so a typo like `UC-1 to UC-99999` doesn't expand to 100k tokens.
  const MAX_RANGE_EXPANSION = 200;

  // 2. Load all live rows that could match — keyed by normalized visibleId.
  const allRows = await db
    .select({
      rowId: rows.id,
      visibleId: rows.visibleId,
      sheetId: sheets.id,
      sheetName: sheets.name,
      documentId: documents.id,
      documentTitle: documents.title
    })
    .from(rows)
    .innerJoin(sheets, eq(sheets.id, rows.sheetId))
    .innerJoin(documents, eq(documents.id, sheets.documentId))
    .where(
      and(
        isNull(rows.deletedAt),
        isNull(sheets.deletedAt),
        isNull(documents.deletedAt),
        isNotNull(rows.visibleId)
      )
    );
  const candidatesByNormalized = new Map<string, DetectedCandidate[]>();
  for (const r of allRows) {
    if (!r.visibleId) continue;
    const key = normalizeVisibleId(r.visibleId);
    const list = candidatesByNormalized.get(key) ?? [];
    list.push({
      rowId: r.rowId,
      visibleId: r.visibleId,
      sheetId: r.sheetId,
      sheetName: r.sheetName,
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      display: null
    });
    candidatesByNormalized.set(key, list);
  }

  // 3. Scan every scannable scalar cell in the current document.
  const docSheets = await db
    .select({ id: sheets.id, name: sheets.name })
    .from(sheets)
    .where(and(eq(sheets.documentId, documentId), isNull(sheets.deletedAt), ne(sheets.sheetKind, "glossary"), ne(sheets.sheetKind, "instructions")));
  if (docSheets.length === 0) return { documentId, columns: [] };
  const sheetIds = docSheets.map((s) => s.id);
  const sheetNameById = new Map(docSheets.map((s) => [s.id, s.name]));

  const docFields = await db
    .select({
      id: fields.id,
      label: fields.label,
      type: fields.type,
      sheetId: fields.sheetId,
      archived: fields.archived,
      isIdField: fields.isIdField
    })
    .from(fields)
    .where(inArray(fields.sheetId, sheetIds));
  const scannableFields = docFields.filter(
    (f) => !f.archived && !f.isIdField && SCANNABLE_TYPES.has(f.type)
  );
  if (scannableFields.length === 0) return { documentId, columns: [] };
  const scannableFieldIds = scannableFields.map((f) => f.id);

  const scalarRows = await db
    .select({
      rowId: cellValuesScalar.rowId,
      fieldId: cellValuesScalar.fieldId,
      valueText: cellValuesScalar.valueText
    })
    .from(cellValuesScalar)
    .where(inArray(cellValuesScalar.fieldId, scannableFieldIds));

  // Map rowId → visibleId for the rows in this document, for context display
  // in the UI and so we can suppress self-matches.
  const rowMeta = await db
    .select({ id: rows.id, visibleId: rows.visibleId, sheetId: rows.sheetId })
    .from(rows)
    .where(and(inArray(rows.sheetId, sheetIds), isNull(rows.deletedAt)));
  const visibleByRowId = new Map(rowMeta.map((r) => [r.id, r.visibleId]));

  // 4. Group by (sheetId, fieldId) and build the structured result.
  const byField = new Map<string, DetectedCell[]>();
  const occurrenceCounts = new Map<string, Map<string, number>>(); // fieldId → sheetId → hits
  for (const cell of scalarRows) {
    const text = cell.valueText ?? "";
    if (!text.trim()) continue;
    const tokens: DetectedToken[] = [];
    // Intervals (text spans) already claimed by a range match — single-token
    // scan skips anything that overlaps these so we don't double-count the
    // endpoints.
    const consumedRanges: { start: number; end: number }[] = [];

    const sheetTally =
      occurrenceCounts.get(cell.fieldId) ??
      (() => {
        const m = new Map<string, number>();
        occurrenceCounts.set(cell.fieldId, m);
        return m;
      })();
    const addToken = (raw: string, start: number, end: number) => {
      const norm = normalizeVisibleId(raw);
      const allCandidates = candidatesByNormalized.get(norm) ?? [];
      const candidates = allCandidates.filter((c) => c.rowId !== cell.rowId);
      tokens.push({ token: raw, start, end, candidates });
      for (const c of candidates) {
        sheetTally.set(c.sheetId, (sheetTally.get(c.sheetId) ?? 0) + 1);
      }
    };

    // 4a. Range pass.
    rangeRegex.lastIndex = 0;
    let rangeMatch: RegExpExecArray | null;
    while ((rangeMatch = rangeRegex.exec(text)) !== null) {
      const [whole, leftPrefix, leftNumStr, rightPrefixRaw, rightNumStr] = rangeMatch;
      const leftNum = Number(leftNumStr);
      const rightNum = Number(rightNumStr);
      // If a right-side prefix was given, it must equal the left-side prefix
      // (case-insensitive) — otherwise treat both ends as independent tokens.
      if (rightPrefixRaw && rightPrefixRaw.toUpperCase() !== leftPrefix.toUpperCase()) continue;
      if (!Number.isFinite(leftNum) || !Number.isFinite(rightNum)) continue;
      const lo = Math.min(leftNum, rightNum);
      const hi = Math.max(leftNum, rightNum);
      if (hi - lo + 1 > MAX_RANGE_EXPANSION) continue;
      // Pad based on whichever endpoint has the most leading zeros, so
      // `UC-01 to UC-12` expands to 2-digit codes (UC-01..UC-12).
      const pad = Math.max(leftNumStr.length, rightNumStr.length);
      const start = rangeMatch.index;
      const end = start + whole.length;
      consumedRanges.push({ start, end });
      for (let n = lo; n <= hi; n += 1) {
        const numStr = String(n).padStart(pad, "0");
        const synthetic = `${leftPrefix.toUpperCase()}-${numStr}`;
        addToken(synthetic, start, end);
      }
    }

    // 4b. Single-token pass.
    tokenRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const overlapped = consumedRanges.some((r) => start < r.end && end > r.start);
      if (overlapped) continue;
      addToken(match[0], start, end);
    }

    if (tokens.length === 0) continue;
    // Stable order by text position; range expansions share the same range so
    // they cluster naturally next to each other.
    tokens.sort((a, b) => a.start - b.start);

    const list = byField.get(cell.fieldId) ?? [];
    list.push({
      rowId: cell.rowId,
      rowVisibleId: visibleByRowId.get(cell.rowId) ?? null,
      rawText: text,
      tokens
    });
    byField.set(cell.fieldId, list);
  }

  const sheetMetaById = new Map<string, { sheetName: string; documentId: string; documentTitle: string }>();
  for (const c of allRows) {
    if (!sheetMetaById.has(c.sheetId)) {
      sheetMetaById.set(c.sheetId, {
        sheetName: c.sheetName,
        documentId: c.documentId,
        documentTitle: c.documentTitle
      });
    }
  }

  const columns: DetectedColumn[] = scannableFields
    .map((f) => {
      const cells = byField.get(f.id) ?? [];
      if (cells.length === 0) return null;
      const allTokens = cells.flatMap((c) => c.tokens);
      const ambiguous = allTokens.filter((t) => t.candidates.length > 1).length;
      const unresolved = allTokens.filter((t) => t.candidates.length === 0).length;
      const sheetTally = occurrenceCounts.get(f.id) ?? new Map<string, number>();
      const suggested = Array.from(sheetTally.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([sheetId, hits]) => {
          const meta = sheetMetaById.get(sheetId);
          return meta
            ? {
                sheetId,
                sheetName: meta.sheetName,
                documentId: meta.documentId,
                documentTitle: meta.documentTitle,
                hits
              }
            : null;
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      const totalCellsForField = scalarRows.filter((r) => r.fieldId === f.id && (r.valueText ?? "").trim()).length;
      return {
        sheetId: f.sheetId,
        sheetName: sheetNameById.get(f.sheetId) ?? "",
        fieldId: f.id,
        fieldLabel: f.label,
        fieldType: f.type,
        cells,
        totalCells: totalCellsForField,
        cellsWithTokens: cells.length,
        totalTokens: allTokens.length,
        ambiguousTokens: ambiguous,
        unresolvedTokens: unresolved,
        suggestedTargetSheets: suggested
      } satisfies DetectedColumn;
    })
    .filter((c): c is DetectedColumn => c !== null);

  return { documentId, columns };
}

function normalizeVisibleId(token: string): string {
  return token.replace(/\s+/g, "").replace(/^([A-Za-z]+)-?(\d+)$/, (_m, p, n) => `${p.toUpperCase()}-${n}`);
}
