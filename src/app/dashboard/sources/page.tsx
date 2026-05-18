import { PageHeader } from "@/components/saberx/page-header";
import { requireUser } from "@/services/auth";
import { listSources } from "@/services/sources";
import { SourcesClient } from "./sources-client";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  await requireUser();
  const sources = await listSources();
  return (
    <>
      <PageHeader
        eyebrow="Sources"
        title="Source library"
        subtitle="Upload PDF, DOCX, Markdown, or plain text files and reference them from any document cell."
      />
      <SourcesClient initialSources={sources} />
    </>
  );
}
