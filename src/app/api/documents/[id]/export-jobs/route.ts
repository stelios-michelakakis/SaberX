import { mapError } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { exportWorkbook } from "@/services/excel";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { filename, buffer } = await exportWorkbook(user, id);
    const body = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return new Response(body as unknown as BodyInit, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return POST(request, context);
}
