import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ok, mapError } from "@/lib/api";
import { requireUser } from "@/services/auth";

// Marks the tutorial as completed for the current user. Stored on the user
// record (not localStorage) so the tutorial doesn't reappear every time the
// user signs in from a fresh browser/session.
export async function POST() {
  try {
    const user = await requireUser();
    await db
      .update(users)
      .set({ tutorialCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.userId));
    return ok({ tutorialCompletedAt: new Date().toISOString() });
  } catch (error) {
    return mapError(error);
  }
}
