import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { snapshotItems } from "@/db/schema";
import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    await context.params;
    const url = new URL(request.url);
    const left = url.searchParams.get("left");
    const right = url.searchParams.get("right");
    if (!left || !right) throw new Error("left and right snapshot IDs are required");
    const leftItems = await db.select().from(snapshotItems).where(eq(snapshotItems.snapshotId, left));
    const rightItems = await db.select().from(snapshotItems).where(eq(snapshotItems.snapshotId, right));
    type Change = { type: string; entityType: string; entityId: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null };
    const rightMap = new Map(rightItems.map((item) => [`${item.entityType}:${item.entityId}`, item]));
    const changes: Change[] = [];
    for (const item of leftItems) {
      const key = `${item.entityType}:${item.entityId}`;
      const other = rightMap.get(key);
      if (!other) changes.push({ type: "deleted", entityType: item.entityType, entityId: item.entityId, before: item.stateJson, after: null });
      if (other && JSON.stringify(item.stateJson) !== JSON.stringify(other.stateJson)) changes.push({ type: "changed", entityType: item.entityType, entityId: item.entityId, before: item.stateJson, after: other.stateJson });
    }
    const leftMap = new Set(leftItems.map((item) => `${item.entityType}:${item.entityId}`));
    for (const item of rightItems) {
      const key = `${item.entityType}:${item.entityId}`;
      if (!leftMap.has(key)) changes.push({ type: "added", entityType: item.entityType, entityId: item.entityId, before: null, after: item.stateJson });
    }
    return ok({ changes });
  } catch (error) {
    return mapError(error);
  }
}
