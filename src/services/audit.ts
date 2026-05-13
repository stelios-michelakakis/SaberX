import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { auditEvents } from "@/db/schema";
import { db } from "@/db";
import type { ActionType } from "@/lib/constants";
import { jsonDiff } from "@/lib/utils";

export type AuditActor = {
  id: string | null;
  username: string;
};

export type AuditSourceType =
  | "UI"
  | "import"
  | "export"
  | "system"
  | "integrity"
  | "renumbering"
  | "security"
  | "mcp";

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
  sourceType?: AuditSourceType;
  success?: boolean;
  requestMeta?: Record<string, unknown>;
};

type AuditContext = { sourceType: AuditSourceType };

const auditContext = new AsyncLocalStorage<AuditContext>();

// Lets request entry points (e.g. the MCP HTTP handler) tag every nested
// writeAudit call with a sourceType without threading it through every
// repository function. writeAudit prefers an explicit input.sourceType,
// falls back to the surrounding context, and finally defaults to "UI".
export function withAuditContext<T>(ctx: AuditContext, fn: () => Promise<T>): Promise<T> {
  return auditContext.run(ctx, fn);
}

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
    sourceType: input.sourceType ?? auditContext.getStore()?.sourceType ?? "UI",
    success: input.success ?? true,
    requestMeta: input.requestMeta ?? {}
  });
  return transactionId;
}
