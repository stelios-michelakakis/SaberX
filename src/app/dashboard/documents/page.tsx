import { redirect } from "next/navigation";
import { desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireUser } from "@/services/auth";

export const dynamic = "force-dynamic";

export default async function ActiveDocumentRedirect() {
  await requireUser();
  const [latest] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(isNull(documents.deletedAt))
    .orderBy(desc(documents.updatedAt))
    .limit(1);
  if (!latest) redirect("/dashboard");
  redirect(`/dashboard/documents/${latest.id}`);
}
