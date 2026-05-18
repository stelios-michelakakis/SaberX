import { db, pool } from "@/db";
import { documents } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { refreshGlossary, refreshSearchIndex } from "@/services/repository";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 60 * 60 * 1000);

let stopping = false;

async function runOnce() {
  const docs = await db.select().from(documents).where(isNull(documents.deletedAt));
  for (const document of docs) {
    if (stopping) return;
    try {
      await refreshGlossary(document.id, null);
      await refreshSearchIndex(document.id);
    } catch (error) {
      console.error(`[worker] refresh failed for ${document.id}:`, error);
    }
  }
  console.log(`[worker] refreshed derived data for ${docs.length} document(s).`);
}

async function loop() {
  while (!stopping) {
    try {
      await runOnce();
    } catch (error) {
      console.error("[worker] pass failed:", error);
    }
    if (stopping) break;
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

const shutdown = async (signal: string) => {
  console.log(`[worker] received ${signal}, draining…`);
  stopping = true;
  try {
    await pool.end();
  } catch {
    // pool may already be closing
  }
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

console.log(`[worker] starting, interval ${Math.round(INTERVAL_MS / 1000)}s`);
loop().catch((error) => {
  console.error("[worker] fatal:", error);
  process.exit(1);
});
