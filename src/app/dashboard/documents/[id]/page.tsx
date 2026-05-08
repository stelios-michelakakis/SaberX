import { notFound, redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documents, sheets } from "@/db/schema";
import { requireUser } from "@/services/auth";
import { DocumentClient } from "./document-client";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sheet?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { sheet: sheetParam } = await searchParams;

  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc || doc.deletedAt) notFound();

  const docSheets = await db
    .select()
    .from(sheets)
    .where(and(eq(sheets.documentId, id), isNull(sheets.deletedAt)))
    .orderBy(asc(sheets.displayOrder));

  if (!docSheets.length) {
    return (
      <div style={{ padding: 40, color: "var(--ink-3)" }}>
        Document <strong style={{ color: "var(--ink)" }}>{doc.title}</strong> has no sheets yet.
      </div>
    );
  }

  const activeSheet = sheetParam
    ? docSheets.find((s) => s.id === sheetParam) ?? docSheets[0]
    : docSheets.find((s) => !s.isSystemReserved) ?? docSheets[0];

  if (!sheetParam) {
    redirect(`/dashboard/documents/${id}?sheet=${activeSheet.id}`);
  }

  return (
    <DocumentClient
      document={{
        id: doc.id,
        title: doc.title,
        description: doc.description,
        status: doc.status,
        classification: doc.classification,
        baselineState: doc.baselineState,
        templateType: doc.templateType,
        version: doc.version
      }}
      sheets={docSheets.map((s) => ({
        id: s.id,
        name: s.name,
        sheetKind: s.sheetKind,
        isSystemReserved: s.isSystemReserved,
        displayOrder: s.displayOrder,
        description: s.description
      }))}
      activeSheetId={activeSheet.id}
    />
  );
}
