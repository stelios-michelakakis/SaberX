import { PageHeader } from "@/components/saberx/page-header";
import { requireUser } from "@/services/auth";
import { SearchClient } from "./search-client";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  return (
    <>
      <PageHeader
        eyebrow="Search"
        title="Full-text search"
        subtitle="Searches across documents, sheets, fields, rows, and glossary entries."
      />
      <SearchClient initialQuery={q ?? ""} />
    </>
  );
}
