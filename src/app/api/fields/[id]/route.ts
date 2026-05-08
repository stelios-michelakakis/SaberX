import { mapError, ok } from "@/lib/api";
import { fieldUpdateSchema } from "@/lib/validation";
import { requireUser } from "@/services/auth";
import { updateField } from "@/services/repository";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = fieldUpdateSchema.parse(await request.json());
    return ok({ field: await updateField(user, id, input) });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return ok({ field: await updateField(user, id, { archived: true }) });
  } catch (error) {
    return mapError(error);
  }
}
