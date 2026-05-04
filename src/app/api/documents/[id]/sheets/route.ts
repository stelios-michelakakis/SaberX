import { created, mapError } from "@/lib/api";
import { sheetCreateSchema } from "@/lib/validation";
import { requireUser } from "@/services/auth";
import { createUserSheet } from "@/services/repository";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = sheetCreateSchema.parse(await request.json());
    return created({ sheet: await createUserSheet(user, id, input) });
  } catch (error) {
    return mapError(error);
  }
}
