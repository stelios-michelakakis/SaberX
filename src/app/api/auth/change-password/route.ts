import { ok, mapError } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validation";
import { changeOwnPassword, getSessionUser } from "@/services/auth";

export async function POST(request: Request) {
  try {
    const input = changePasswordSchema.parse(await request.json());
    const session = await getSessionUser();
    if (!session) throw new Error("Unauthorized");
    await changeOwnPassword(
      {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword
      },
      session.mustChangePassword
    );
    return ok({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}
