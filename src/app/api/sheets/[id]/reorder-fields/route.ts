import { z } from "zod";
import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { reorderFields } from "@/services/repository";

const schema = z.object({ order: z.array(z.string().uuid()).min(1) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    return ok(await reorderFields(user, id, input.order));
  } catch (error) {
    return mapError(error);
  }
}
