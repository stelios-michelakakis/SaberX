import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { listIntegrityIssues } from "@/services/repository";

export async function GET() {
  try {
    await requireUser();
    return ok({ issues: await listIntegrityIssues() });
  } catch (error) {
    return mapError(error);
  }
}
