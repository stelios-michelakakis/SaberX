import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { fields, rows, sheets } from "@/db/schema";
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
  // Per-column problems we recovered from instead of crashing — the user
  // can use these to chase up missing rows after the fact.
  warnings: { sourceFieldId: string; message: string }[];
};

export async function applyDetectedReferences(
  user: ActorUser,
  documentId: string,
  decisions: ResolveColumnDecision[]
): Promise<ResolveSummary> {
  const summary: ResolveSummary = { createdFields: [], cellsWritten: 0, warnings: [] };

  for (const decision of decisions) {
    if (decision.targetSheetIds.length === 0) {
      summary.warnings.push({
        sourceFieldId: decision.fieldId,
        message: "No target sheets selected — column skipped."
      });
      continue;
    }
    const allowedSheetSet = new Set(decision.targetSheetIds);

    // Drop any picks that point at a row outside the user's selected target
    // sheets — those would fail validation on patchCell and otherwise abort
    // the whole apply mid-stream. The user gets a warning instead of a 500.
    const allPickedRowIds = Array.from(
      new Set(decision.cellPicks.flatMap((c) => c.pickedRowIds))
    );
    const pickedRowSheet = new Map<string, string>();
    if (allPickedRowIds.length > 0) {
      const pickedRows = await db
        .select({ id: rows.id, sheetId: rows.sheetId, deletedAt: rows.deletedAt })
        .from(rows)
        .innerJoin(sheets, eq(sheets.id, rows.sheetId))
        .where(
          and(
            inArray(rows.id, allPickedRowIds),
            isNull(rows.deletedAt),
            isNull(sheets.deletedAt)
          )
        );
      for (const r of pickedRows) pickedRowSheet.set(r.id, r.sheetId);
    }

    let droppedPicks = 0;
    const filteredCellPicks = decision.cellPicks.map((cell) => {
      const kept = cell.pickedRowIds.filter((rowId) => {
        const sheetId = pickedRowSheet.get(rowId);
        if (!sheetId) {
          droppedPicks += 1;
          return false;
        }
        if (!allowedSheetSet.has(sheetId)) {
          droppedPicks += 1;
          return false;
        }
        return true;
      });
      return { rowId: cell.rowId, pickedRowIds: kept };
    });
    if (droppedPicks > 0) {
      summary.warnings.push({
        sourceFieldId: decision.fieldId,
        message: `Dropped ${droppedPicks} pick(s) — their target sheet wasn't in the selected bindings or the row is no longer live.`
      });
    }

    const cellsWithPicks = filteredCellPicks.filter((c) => c.pickedRowIds.length > 0);
    if (cellsWithPicks.length === 0) {
      summary.warnings.push({
        sourceFieldId: decision.fieldId,
        message: "Every pick was dropped — no link column created."
      });
      continue;
    }

    try {
      const [sourceField] = await db
        .select()
        .from(fields)
        .where(eq(fields.id, decision.fieldId))
        .limit(1);
      if (!sourceField) {
        summary.warnings.push({
          sourceFieldId: decision.fieldId,
          message: "Source field not found — column skipped."
        });
        continue;
      }
      const [sourceSheet] = await db
        .select()
        .from(sheets)
        .where(eq(sheets.id, sourceField.sheetId))
        .limit(1);
      if (!sourceSheet || sourceSheet.documentId !== documentId) {
        summary.warnings.push({
          sourceFieldId: decision.fieldId,
          message: "Source field doesn't belong to this document — column skipped."
        });
        continue;
      }

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

      for (const cell of cellsWithPicks) {
        try {
          await patchCell(user, cell.rowId, {
            fieldId: newField.id,
            value: cell.pickedRowIds.map((id) => ({ kind: "row", id }))
          });
          summary.cellsWritten += 1;
        } catch (cellError) {
          summary.warnings.push({
            sourceFieldId: decision.fieldId,
            message: `Failed to write cell ${cell.rowId.slice(0, 8)}: ${(cellError as Error).message}`
          });
        }
      }
    } catch (columnError) {
      summary.warnings.push({
        sourceFieldId: decision.fieldId,
        message: `Column apply failed: ${(columnError as Error).message}`
      });
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
