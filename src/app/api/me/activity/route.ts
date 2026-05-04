import { ok, mapError } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { listActivity } from "@/services/auth";

export async function GET() {
  try {
    const session = await requireUser();
    return ok({ events: await listActivity(session.userId) });
  } catch (error) {
    return mapError(error);
  }
}
