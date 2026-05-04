import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ok, mapError } from "@/lib/api";
import { actorFromUser, requireAdmin } from "@/services/auth";
import { writeAudit } from "@/services/audit";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const input = (await request.json()) as Partial<{
      firstName: string;
      lastName: string;
      organization: string;
      accountStatus: string;
      mustChangePassword: boolean;
    }>;
    const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!before) throw new Error("User not found");
    const [after] = await db
      .update(users)
      .set({
        firstName: input.firstName ?? before.firstName,
        lastName: input.lastName ?? before.lastName,
        organization: input.organization ?? before.organization,
        accountStatus: input.accountStatus ?? before.accountStatus,
        mustChangePassword: input.mustChangePassword ?? before.mustChangePassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    await writeAudit({
      actor: actorFromUser(admin),
      actionType: input.accountStatus === "disabled" ? "USER_DISABLE" : "USER_UPDATE",
      entityType: "user",
      entityId: id,
      before,
      after,
      summary: `Updated user ${before.username}`,
      sourceType: "security"
    });
    return ok({ user: after });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!before) throw new Error("User not found");
    const [after] = await db
      .update(users)
      .set({ accountStatus: "archived", archivedAt: new Date(), deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    await writeAudit({
      actor: actorFromUser(admin),
      actionType: "USER_ARCHIVE",
      entityType: "user",
      entityId: id,
      before,
      after,
      summary: `Archived user ${before.username}`,
      sourceType: "security"
    });
    return ok({ user: after });
  } catch (error) {
    return mapError(error);
  }
}
