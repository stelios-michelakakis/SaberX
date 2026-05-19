import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { getSourceReferences } from "@/services/sources";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    const references = await getSourceReferences(id);
    return ok({ references });
  } catch (error) {
    return mapError(error);
  }
}
