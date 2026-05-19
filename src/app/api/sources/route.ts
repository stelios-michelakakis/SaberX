import { mapError, ok, created } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { createSource, listSources } from "@/services/sources";
import { SOURCE_MAX_BYTES } from "@/services/source-storage";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const sources = await listSources({ q });
    return ok({ sources });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Missing file");
    if (file.size === 0) throw new Error("Empty file");
    if (file.size > SOURCE_MAX_BYTES) {
      throw new Error(`File too large (max ${SOURCE_MAX_BYTES} bytes)`);
    }
    const displayNameRaw = form.get("displayName");
    const displayName =
      typeof displayNameRaw === "string" && displayNameRaw.trim() ? displayNameRaw.trim() : null;
    const filename = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());
    const source = await createSource(user, { filename, buffer, displayName });
    return created({ source });
  } catch (error) {
    return mapError(error);
  }
}
