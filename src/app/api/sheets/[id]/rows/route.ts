import { created, mapError, ok } from "@/lib/api";
import { rowCreateSchema } from "@/lib/validation";
import { requireUser } from "@/services/auth";
import { createRow, getSheetGrid, listReferenceTargets } from "@/services/repository";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    const url = new URL(request.url);
    if (url.searchParams.get("references") === "1") return ok({ targets: await listReferenceTargets(id) });
    return ok(await getSheetGrid(id));
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = rowCreateSchema.parse(await request.json());
    return created({ row: await createRow(user, id, input) });
  } catch (error) {
    return mapError(error);
  }
}
