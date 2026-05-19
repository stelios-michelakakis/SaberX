import { z } from "zod";
import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { deleteSource, getSource, renameSource } from "@/services/sources";

const patchSchema = z.object({
  displayName: z.string().max(320).nullable()
});

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = patchSchema.parse(await request.json());
    const source = await renameSource(user, id, input.displayName);
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
