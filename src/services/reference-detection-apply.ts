import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { cellValuesScalar, fields, referenceBindings, rows, sheets } from "@/db/schema";
import { writeAudit } from "./audit";
import { patchCell } from "./repository";

type ActorUser = { userId: string; username: string };

export type ResolveColumnDecision = {
  fieldId: string;
  // Sheets the column should be bound to. Required.
  targetSheetIds: string[];
  // Per source-row decisions. Each picks 0+ target row IDs.
  cellPicks: { rowId: string; pickedRowIds: string[] }[];
};

export type ResolveSummary = {
  convertedFields: { fieldId: string; fieldLabel: string }[];
  cellsWritten: number;
  // Per-column problems we recovered from instead of crashing.
  warnings: { sourceFieldId: string; message: string }[];
};

const CONVERTIBLE_TYPES = new Set(["short_text", "long_text", "rich_note"]);

export async function applyDetectedReferences(
  user: ActorUser,
  documentId: string,
  decisions: ResolveColumnDecision[]
): Promise<ResolveSummary> {
  const summary: ResolveSummary = { convertedFields: [], cellsWritten: 0, warnings: [] };

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
    // sheets — those would fail validation later. Per-column warning rather
    // than crashing the whole apply.
    const allPickedRowIds = Array.from(
      new Set(decision.cellPicks.flatMap((c) => c.pickedRowIds))
    );
    const pickedRowSheet = new Map<string, string>();
    if (allPickedRowIds.length > 0) {
      const pickedRows = await db
        .select({ id: rows.id, sheetId: rows.sheetId })
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
        message: "Every pick was dropped — column not converted."
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
      if (!CONVERTIBLE_TYPES.has(sourceField.type)) {
        summary.warnings.push({
          sourceFieldId: decision.fieldId,
          message: `Field type ${sourceField.type} can't be converted to a reference field — column skipped.`
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

      // Lookup the documentId for every target sheet so each binding row
      // gets the right allowed_document_id (cross-doc bindings supported).
      const targetSheetRows = await db
        .select({ id: sheets.id, documentId: sheets.documentId })
        .from(sheets)
        .where(
          and(
            inArray(sheets.id, decision.targetSheetIds),
            isNull(sheets.deletedAt)
          )
        );
      const docByTargetSheet = new Map(targetSheetRows.map((s) => [s.id, s.documentId]));
      const validTargets = decision.targetSheetIds.filter((id) => docByTargetSheet.has(id));
      if (validTargets.length === 0) {
        summary.warnings.push({
          sourceFieldId: decision.fieldId,
          message: "All selected target sheets are gone — column skipped."
        });
        continue;
      }

      // Snapshot the existing scalar text so we can store it in the audit
      // entry — gives the user a paper trail if a cell had prose that gets
      // dropped during conversion.
      const previousScalars = await db
        .select({
          rowId: cellValuesScalar.rowId,
          valueText: cellValuesScalar.valueText
        })
        .from(cellValuesScalar)
        .where(eq(cellValuesScalar.fieldId, sourceField.id));

      // 1. Drop the old scalar values — required because the field's type
      //    is about to change to multi_reference, and any leftover scalar
      //    rows would be invisible but dangling.
      // 2. Replace any existing reference bindings with the new selection.
      // 3. Flip the field type to multi_reference.
      // 4. Patch the cells to write the references via the regular service
      //    (so audit, search-index, glossary refresh all fire).
      await db.delete(cellValuesScalar).where(eq(cellValuesScalar.fieldId, sourceField.id));
      await db.delete(referenceBindings).where(eq(referenceBindings.fieldId, sourceField.id));
      await db.insert(referenceBindings).values(
        validTargets.map((sheetId) => ({
          fieldId: sourceField.id,
          allowedDocumentId: docByTargetSheet.get(sheetId) ?? sourceSheet.documentId,
          allowedSheetId: sheetId,
          allowSelfReference: sheetId === sourceSheet.id,
          displayFieldId: null,
          allowSources: false
        }))
      );
      await db
        .update(fields)
        .set({ type: "multi_reference", updatedAt: new Date(), updatedBy: user.userId })
        .where(eq(fields.id, sourceField.id));

      await writeAudit({
        actor: { id: user.userId, username: user.username },
        actionType: "FIELD_UPDATE",
        entityType: "field",
        entityId: sourceField.id,
        parentDocumentId: documentId,
        before: {
          type: sourceField.type,
          scalarValues: previousScalars.filter((r) => r.valueText)
        },
        after: { type: "multi_reference", targetSheetIds: validTargets },
        summary: `Converted ${sourceField.label} to multi_reference`,
        sourceType: "system"
      });

      summary.convertedFields.push({
        fieldId: sourceField.id,
        fieldLabel: sourceField.label
      });

      for (const cell of cellsWithPicks) {
        try {
          await patchCell(user, cell.rowId, {
            fieldId: sourceField.id,
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
