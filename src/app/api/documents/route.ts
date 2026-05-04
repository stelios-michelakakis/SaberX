import { created, mapError, ok } from "@/lib/api";
import { documentCreateSchema } from "@/lib/validation";
import { actorFromUser, requireUser } from "@/services/auth";
import { createDocument, getWorkspaceData, listDocuments } from "@/services/repository";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    if (url.searchParams.get("workspace") === "1") return ok(await getWorkspaceData());
    return ok({ documents: await listDocuments() });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = documentCreateSchema.parse(await request.json());
    return created({ document: await createDocument(user, input) });
  } catch (error) {
    return mapError(error);
  }
}
