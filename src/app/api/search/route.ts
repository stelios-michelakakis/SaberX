import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { cellValueLinks, documents, rows, sheets } from "@/db/schema";
import { mapError, ok } from "@/lib/api";
import { searchSchema } from "@/lib/validation";
import { requireUser } from "@/services/auth";
import { searchRepository } from "@/services/repository";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const input = searchSchema.parse({
      q: url.searchParams.get("q") ?? "",
      relationExpansion: url.searchParams.get("relationExpansion") === "1"
    });
    const direct = await searchRepository(input.q);

    let results = direct;
    if (input.relationExpansion && direct.length > 0) {
      const matchedRowIds = direct.map((r) => r.rowId).filter((id): id is string => Boolean(id));
      if (matchedRowIds.length > 0) {
        const links = await db
          .select({ source: cellValueLinks.sourceRowId, target: cellValueLinks.targetRowId })
          .from(cellValueLinks)
          .where(
            or(
              inArray(cellValueLinks.sourceRowId, matchedRowIds),
              inArray(cellValueLinks.targetRowId, matchedRowIds)
            )
          );
        const expandedRowIds = Array.from(
          new Set(
            links
              .flatMap((l) => [l.source, l.target])
              .filter((id): id is string => Boolean(id) && !matchedRowIds.includes(id as string))
          )
        );
        if (expandedRowIds.length > 0) {
          const expandedRows = await db
            .select({
              id: rows.id,
              visibleId: rows.visibleId,
              sheetId: rows.sheetId,
              sheetName: sheets.name,
              documentId: sheets.documentId,
              documentName: documents.title
            })
            .from(rows)
            .innerJoin(sheets, eq(sheets.id, rows.sheetId))
            .innerJoin(documents, eq(documents.id, sheets.documentId))
            .where(and(inArray(rows.id, expandedRowIds), isNull(rows.deletedAt)));

          const knownIds = new Set(direct.map((d) => d.id));
          const expanded = expandedRows
            .filter((r) => !knownIds.has(r.id))
            .map((r, idx) => ({
              id: `expanded-${r.id}-${idx}`,
              documentId: r.documentId,
              documentName: r.documentName,
              sheetId: r.sheetId,
              sheetName: r.sheetName,
              fieldId: null as string | null,
              fieldLabel: "Linked",
              rowId: r.id,
              rowVisibleId: r.visibleId,
              matchType: "Linked",
              searchableText: `${r.visibleId ?? ""} ${r.sheetName}`,
              excerpt: `Linked from a direct match`,
              relationHints: {} as Record<string, unknown>,
              searchVector: null,
              updatedAt: new Date()
            }));
          results = [...direct, ...(expanded as unknown as typeof direct)];
        }
      }
    }

    const grouped = results.reduce<Record<string, Record<string, typeof results>>>((acc, result) => {
      acc[result.documentName] ??= {};
      acc[result.documentName][result.sheetName ?? "Document"] ??= [];
      acc[result.documentName][result.sheetName ?? "Document"].push(result);
      return acc;
    }, {});
    return ok({ results, grouped });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const input = searchSchema.parse(await request.json());
    return ok({ results: await searchRepository(input.q) });
  } catch (error) {
    return mapError(error);
  }
}
