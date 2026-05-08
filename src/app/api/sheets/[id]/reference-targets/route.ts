import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { listReferenceTargets } from "@/services/repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    return ok({ targets: await listReferenceTargets(id) });
  } catch (error) {
    return mapError(error);
  }
}
