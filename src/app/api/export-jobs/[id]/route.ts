import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exportJobs } from "@/db/schema";
import { mapError } from "@/lib/api";
import { requireUser } from "@/services/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    const [job] = await db.select().from(exportJobs).where(eq(exportJobs.id, id)).limit(1);
    if (!job?.fileBytes?.base64 || !job.filename) throw new Error("Export file not found");
    return new Response(Buffer.from(job.fileBytes.base64, "base64"), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${job.filename}"`
      }
    });
  } catch (error) {
    return mapError(error);
  }
}
