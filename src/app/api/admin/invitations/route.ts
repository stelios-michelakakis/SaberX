import { desc } from "drizzle-orm";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { ok, created, mapError } from "@/lib/api";
import { invitationCreateSchema } from "@/lib/validation";
import { createInvitation, requireAdmin } from "@/services/auth";

export async function GET() {
  try {
    await requireAdmin();
    return ok({ invitations: await db.select().from(invitations).orderBy(desc(invitations.createdAt)) });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const input = invitationCreateSchema.parse(await request.json());
    return created(await createInvitation(admin, input));
  } catch (error) {
    return mapError(error);
  }
}
