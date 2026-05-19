import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { detectDocumentReferences } from "@/services/reference-detection";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    const result = await detectDocumentReferences(id);
    return ok(result);
  } catch (error) {
    return mapError(error);
  }
}
