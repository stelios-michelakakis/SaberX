import { loginSchema } from "@/lib/validation";
import { ok, mapError } from "@/lib/api";
import { login } from "@/services/auth";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    return ok(await login(input.username, input.password));
  } catch (error) {
    return mapError(error);
  }
}
