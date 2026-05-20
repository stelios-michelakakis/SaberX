import { requireUser } from "@/services/auth";
import { listSources } from "@/services/sources";
import { SourcesClient } from "./sources-client";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  await requireUser();
  const sources = await listSources();
  return (
    <>
      <div
        style={{
          padding: "10px 28px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
          color: "var(--ink-3)",
          fontSize: 12.5
        }}
      >
        Upload PDF, DOCX, Markdown, plain text, Excel, or image files and reference them from any
        document cell.
      </div>
      <SourcesClient initialSources={sources} />
    </>
  );
}
