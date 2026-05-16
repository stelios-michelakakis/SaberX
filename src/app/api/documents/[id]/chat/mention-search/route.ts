import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { MENTION_KINDS, searchMentionTargets, type MentionKind } from "@/services/chat";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    const url = new URL(request.url);
    const kindParam = url.searchParams.get("kind") ?? "user";
    const q = url.searchParams.get("q") ?? "";
    if (!MENTION_KINDS.includes(kindParam as MentionKind)) {
      return ok({ suggestions: [] });
    }
    const suggestions = await searchMentionTargets(id, kindParam as MentionKind, q);
    return ok({ suggestions });
  } catch (error) {
    return mapError(error);
  }
}
