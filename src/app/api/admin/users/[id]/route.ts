import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accessGrants,
  auditEvents,
  cellValueLinks,
  cellValuesScalar,
  documents,
  exportJobs,
  fields,
  importJobs,
  invitations,
  rows,
  sheets,
  snapshots,
  tombstones,
  users
} from "@/db/schema";
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

// Hard delete: removes the user row entirely so the username/email are freed
// and the account can never be logged into again. Nullable FK references to
// this user are set to NULL first so referential integrity holds; invitations
// authored by this user are deleted (invitations.invitedBy is NOT NULL).
// Cascading FKs (user_roles, access_grants.user_id, sessions, api_tokens)
// are handled by the database.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    if (id === admin.userId) {
      throw new Error("You cannot remove your own account");
    }
    const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!before) throw new Error("User not found");

    await db.transaction(async (tx) => {
      // Audit first, while we still have full context. Note: actingUserId on
      // this event points to the admin (not the deleted user), so it is safe.
      await writeAudit(
        {
          actor: actorFromUser(admin),
          actionType: "USER_DELETE",
          entityType: "user",
          entityId: id,
          before,
          summary: `Permanently removed user ${before.username}`,
          sourceType: "security"
        },
        tx
      );

      // Null out every nullable FK that references this user.
      await tx.update(accessGrants).set({ grantedBy: null }).where(eq(accessGrants.grantedBy, id));
      await tx.update(documents).set({ ownerId: null }).where(eq(documents.ownerId, id));
      await tx.update(documents).set({ createdBy: null }).where(eq(documents.createdBy, id));
      await tx.update(documents).set({ updatedBy: null }).where(eq(documents.updatedBy, id));
      await tx.update(sheets).set({ createdBy: null }).where(eq(sheets.createdBy, id));
      await tx.update(sheets).set({ updatedBy: null }).where(eq(sheets.updatedBy, id));
      await tx.update(fields).set({ createdBy: null }).where(eq(fields.createdBy, id));
      await tx.update(fields).set({ updatedBy: null }).where(eq(fields.updatedBy, id));
      await tx.update(rows).set({ createdBy: null }).where(eq(rows.createdBy, id));
      await tx.update(rows).set({ updatedBy: null }).where(eq(rows.updatedBy, id));
      await tx.update(cellValuesScalar).set({ updatedBy: null }).where(eq(cellValuesScalar.updatedBy, id));
      await tx.update(cellValueLinks).set({ createdBy: null }).where(eq(cellValueLinks.createdBy, id));
      await tx.update(snapshots).set({ createdBy: null }).where(eq(snapshots.createdBy, id));
      await tx.update(auditEvents).set({ actingUserId: null }).where(eq(auditEvents.actingUserId, id));
      await tx.update(tombstones).set({ deletedBy: null }).where(eq(tombstones.deletedBy, id));
      await tx.update(importJobs).set({ importedBy: null }).where(eq(importJobs.importedBy, id));
      await tx.update(exportJobs).set({ requestedBy: null }).where(eq(exportJobs.requestedBy, id));

      // invitations.invitedBy is NOT NULL — purge invitations authored by the user.
      await tx.delete(invitations).where(eq(invitations.invitedBy, id));

      // Finally remove the user. Cascades handle user_roles, access_grants.user_id,
      // sessions, api_tokens.
      await tx.delete(users).where(eq(users.id, id));
    });

    return ok({ removed: true, username: before.username });
  } catch (error) {
    return mapError(error);
  }
}
