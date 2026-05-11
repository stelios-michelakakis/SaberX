import { mapError, ok } from "@/lib/api";
import { revokeApiToken } from "@/services/api-tokens";
import { requireUser } from "@/services/auth";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return ok({ token: await revokeApiToken(user, id) });
  } catch (error) {
    return mapError(error);
  }
}
