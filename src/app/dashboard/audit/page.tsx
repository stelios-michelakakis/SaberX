import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, documents } from "@/db/schema";
import { PageHeader } from "@/components/saberx/page-header";
import { requireUser } from "@/services/auth";
import { AuditClient } from "./audit-client";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams
}: {
  searchParams: Promise<{ actor?: string; action?: string; document?: string }>;
}) {
  await requireUser();
  const { actor, action, document } = await searchParams;

  const conditions = [] as ReturnType<typeof eq>[];
  if (actor) conditions.push(eq(auditEvents.actingUsername, actor));
  if (action) conditions.push(eq(auditEvents.actionType, action));
  if (document) conditions.push(eq(auditEvents.parentDocumentId, document));

  const events = await db
    .select()
    .from(auditEvents)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditEvents.timestamp))
    .limit(300);

  const [actorsRow, actionsRow] = await Promise.all([
    db
      .selectDistinct({ name: auditEvents.actingUsername })
      .from(auditEvents)
      .orderBy(auditEvents.actingUsername),
    db
      .selectDistinct({ type: auditEvents.actionType })
      .from(auditEvents)
      .orderBy(auditEvents.actionType)
  ]);
  const docList = await db
    .select({ id: documents.id, title: documents.title })
    .from(documents)
    .where(isNull(documents.deletedAt))
    .orderBy(documents.title);

  return (
    <>
      <PageHeader
        eyebrow="Audit log"
        title="Activity"
        subtitle="Immutable, append-only record of every change to documents, sheets, fields, and rows."
        meta={
          <span>
            <strong style={{ color: "var(--ink)" }}>{events.length}</strong> events shown
          </span>
        }
      />

      <AuditClient
        events={events.map((e) => ({
          id: e.id,
          timestamp: e.timestamp.toISOString(),
          actingUsername: e.actingUsername,
          actionType: e.actionType,
          entityType: e.entityType,
          rowVisibleId: e.rowVisibleId,
          parentDocumentName: e.parentDocumentName,
          summaryText: e.summaryText
        }))}
        actors={actorsRow.map((a) => a.name).filter(Boolean)}
        actions={actionsRow.map((a) => a.type).filter(Boolean)}
        documents={docList}
        filters={{ actor: actor ?? "", action: action ?? "", document: document ?? "" }}
      />
    </>
  );
}
