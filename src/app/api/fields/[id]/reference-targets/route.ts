import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { listReferenceTargetsForField } from "@/services/repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    return ok({ targets: await listReferenceTargetsForField(id) });
  } catch (error) {
    return mapError(error);
  }
}
