import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/saberx/icon";
import { requireUser } from "@/services/auth";
import { getSource } from "@/services/sources";
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

  const ext = extensionOf(source.filename);

  return (
    <>
      <div
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          minHeight: 0
        }}
      >
        <Link
          href="/dashboard/sources"
          title="Back to sources"
          style={{
            color: "var(--ink-3)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            flex: "none"
          }}
        >
          <Icon name="arrowL" size={11} /> Sources
        </Link>
        <span style={{ color: "var(--line)" }}>/</span>
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0
          }}
          title={source.filename}
        >
          {source.filename}
        </span>
        <span style={{ color: "var(--ink-4)", fontSize: 11, flex: "none" }}>
          {ext.toUpperCase() || "?"} · {formatSize(source.sizeBytes)}
        </span>
        <a
          className="sx-btn sx-btn-ghost sx-btn-sm"
          href={`/api/sources/${source.id}/download`}
          title="Download"
          style={{ marginLeft: "auto", flex: "none", padding: "4px 10px" }}
        >
          <Icon name="download" size={12} /> Download
        </a>
      </div>
      <SourcePreview id={source.id} filename={source.filename} />
    </>
  );
}

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
