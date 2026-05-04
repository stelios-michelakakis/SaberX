import { db, pool } from "@/db";
import { documents } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { refreshGlossary, refreshSearchIndex } from "@/services/repository";

async function main() {
  const docs = await db.select().from(documents).where(isNull(documents.deletedAt));
  for (const document of docs) {
    await refreshGlossary(document.id, null);
    await refreshSearchIndex(document.id);
  }
  console.log(`Worker refreshed derived data for ${docs.length} document(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
