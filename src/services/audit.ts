import { randomUUID } from "node:crypto";
import { auditEvents } from "@/db/schema";
import { db } from "@/db";
import type { ActionType } from "@/lib/constants";
import { jsonDiff } from "@/lib/utils";

export type AuditActor = {
  id: string | null;
  username: string;
};

export type AuditInput = {
  transactionId?: string;
  actor?: AuditActor | null;
  actionType: ActionType | string;
  entityType: string;
  entityId?: string | null;
  parentDocumentId?: string | null;
  parentDocumentName?: string | null;
  parentSheetId?: string | null;
  parentSheetName?: string | null;
  rowId?: string | null;
  rowVisibleId?: string | null;
  fieldId?: string | null;
  fieldLabel?: string | null;
  before?: unknown;
  after?: unknown;
  summary: string;
  sourceType?: "UI" | "import" | "export" | "system" | "integrity" | "renumbering" | "security";
  success?: boolean;
  requestMeta?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput, client: any = db) {
  const transactionId = input.transactionId ?? randomUUID();
  await client.insert(auditEvents).values({
    transactionId,
    actingUserId: input.actor?.id ?? null,
    actingUsername: input.actor?.username ?? "system",
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    parentDocumentId: input.parentDocumentId ?? null,
    parentDocumentName: input.parentDocumentName ?? null,
    parentSheetId: input.parentSheetId ?? null,
    parentSheetName: input.parentSheetName ?? null,
    rowId: input.rowId ?? null,
    rowVisibleId: input.rowVisibleId ?? null,
    fieldId: input.fieldId ?? null,
    fieldLabel: input.fieldLabel ?? null,
    beforeJson: input.before ?? null,
    afterJson: input.after ?? null,
    diffJson: jsonDiff(input.before, input.after),
    summaryText: input.summary,
    sourceType: input.sourceType ?? "UI",
    success: input.success ?? true,
    requestMeta: input.requestMeta ?? {}
  });
  return transactionId;
}
