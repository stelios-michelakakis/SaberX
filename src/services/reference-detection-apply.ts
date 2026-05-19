import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fields, sheets } from "@/db/schema";
import { createField, patchCell } from "./repository";

type ActorUser = { userId: string; username: string };

export type ResolveColumnDecision = {
  fieldId: string;
  // Sheets the new reference column should be bound to. Required.
  targetSheetIds: string[];
  // Per source-row decisions. Each picks 0+ target row IDs.
  cellPicks: { rowId: string; pickedRowIds: string[] }[];
};

export type ResolveSummary = {
  createdFields: { sourceFieldId: string; newFieldId: string; newFieldLabel: string }[];
  cellsWritten: number;
};

export async function applyDetectedReferences(
  user: ActorUser,
  documentId: string,
  decisions: ResolveColumnDecision[]
): Promise<ResolveSummary> {
  const summary: ResolveSummary = { createdFields: [], cellsWritten: 0 };

  for (const decision of decisions) {
    if (decision.targetSheetIds.length === 0) continue;
    const decisionWithPicks = decision.cellPicks.filter((c) => c.pickedRowIds.length > 0);
    if (decisionWithPicks.length === 0) continue;

    const [sourceField] = await db
      .select()
      .from(fields)
      .where(eq(fields.id, decision.fieldId))
      .limit(1);
    if (!sourceField) continue;
    const [sourceSheet] = await db
      .select()
      .from(sheets)
      .where(eq(sheets.id, sourceField.sheetId))
      .limit(1);
    if (!sourceSheet || sourceSheet.documentId !== documentId) continue;

    const labelBase = `${sourceField.label} → links`;
    const newLabel = await uniqueLabel(sourceSheet.id, labelBase);

    const newField = await createField(user, sourceSheet.id, {
      label: newLabel,
      type: "multi_reference",
      description: `Detected references from "${sourceField.label}"`,
      required: false,
      unique: false,
      editable: true,
      bindings: decision.targetSheetIds.map((sheetId) => ({
        allowedSheetId: sheetId,
        allowSelfReference: sheetId === sourceSheet.id,
        displayFieldId: null,
        allowSources: false
      }))
    });

    summary.createdFields.push({
      sourceFieldId: sourceField.id,
      newFieldId: newField.id,
      newFieldLabel: newField.label
    });

    for (const cell of decisionWithPicks) {
      await patchCell(user, cell.rowId, {
        fieldId: newField.id,
        value: cell.pickedRowIds.map((id) => ({ kind: "row", id }))
      });
      summary.cellsWritten += 1;
    }
  }

  return summary;
}

async function uniqueLabel(sheetId: string, base: string): Promise<string> {
  const existing = await db.select({ label: fields.label }).from(fields).where(eq(fields.sheetId, sheetId));
  const taken = new Set(existing.map((e) => e.label));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base} (${i})`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base} (${Date.now()})`;
}
