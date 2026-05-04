import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { snapshots } from "@/db/schema";
import { created, mapError, ok } from "@/lib/api";
import { snapshotCreateSchema } from "@/lib/validation";
import { requireUser } from "@/services/auth";
import { createSnapshot } from "@/services/repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    return ok({ snapshots: await db.select().from(snapshots).where(eq(snapshots.documentId, id)).orderBy(desc(snapshots.createdAt)) });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = snapshotCreateSchema.parse(await request.json());
    return created({ snapshot: await createSnapshot(user, id, input) });
  } catch (error) {
    return mapError(error);
  }
}
