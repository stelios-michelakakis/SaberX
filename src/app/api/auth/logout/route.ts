import { ok, mapError } from "@/lib/api";
import { logout } from "@/services/auth";

export async function POST() {
  try {
    await logout();
    return ok({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}
