import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ok, mapError } from "@/lib/api";
import { profileSchema } from "@/lib/validation";
import { actorFromUser, requireUser } from "@/services/auth";
import { writeAudit } from "@/services/audit";

export async function GET() {
  try {
    const session = await requireUser();
    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    return ok({ user });
  } catch (error) {
    return mapError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireUser();
    const input = profileSchema.parse(await request.json());
    const [before] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    const [after] = await db
      .update(users)
      .set({
        firstName: input.firstName ?? before.firstName,
        lastName: input.lastName ?? before.lastName,
        organization: input.organization ?? before.organization,
        updatedAt: new Date()
      })
      .where(eq(users.id, session.userId))
      .returning();
    await writeAudit({
      actor: actorFromUser(session),
      actionType: "PROFILE_UPDATE",
      entityType: "user",
      entityId: session.userId,
      before,
      after,
      summary: `Updated profile for ${session.username}`,
      sourceType: "security"
    });
    return ok({ user: after });
  } catch (error) {
    return mapError(error);
  }
}
