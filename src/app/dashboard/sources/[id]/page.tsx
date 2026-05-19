import { notFound } from "next/navigation";
import { requireUser } from "@/services/auth";
import { getSource } from "@/services/sources";
import { ReferencesPanel } from "./references-panel";
import { SourceHeader } from "./source-header";
import { SourcePreview } from "./source-preview";

export const dynamic = "force-dynamic";

export default async function SourceDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const source = await getSource(id);
  if (!source) notFound();

  return (
    <>
      <SourceHeader
        id={source.id}
        filename={source.filename}
        displayName={source.displayName}
        sizeBytes={source.sizeBytes}
      />
      <SourcePreview id={source.id} filename={source.filename} />
      <ReferencesPanel sourceId={source.id} initialCount={source.referenceCount} />
    </>
  );
}
