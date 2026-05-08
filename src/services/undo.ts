import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { writeAudit } from "./audit";
import { patchCell, restoreDocument, restoreRow, softDeleteRow } from "./repository";

type ActorUser = { userId: string; username: string };

const REVERSIBLE = ["ROW_CREATE", "ROW_DELETE", "CELL_UPDATE", "DOCUMENT_DELETE"] as const;

export class NothingToUndoError extends Error {
  constructor() {
    super("Nothing to undo");
    this.name = "NothingToUndoError";
  }
}

export async function undoLastAction(user: ActorUser) {
  const [event] = await db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.actingUserId, user.userId),
        eq(auditEvents.success, true),
        inArray(auditEvents.actionType, REVERSIBLE as unknown as string[]),
        sql`(${auditEvents.requestMeta} ->> 'undone') is null`
      )
    )
    .orderBy(desc(auditEvents.timestamp))
    .limit(1);

  if (!event) throw new NothingToUndoError();

  const summary = event.summaryText;
  let undoSummary = `Undid: ${summary}`;

  switch (event.actionType) {
    case "ROW_CREATE": {
      if (!event.rowId) throw new Error("Cannot undo: missing row id");
      await softDeleteRow(user, event.rowId);
      undoSummary = `Removed row ${event.rowVisibleId ?? event.rowId}`;
      break;
    }
    case "ROW_DELETE": {
      if (!event.rowId) throw new Error("Cannot undo: missing row id");
      await restoreRow(user, event.rowId);
      undoSummary = `Restored row ${event.rowVisibleId ?? event.rowId}`;
      break;
    }
    case "CELL_UPDATE": {
      if (!event.rowId || !event.fieldId) throw new Error("Cannot undo: missing row/field id");
      const before = event.beforeJson as
        | { displayText?: string | null; valueText?: string | null }
        | string[]
        | null;
      let value: unknown = null;
      if (Array.isArray(before)) {
        // multi/single-reference: stored as link list — restore by pulling target ids
        // event.beforeJson on links is the previous list of cellValueLinks objects
        value = (before as unknown as { targetRowId: string }[]).map((b) => b.targetRowId);
      } else if (before && typeof before === "object") {
        value = before.displayText ?? before.valueText ?? null;
      } else {
        value = null;
      }
      await patchCell(user, event.rowId, { fieldId: event.fieldId, value });
      undoSummary = `Reverted ${event.fieldLabel ?? "cell"} on ${event.rowVisibleId ?? event.rowId}`;
      break;
    }
    case "DOCUMENT_DELETE": {
      const docId = event.entityId ?? event.parentDocumentId;
      if (!docId) throw new Error("Cannot undo: missing document id");
      const restored = await restoreDocument(user, docId);
      undoSummary = `Restored document ${restored.title}`;
      break;
    }
    default:
      throw new Error(`Action ${event.actionType} is not undoable`);
  }

  await db
    .update(auditEvents)
    .set({
      requestMeta: sql`coalesce(${auditEvents.requestMeta}, '{}'::jsonb) || jsonb_build_object('undone', true, 'undoneAt', to_jsonb(now()))`
    })
    .where(eq(auditEvents.id, event.id));

  await writeAudit({
    actor: { id: user.userId, username: user.username },
    actionType: "ROW_UPDATE",
    entityType: "undo",
    entityId: event.id,
    parentDocumentId: event.parentDocumentId,
    parentSheetId: event.parentSheetId,
    parentSheetName: event.parentSheetName,
    rowId: event.rowId,
    rowVisibleId: event.rowVisibleId,
    summary: undoSummary,
    requestMeta: { undoneEventId: event.id, originalAction: event.actionType }
  });

  return {
    undone: {
      eventId: event.id,
      actionType: event.actionType,
      summary,
      undoSummary,
      documentId: event.parentDocumentId,
      sheetId: event.parentSheetId,
      rowId: event.rowId,
      at: event.timestamp.toISOString()
    }
  };
}

export async function getUndoableCount(user: ActorUser) {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.actingUserId, user.userId),
        eq(auditEvents.success, true),
        inArray(auditEvents.actionType, REVERSIBLE as unknown as string[]),
        sql`(${auditEvents.requestMeta} ->> 'undone') is null`
      )
    );
  return Number(row?.c ?? 0);
}
