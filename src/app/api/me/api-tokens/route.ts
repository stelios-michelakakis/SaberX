import { z } from "zod";
import { created, mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { createApiToken, listApiTokens } from "@/services/api-tokens";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ tokens: await listApiTokens(user.userId) });
  } catch (error) {
    return mapError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  readOnly: z.boolean().default(false),
  expiresAt: z.string().datetime().optional().nullable()
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = createSchema.parse(await request.json());
    const { token, record } = await createApiToken(user, {
      name: input.name,
      readOnly: input.readOnly,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    });
    return created({
      token,
      record: {
        id: record.id,
        name: record.name,
        readOnly: record.readOnly,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt
      }
    });
  } catch (error) {
    return mapError(error);
  }
}
