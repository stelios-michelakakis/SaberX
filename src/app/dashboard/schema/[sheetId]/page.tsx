import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sheets } from "@/db/schema";
import { Icon } from "@/components/saberx/icon";
import { PageHeader } from "@/components/saberx/page-header";
import { requireUser } from "@/services/auth";
import { getSheetGrid } from "@/services/repository";
import { SchemaClient } from "./schema-client";

export const dynamic = "force-dynamic";

export default async function SchemaPage({
  params
}: {
  params: Promise<{ sheetId: string }>;
}) {
  await requireUser();
  const { sheetId } = await params;
  const [sheet] = await db.select().from(sheets).where(eq(sheets.id, sheetId)).limit(1);
  if (!sheet) notFound();

  const grid = await getSheetGrid(sheetId);
  const systemManaged = sheet.sheetKind === "glossary";
  const docSheets = await db
    .select({ id: sheets.id, name: sheets.name, sheetKind: sheets.sheetKind })
    .from(sheets)
    .where(and(eq(sheets.documentId, sheet.documentId), isNull(sheets.deletedAt)))
    .orderBy(asc(sheets.displayOrder));

  return (
    <>
      <PageHeader
        eyebrow="Schema"
        title={`${grid.sheet.name} fields`}
        subtitle={
          sheet.description ||
          "Field metadata, types, and validation rules. Edits propagate to all rows in this sheet."
        }
        actions={
          <Link
            href={`/dashboard/documents/${sheet.documentId}?sheet=${sheetId}`}
            className="sx-btn sx-btn-sm"
          >
            <Icon name="rows" size={12} /> View grid
          </Link>
        }
      />

      <SchemaClient
        sheetId={sheetId}
        documentId={sheet.documentId}
        systemManaged={systemManaged}
        sheets={docSheets}
        initialFields={grid.fields.map((f) => ({
          id: f.id,
          label: f.label,
          slug: f.slug,
          type: f.type,
          description: f.description,
          required: f.required,
          unique: f.unique,
          editable: f.editable,
          isIdField: f.isIdField,
          options: f.options ?? [],
          bindings:
            (f as unknown as {
              bindings?: { allowedSheetId: string; allowSelfReference: boolean; displayFieldId?: string | null; allowSources?: boolean }[];
            }).bindings ?? []
        }))}
      />
    </>
  );
}
