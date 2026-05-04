import { mapError, ok } from "@/lib/api";
import { cellPatchSchema } from "@/lib/validation";
import { requireUser } from "@/services/auth";
import { patchCell } from "@/services/repository";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = cellPatchSchema.parse(await request.json());
    return ok(await patchCell(user, id, input));
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}
