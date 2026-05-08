import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { ensureInstructionsReady, getSheetGrid } from "@/services/repository";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await ensureInstructionsReady(user, id);
    return ok(await getSheetGrid(id));
  } catch (error) {
    return mapError(error);
  }
}
