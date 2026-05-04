import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { softDeleteRow } from "@/services/repository";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return ok({ row: await softDeleteRow(user, id) });
  } catch (error) {
    return mapError(error);
  }
}
