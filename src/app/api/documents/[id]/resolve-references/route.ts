import { z } from "zod";
import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { applyDetectedReferences } from "@/services/reference-detection-apply";

const schema = z.object({
  decisions: z.array(
    z.object({
      fieldId: z.string().uuid(),
      targetSheetIds: z.array(z.string().uuid()),
      cellPicks: z.array(
        z.object({
          rowId: z.string().uuid(),
          pickedRowIds: z.array(z.string().uuid())
        })
      )
    })
  )
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const summary = await applyDetectedReferences(user, id, input.decisions);
    return ok(summary);
  } catch (error) {
    return mapError(error);
  }
}
