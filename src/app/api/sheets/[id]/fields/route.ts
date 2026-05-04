import { created, mapError } from "@/lib/api";
import { fieldCreateSchema } from "@/lib/validation";
import { requireUser } from "@/services/auth";
import { createField } from "@/services/repository";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = fieldCreateSchema.parse(await request.json());
    return created({ field: await createField(user, id, input) });
  } catch (error) {
    return mapError(error);
  }
}
