import { mapError, ok } from "@/lib/api";
import { impactSchema } from "@/lib/validation";
import { requireUser } from "@/services/auth";
import { impactAnalysis } from "@/services/repository";

export async function POST(request: Request) {
  try {
    await requireUser();
    const input = impactSchema.parse(await request.json());
    return ok(await impactAnalysis(input.operation, input.entityId));
  } catch (error) {
    return mapError(error);
  }
}
