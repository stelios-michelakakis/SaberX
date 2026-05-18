import { mapError, ok, created } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { createChatMessage, listChatMessages, postChatSchema } from "@/services/chat";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    const url = new URL(request.url);
    const before = url.searchParams.get("before") ?? undefined;
    const limit = url.searchParams.get("limit");
    const messages = await listChatMessages(id, {
      before,
      limit: limit ? Number(limit) : undefined
    });
    return ok({ messages });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = postChatSchema.parse(await request.json());
    const message = await createChatMessage(id, user.userId, input);
    return created({ message });
  } catch (error) {
    return mapError(error);
  }
}
