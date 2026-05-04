import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
    return ok({ events: await db.select().from(auditEvents).orderBy(desc(auditEvents.timestamp)).limit(limit) });
  } catch (error) {
    return mapError(error);
  }
}
