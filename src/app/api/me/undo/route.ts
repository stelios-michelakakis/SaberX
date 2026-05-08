import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { getUndoableCount, NothingToUndoError, undoLastAction } from "@/services/undo";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ count: await getUndoableCount(user) });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const result = await undoLastAction(user);
    return ok(result);
  } catch (error) {
    if (error instanceof NothingToUndoError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return mapError(error);
  }
}
