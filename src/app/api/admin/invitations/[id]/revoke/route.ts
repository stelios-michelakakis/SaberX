import { ok, mapError } from "@/lib/api";
import { requireAdmin, revokeInvitation } from "@/services/auth";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    return ok({ invitation: await revokeInvitation(admin, id) });
  } catch (error) {
    return mapError(error);
  }
}
