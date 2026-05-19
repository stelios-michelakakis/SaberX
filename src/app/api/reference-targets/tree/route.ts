import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { documents, sheets } from "@/db/schema";
import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";

export async function GET() {
  try {
    await requireUser();
    const rows = await db
      .select({
        documentId: documents.id,
        documentTitle: documents.title,
        sheetId: sheets.id,
        sheetName: sheets.name,
        sheetKind: sheets.sheetKind,
        sheetOrder: sheets.displayOrder
      })
      .from(documents)
      .innerJoin(sheets, eq(sheets.documentId, documents.id))
      .where(
        and(
          isNull(documents.deletedAt),
          isNull(sheets.deletedAt),
          ne(sheets.sheetKind, "instructions"),
          ne(sheets.sheetKind, "glossary")
        )
      )
      .orderBy(asc(documents.title), asc(sheets.displayOrder));

    const byDoc = new Map<
      string,
      { id: string; title: string; sheets: { id: string; name: string; sheetKind: string }[] }
    >();
    for (const r of rows) {
      let doc = byDoc.get(r.documentId);
      if (!doc) {
        doc = { id: r.documentId, title: r.documentTitle, sheets: [] };
        byDoc.set(r.documentId, doc);
      }
      doc.sheets.push({ id: r.sheetId, name: r.sheetName, sheetKind: r.sheetKind });
    }
    return ok({ documents: Array.from(byDoc.values()) });
  } catch (error) {
    return mapError(error);
  }
}
