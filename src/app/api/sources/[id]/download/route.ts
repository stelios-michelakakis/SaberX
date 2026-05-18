import { mapError } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { getSourceForDownload } from "@/services/sources";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    const url = new URL(request.url);
    const inline = url.searchParams.get("inline") === "1";

    const result = await getSourceForDownload(id);
    if (!result) {
      return new Response("Not found", { status: 404 });
    }
    const { vm, buffer } = result;

    const disposition = inline ? "inline" : "attachment";
    // Wrap the filename per RFC 5987 so non-ASCII filenames don't break headers.
    const asciiName = vm.filename.replace(/[^\x20-\x7E]/g, "_");
    const utfName = encodeURIComponent(vm.filename);

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": vm.mimeType,
        "Content-Length": String(vm.sizeBytes),
        "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${utfName}`,
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (error) {
    return mapError(error);
  }
}
