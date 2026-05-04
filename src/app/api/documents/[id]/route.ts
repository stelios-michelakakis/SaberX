import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { mapError, ok } from "@/lib/api";
import { documentUpdateSchema } from "@/lib/validation";
import { actorFromUser, requireUser } from "@/services/auth";
import { impactAnalysis, updateDocument } from "@/services/repository";
import { writeAudit } from "@/services/audit";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    const [document] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!document) throw new Error("Document not found");
    return ok({ document });
  } catch (error) {
    return mapError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = documentUpdateSchema.parse(await request.json());
    return ok({ document: await updateDocument(user, id, input) });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const impact = await impactAnalysis("document_delete", id);
    const [before] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!before) throw new Error("Document not found");
    const [after] = await db.update(documents).set({ deletedAt: new Date(), updatedBy: user.userId, updatedAt: new Date() }).where(eq(documents.id, id)).returning();
    await writeAudit({
      actor: actorFromUser(user),
      actionType: "DOCUMENT_DELETE",
      entityType: "document",
      entityId: id,
      parentDocumentId: id,
      parentDocumentName: before.title,
      before,
      after: { ...after, impact },
      summary: `Archived document ${before.title}`
    });
    return ok({ document: after, impact });
  } catch (error) {
    return mapError(error);
  }
}
