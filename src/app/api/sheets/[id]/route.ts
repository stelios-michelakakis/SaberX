import { mapError, ok } from "@/lib/api";
import { sheetUpdateSchema } from "@/lib/validation";
import { requireUser } from "@/services/auth";
import { getSheetGrid, impactAnalysis, softDeleteSheet, updateSheet } from "@/services/repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    return ok(await getSheetGrid(id));
  } catch (error) {
    return mapError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = sheetUpdateSchema.parse(await request.json());
    return ok({ sheet: await updateSheet(user, id, input) });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const impact = await impactAnalysis("sheet_delete", id);
    if (impact.blocked) throw new Error(impact.blockers[0]);
    const sheet = await softDeleteSheet(user, id);
    return ok({ impact, sheet, deleted: true });
  } catch (error) {
    return mapError(error);
  }
}
