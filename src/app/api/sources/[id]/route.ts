import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { deleteSource, getSource } from "@/services/sources";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    const source = await getSource(id);
    if (!source) throw new Error("Source not found");
    return ok({ source });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteSource(user, id);
    return ok({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}
