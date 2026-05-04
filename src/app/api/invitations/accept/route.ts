import { ok, mapError } from "@/lib/api";
import { passwordSchema } from "@/lib/validation";
import { acceptInvitation } from "@/services/auth";
import { z } from "zod";

const acceptSchema = z
  .object({
    token: z.string().min(20),
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export async function POST(request: Request) {
  try {
    const input = acceptSchema.parse(await request.json());
    return ok({ user: await acceptInvitation(input.token, input.password) });
  } catch (error) {
    return mapError(error);
  }
}
