import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireUser } from "@/services/auth";
import { ResolveReferencesClient } from "./resolve-client";

export const dynamic = "force-dynamic";

export default async function ResolveReferencesPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc || doc.deletedAt) notFound();

  return <ResolveReferencesClient documentId={id} documentTitle={doc.title} />;
}
